import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internalRef, requireAdmin } from "./adminHelpers";

const kindValidator = v.union(v.literal("review_needed"), v.literal("submitted"), v.literal("approved"), v.literal("rejected"));
const escape = (s: string) => s.replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]!);
const MAX_ATTEMPTS = 5;
const RETRY_WINDOW = 23 * 60 * 60_000; // Resend deduplicates identical requests for 24 hours.

export const enqueue = internalMutation({
  args: { claimId: v.id("artistClaims"), kind: kindValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = args.kind + ":" + args.claimId;
    if (await ctx.db.query("artistNotifications").withIndex("by_key", q => q.eq("key", key)).unique()) return null;
    const claim = await ctx.db.get(args.claimId);
    if (!claim) return null;
    const artist = await ctx.db.get(claim.artistId);
    const name = artist?.name ?? "your artist";
    const site = (process.env.SITE_URL || "https://www.setlists.live").replace(/\/$/, "");
    const owner = process.env.OWNER_NOTIFICATION_EMAIL?.trim();
    const replyTo = process.env.ARTIST_SUPPORT_EMAIL?.trim() || owner;
    const recipient = args.kind === "review_needed" ? owner ?? "" : claim.verificationEmail ?? "";
    const headings = { review_needed: "Artist claim ready for review", submitted: "We received your artist claim",
      approved: "Your artist access is ready", rejected: "Your artist claim needs more evidence" };
    const link = args.kind === "review_needed" ? site + "/admin" :
      args.kind === "approved" ? site + "/for-artists/" + claim.artistId : site + "/for-artists";
    const detail = args.kind === "submitted" ? "Your email is verified. Our team will review the evidence before granting access. You can check your status in the artist portal." :
      args.kind === "approved" ? "Your claim was approved. Open your next show, review its song catalog, and share the voting link with your fans." :
      args.kind === "rejected" ? "We could not approve the evidence submitted." + (claim.reviewNote ? " Reviewer note: " + claim.reviewNote : "") :
      "Review the verified email, role, and supporting evidence in the admin dashboard. Email verification alone does not prove artist ownership.";
    const html = "<div style='font-family:sans-serif;max-width:560px;margin:auto;padding:32px 20px;color:#111'>" +
      "<h1>" + headings[args.kind] + "</h1><p><strong>" + escape(name) + "</strong></p><p>" + escape(detail) +
      "</p><p><a style='background:#111;color:#fff;padding:12px 18px;border-radius:5px;display:inline-block' href='" +
      escape(link) + "'>Open " + (args.kind === "review_needed" ? "review" : "artist portal") + "</a></p>" +
      (replyTo && args.kind !== "review_needed" ? "<p>Reply to this email if you need help.</p>" : "") + "</div>";
    const id = await ctx.db.insert("artistNotifications", {
      claimId: args.claimId, kind: args.kind, key, recipient, replyTo,
      subject: (headings[args.kind] + " | " + name).replace(/[\r\n]/g, " ").slice(0, 180),
      html, status: "pending", attempts: 0, revision: 0, nextAttemptAt: Date.now(),
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internalRef.artistNotifications.send, { id });
    return null;
  },
});

export const reserve = internalMutation({
  args: { id: v.id("artistNotifications") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || !["pending", "sending"].includes(row.status) || (row.nextAttemptAt ?? Infinity) > Date.now()) return null;
    if (row.attempts >= MAX_ATTEMPTS || (row.firstAttemptAt !== undefined && Date.now() - row.firstAttemptAt >= RETRY_WINDOW)) {
      await ctx.db.patch(id, { status: "failed", nextAttemptAt: undefined, updatedAt: Date.now(),
        lastError: "Automatic retry window ended. Review delivery before retrying manually." });
      return null;
    }
    const claim = await ctx.db.get(row.claimId);
    let relevant = claim && (row.kind === "approved" ? claim.status === "approved" :
      row.kind === "rejected" ? claim.status === "rejected" : claim.status === "pending");
    if (relevant && claim && row.kind === "approved") {
      relevant = !!(await ctx.db.query("artistMembers").withIndex("by_user_artist",
        q => q.eq("userId", claim.userId).eq("artistId", claim.artistId)).first());
    }
    if (!relevant) {
      await ctx.db.patch(id, { status: "cancelled", nextAttemptAt: undefined, updatedAt: Date.now() });
      return null;
    }
    const attempts = row.attempts + 1;
    await ctx.db.patch(id, { status: "sending", attempts, firstAttemptAt: row.firstAttemptAt ?? Date.now(),
      nextAttemptAt: Date.now() + 2 * 60_000, updatedAt: Date.now() });
    return { ...row, attempts };
  },
});

export const finish = internalMutation({
  args: { id: v.id("artistNotifications"), attempt: v.number(), revision: v.number(),
    providerId: v.optional(v.string()), error: v.optional(v.string()), retryable: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.status !== "sending" || row.attempts !== args.attempt || row.revision !== args.revision) return null;
    if (args.providerId) {
      await ctx.db.patch(row._id, { status: "accepted", providerId: args.providerId, nextAttemptAt: undefined,
        deliveryStatus: "unconfirmed", lastError: undefined, updatedAt: Date.now() });
      await ctx.scheduler.runAfter(5 * 60_000, internalRef.artistNotifications.checkDelivery,
        { id: row._id, check: 0 });
    } else {
      const retry = args.retryable && row.attempts < MAX_ATTEMPTS &&
        Date.now() - (row.firstAttemptAt ?? Date.now()) < RETRY_WINDOW;
      const delay = Math.min(60_000 * 2 ** row.attempts, 30 * 60_000);
      await ctx.db.patch(row._id, { status: retry ? "pending" : "failed",
        nextAttemptAt: retry ? Date.now() + delay : undefined,
        lastError: args.error ?? "Email was not accepted", updatedAt: Date.now() });
      if (retry) await ctx.scheduler.runAfter(delay, internalRef.artistNotifications.send, { id: row._id });
    }
    return null;
  },
});

export const send = internalAction({
  args: { id: v.id("artistNotifications") }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.runMutation(internalRef.artistNotifications.reserve, args);
    if (!row) return null;
    const finish = { id: args.id, attempt: row.attempts, revision: row.revision };
    const key = process.env.RESEND_API_KEY;
    if (!key || !row.recipient) {
      await ctx.runMutation(internalRef.artistNotifications.finish,
        { ...finish, error: "Email provider or recipient is not configured", retryable: false });
      return null;
    }
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(20_000),
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json",
          "Idempotency-Key": "artist-notification/" + row._id + "/" + row.revision },
        body: JSON.stringify({ from: "setlists.live <noreply@setlists.live>", to: row.recipient,
          subject: row.subject, html: row.html, ...(row.replyTo ? { reply_to: row.replyTo } : {}) }),
      });
      const result = response.ok ? await response.json() : null;
      await ctx.runMutation(internalRef.artistNotifications.finish, response.ok && typeof result?.id === "string" ?
        { ...finish, providerId: result.id } : { ...finish, error: "Email provider response " + response.status,
          retryable: response.status === 429 || response.status >= 500 || response.ok });
    } catch {
      await ctx.runMutation(internalRef.artistNotifications.finish,
        { ...finish, error: "Email provider request could not be confirmed", retryable: true });
    }
    return null;
  },
});

export const recover = internalMutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    for (const status of ["pending", "sending"] as const) {
      const rows = await ctx.db.query("artistNotifications").withIndex("by_status_due",
        q => q.eq("status", status).gte("nextAttemptAt", 0).lte("nextAttemptAt", Date.now())).take(20);
      for (const row of rows) await ctx.scheduler.runAfter(0, internalRef.artistNotifications.send, { id: row._id });
    }
    return null;
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("artistNotifications") }, handler: (ctx, { id }) => ctx.db.get(id),
});
export const recordDelivery = internalMutation({
  args: { id: v.id("artistNotifications"), providerId: v.string(), deliveryStatus: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (row?.providerId === args.providerId && row.status === "accepted") {
      await ctx.db.patch(row._id, { deliveryStatus: args.deliveryStatus, updatedAt: Date.now() });
    }
  },
});
export const checkDelivery = internalAction({
  args: { id: v.id("artistNotifications"), check: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.runQuery(internalRef.artistNotifications.getInternal, { id: args.id });
    if (!row?.providerId || row.status !== "accepted" || !process.env.RESEND_API_KEY) return;
    let status = "unconfirmed";
    try {
      const response = await fetch("https://api.resend.com/emails/" + encodeURIComponent(row.providerId),
        { headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY }, signal: AbortSignal.timeout(15_000) });
      if (response.ok) {
        const body = await response.json();
        if (typeof body.last_event === "string") status = body.last_event;
      }
    } catch { /* Leave delivery unconfirmed; provider acceptance is a separate fact. */ }
    await ctx.runMutation(internalRef.artistNotifications.recordDelivery,
      { id: row._id, providerId: row.providerId, deliveryStatus: status });
    if (args.check < 2 && !["delivered", "opened", "clicked", "bounced", "complained", "failed"].includes(status)) {
      await ctx.scheduler.runAfter(30 * 60_000, internalRef.artistNotifications.checkDelivery,
        { id: args.id, check: args.check + 1 });
    }
  },
});

export const listRecent = query({
  args: {}, handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("artistNotifications").order("desc").take(50);
    return Promise.all(rows.map(async row => {
      const claim = await ctx.db.get(row.claimId);
      const artist = claim ? await ctx.db.get(claim.artistId) : null;
      return { _id: row._id, artistName: artist?.name ?? "Unknown artist", kind: row.kind, status: row.status,
        deliveryStatus: row.deliveryStatus, attempts: row.attempts, lastError: row.lastError, updatedAt: row.updatedAt };
    }));
  },
});

export const retry = mutation({
  args: { id: v.id("artistNotifications") }, returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.status !== "failed") throw new Error("Only failed notifications can be retried");
    if (Date.now() - row.updatedAt < 60_000) throw new Error("Wait a minute before retrying");
    await ctx.db.patch(id, { status: "pending", attempts: 0, revision: row.revision + 1,
      firstAttemptAt: undefined, nextAttemptAt: Date.now(), updatedAt: Date.now(), lastError: undefined,
      ...(!row.recipient && row.kind === "review_needed" ? { recipient: process.env.OWNER_NOTIFICATION_EMAIL?.trim() ?? "" } : {}) });
    await ctx.scheduler.runAfter(0, internalRef.artistNotifications.send, { id });
    return null;
  },
});

