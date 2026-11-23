import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internalRef, requireAdmin, requireAdminForAction } from "./adminHelpers";
import { isFestivalEvent, matchesFestivalEvent, normalizeFestivalText } from "./lib/festivalIdentity";
import { safeImageUrl, selectFestivalImages } from "./lib/festivalMedia";

export const classifyLegacy = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("festivals").paginate({ cursor: args.cursor ?? null, numItems: 80 });
    let listed = 0, review = 0;
    for (const f of page.page) {
      if (f.discoveryState && f.discoveryReason !== "Festival name evidence") continue;
      const eligible = isFestivalEvent({ name: f.name });
      await ctx.db.patch(f._id, { discoveryState: eligible ? "listed" : "review", discoveryReason: eligible ? "Festival name evidence" : "Needs festival identity review; retained with all linked shows" });
      eligible ? listed++ : review++;
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internalRef.festivalMediaSync.classifyLegacy, { cursor: page.continueCursor });
    return { listed, review, done: page.isDone };
  },
});

export const startInternal = internalMutation({
  args: {},
  handler: async ctx => {
    const active = await ctx.db.query("syncJobs").withIndex("by_type_and_status", q => q.eq("type", "festival_media_sync").eq("status", "running")).first();
    if (active && (active.startedAt ?? 0) > Date.now() - 3600000) return active._id;
    if (active) await ctx.db.patch(active._id, { status: "failed", completedAt: Date.now(), errorMessage: "Image sync expired; restart queued" });
    const jobId = await ctx.db.insert("syncJobs", { type: "festival_media_sync", status: "running", priority: 3, retryCount: 0, maxRetries: 3, startedAt: Date.now(), currentPhase: "upcoming", continuationCursor: null, itemsProcessed: 0 });
    await ctx.scheduler.runAfter(0, internalRef.festivalMediaSync.step, { jobId });
    return jobId;
  },
});
export const start = action({ args: {}, handler: async ctx => {
  await requireAdminForAction(ctx);
  return await ctx.runMutation(internalRef.festivalMediaSync.startInternal, {});
}});
export const batch = internalQuery({ args: { jobId: v.id("syncJobs") }, handler: async (ctx, { jobId }) => {
  const job = await ctx.db.get(jobId);
  if (!job || job.status !== "running") return null;
  const today = new Date().toISOString().slice(0,10);
  const result = await ctx.db.query("festivals").withIndex("by_discovery_end", q => job.currentPhase === "past"
    ? q.eq("discoveryState", "listed").lt("endDate", today) : q.eq("discoveryState", "listed").gte("endDate", today))
    .order(job.currentPhase === "past" ? "desc" : "asc").paginate({ cursor: job.continuationCursor ?? null, numItems: 8 });
  return { job, ...result };
}});
export const record = internalMutation({
  args: { festivalId: v.id("festivals"), imageUrl: v.optional(v.string()), imageCardUrl: v.optional(v.string()), imageAttribution: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const f = await ctx.db.get(args.festivalId); if (!f) return;
    await ctx.db.patch(f._id, { mediaCheckedAt: Date.now(), mediaError: args.error,
      ...(safeImageUrl(args.imageUrl) ? { imageUrl: args.imageUrl, imageCardUrl: args.imageCardUrl, imageAttribution: args.imageAttribution, imageUpdatedAt: Date.now() } : {}) });
  },
});
export const advance = internalMutation({
  args: { jobId: v.id("syncJobs"), expectedCursor: v.union(v.string(), v.null()), expectedPhase: v.string(), nextCursor: v.string(), done: v.boolean(), count: v.number(), error: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const job = await ctx.db.get(a.jobId);
    if (!job || job.status !== "running" || (job.continuationCursor ?? null) !== a.expectedCursor || job.currentPhase !== a.expectedPhase) return;
    if (a.error) {
      const retryCount = job.retryCount + 1;
      await ctx.db.patch(job._id, { retryCount, errorMessage: a.error, ...(retryCount >= 3 ? { status: "failed" as const, completedAt: Date.now() } : {}) });
      if (retryCount < 3) await ctx.scheduler.runAfter(60000 * retryCount, internalRef.festivalMediaSync.step, { jobId: job._id });
      return;
    }
    const completed = a.done && a.expectedPhase === "past";
    await ctx.db.patch(job._id, { itemsProcessed: (job.itemsProcessed ?? 0) + a.count, retryCount: 0, errorMessage: undefined,
      continuationCursor: a.done ? null : a.nextCursor, currentPhase: a.done ? "past" : a.expectedPhase,
      ...(completed ? { status: "completed" as const, completedAt: Date.now(), progressPercentage: 100 } : {}) });
    if (!completed) await ctx.scheduler.runAfter(2000, internalRef.festivalMediaSync.step, { jobId: job._id });
  },
});

async function tm(path: string, params: Record<string, string> = {}) {
  const key = process.env.TICKETMASTER_API_KEY; if (!key) throw new Error("Ticketmaster API key is not configured");
  const response = await fetch(`https://app.ticketmaster.com/discovery/v2/${path}?${new URLSearchParams({ ...params, apikey: key })}`, { signal: AbortSignal.timeout(15000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Ticketmaster image lookup returned ${response.status}`);
  return response.json();
}
export function brandKey(name: string) { return normalizeFestivalText(name).replace(/\b(music|arts|and|festival|fest)\b/g, "").replace(/\s+/g," ").trim(); }
export async function findFestivalImages(f: any) {
  if (f.ticketmasterId) {
    const event = await tm(`events/${encodeURIComponent(f.ticketmasterId)}.json`);
    if (event && matchesFestivalEvent(f, event)) {
      const chosen = selectFestivalImages(event.images);
      if (chosen) return chosen;
    }
  }
  // Expired event IDs can disappear. Only the same festival's attraction artwork
  // may be reused; never take an arbitrary keyword result or change ticket URLs.
  const data = await tm("attractions.json", { keyword: f.name.replace(/\b20\d{2}\b/g," ").trim(), classificationName: "music", size: "10" });
  const candidates = (data?._embedded?.attractions ?? []).filter((a: any) => brandKey(a.name ?? "") === brandKey(f.name));
  return candidates.length === 1 ? selectFestivalImages(candidates[0].images) : undefined;
}
export const step = internalAction({ args: { jobId: v.id("syncJobs") }, handler: async (ctx, args) => {
  const data = await ctx.runQuery(internalRef.festivalMediaSync.batch, args); if (!data) return;
  try {
    for (const f of data.page) {
      if (f.imageUrl || (f.mediaCheckedAt ?? 0) >= data.job.startedAt) continue;
      const images = await findFestivalImages(f);
      await ctx.runMutation(internalRef.festivalMediaSync.record, { festivalId: f._id, ...images, ...(!images ? { error: "No verified non-generic artwork available" } : {}) });
      await new Promise(r => setTimeout(r, 1000));
    }
    await ctx.runMutation(internalRef.festivalMediaSync.advance, { jobId: args.jobId, expectedCursor: data.job.continuationCursor ?? null, expectedPhase: data.job.currentPhase, nextCursor: data.continueCursor, done: data.isDone, count: data.page.length });
  } catch (error) {
    await ctx.runMutation(internalRef.festivalMediaSync.advance, { jobId: args.jobId, expectedCursor: data.job.continuationCursor ?? null, expectedPhase: data.job.currentPhase, nextCursor: data.continueCursor, done: false, count: 0, error: error instanceof Error ? error.message.slice(0,300) : "Image sync failed" });
  }
}});
export const adminSearch = query({ args: { search: v.string() }, handler: async (ctx, { search }) => {
  await requireAdmin(ctx);
  return search.trim() ? await ctx.db.query("festivals").withSearchIndex("search_name", q => q.search("name", search.trim().slice(0,100))).take(30)
    : await ctx.db.query("festivals").withIndex("by_end_date").order("desc").take(30);
}});
export const setOverride = mutation({ args: { festivalId: v.id("festivals"), imageUrl: v.string() }, handler: async (ctx, args) => {
  const actorUserId = await requireAdmin(ctx);
  const f = await ctx.db.get(args.festivalId); if (!f) throw new Error("Festival not found");
  const imageOverrideUrl = args.imageUrl.trim() ? safeImageUrl(args.imageUrl.trim()) : undefined;
  if (args.imageUrl.trim() && (!imageOverrideUrl || imageOverrideUrl.length > 2048)) throw new Error("Enter a valid HTTPS image URL");
  await ctx.db.patch(f._id, { imageOverrideUrl });
  await ctx.db.insert("adminAuditLogs", { actorUserId, action: "festival.imageOverride", args: { festivalId: f._id, before: f.imageOverrideUrl, after: imageOverrideUrl }, createdAt: Date.now(), success: true });
}});

export const setDiscovery = mutation({ args: { festivalId: v.id("festivals"), listed: v.boolean() }, handler: async (ctx, args) => {
  const actorUserId = await requireAdmin(ctx);
  const f = await ctx.db.get(args.festivalId); if (!f) throw new Error("Festival not found");
  await ctx.db.patch(f._id, { discoveryState: args.listed ? "listed" : "review", discoveryReason: "Administrator reviewed festival identity" });
  await ctx.db.insert("adminAuditLogs", { actorUserId, action: "festival.discovery", args, createdAt: Date.now(), success: true });
}});
