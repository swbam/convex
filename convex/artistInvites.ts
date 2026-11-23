"use node";

import { createHash, randomBytes } from "node:crypto";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internalRef } from "./adminHelpers";

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return replacements[character];
  });

const siteUrl = () =>
  (process.env.SITE_URL || "https://www.setlists.live").replace(/\/$/, "");

const emailHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

async function sendInviteEmail(args: {
  to: string;
  artistName: string;
  invitedByName: string;
  role: "manager" | "viewer";
  inviteUrl: string;
  inviteId: string;
  tokenHash: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return "not_configured" as const;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `artist-invite/${args.inviteId}/${args.tokenHash}`,
    },
    body: JSON.stringify({
      from: "setlists.live <noreply@setlists.live>",
      to: args.to,
      subject: emailHeader(`Join ${args.artistName} on setlists.live`).slice(0, 180),
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:36px 20px;color:#111827">
          <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Artist team invitation</p>
          <h1 style="font-size:28px;line-height:1.15;margin:12px 0 16px">Join ${escapeHtml(args.artistName)} on setlists.live</h1>
          <p style="font-size:16px;line-height:1.6;color:#4b5563">${escapeHtml(args.invitedByName)} invited you to view tour demand as a ${escapeHtml(args.role)}.</p>
          <p style="margin:28px 0"><a href="${escapeHtml(args.inviteUrl)}" style="display:inline-block;background:#111827;color:#fff;padding:13px 20px;border-radius:10px;text-decoration:none;font-weight:600">Accept invitation</a></p>
          <p style="font-size:13px;line-height:1.5;color:#6b7280">This private link expires in 7 days and only works for the email address that received it.</p>
        </div>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider rejected the invitation (${response.status})`);
  }
  return "sent" as const;
}

export const createInvite = action({
  args: {
    artistId: v.id("artists"),
    email: v.string(),
    role: v.union(v.literal("manager"), v.literal("viewer")),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
    inviteUrl: v.optional(v.string()),
    emailSent: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const now = Date.now();
    const prepared = await ctx.runMutation(internalRef.artistAccess.prepareInvite, {
      artistId: args.artistId,
      email: args.email,
      role: args.role,
      tokenHash,
      now,
      expiresAt: now + INVITE_EXPIRY_MS,
    });

    if (!prepared.success || !prepared.inviteId || !prepared.artistName) {
      return { success: false, message: prepared.message || "Could not create invitation" };
    }

    const inviteUrl = `${siteUrl()}/for-artists/invite/${token}`;
    let deliveryStatus: "sent" | "not_configured" | "failed" = "failed";
    try {
      deliveryStatus = await sendInviteEmail({
        to: args.email.trim().toLowerCase(),
        artistName: prepared.artistName,
        invitedByName: prepared.invitedByName || "An artist team owner",
        role: args.role,
        inviteUrl,
        inviteId: prepared.inviteId,
        tokenHash,
      });
    } catch (error) {
      console.error("Artist invitation email failed", {
        inviteId: prepared.inviteId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    const current = await ctx.runMutation(internalRef.artistAccess.recordInviteDelivery, {
      inviteId: prepared.inviteId,
      tokenHash,
      deliveryStatus,
    });
    if (!current) return { success: false, message: "This invitation changed. Check the current team invitations." };

    return {
      success: true,
      inviteUrl,
      emailSent: deliveryStatus === "sent",
      message:
        deliveryStatus === "sent"
          ? "Invitation emailed"
          : "Invitation created. Copy the secure link to send it manually.",
    };
  },
});

export const getInvitePreview = action({
  args: { token: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (args.token.length < 32 || args.token.length > 128) return null;
    return await ctx.runQuery(internalRef.artistAccess.getInvitePreviewByHash, {
      tokenHash: hashToken(args.token),
    });
  },
});

export const acceptInvite = action({
  args: { token: v.string() },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
    artistId: v.optional(v.id("artists")),
    artistName: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    if (args.token.length < 32 || args.token.length > 128) {
      return { success: false, message: "Invalid invitation link" };
    }
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, message: "Please sign in first" };
    const tokenHash = hashToken(args.token);
    // Use Clerk's verified address when the signed token contains it. Some
    // Convex JWT templates omit email claims; read Clerk directly in that case.
    let verifiedEmails: string[] = [];
    if (identity.email && identity.emailVerified === true) {
      verifiedEmails = [identity.email];
    } else {
      const preview = await ctx.runQuery(internalRef.artistAccess.getInvitePreviewByHash, { tokenHash });
      if (!preview?.isValid) return { success: false, message: "This invitation is no longer valid" };
      const secret = process.env.CLERK_SECRET_KEY;
      if (!secret) return { success: false, message: "Email verification is temporarily unavailable. Try again later." };
      try {
        const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(identity.subject)}`, {
          headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error("Clerk unavailable");
        const profile = await response.json();
        const addresses: Array<{ email_address: string; verification?: { status?: string } }> = profile.email_addresses ?? [];
        verifiedEmails = addresses.filter(a => a.verification?.status === "verified").map(a => a.email_address);
      } catch {
        return { success: false, message: "Email verification is temporarily unavailable. Try again later." };
      }
    }
    return await ctx.runMutation(internalRef.artistAccess.acceptInviteByHash, { tokenHash, verifiedEmails });
  },
});
