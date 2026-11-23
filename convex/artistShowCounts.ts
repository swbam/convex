import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internalRef, requireAdmin } from "./adminHelpers";

const NAME = "upcoming-show-counts";
const cursorValidator = v.union(v.string(), v.null());

export const start = internalMutation({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    const previous = await ctx.db.query("artistShowCountRuns").withIndex("by_name", q => q.eq("name", NAME)).unique();
    if (previous && previous.phase !== "complete") {
      // Re-dispatch only stalled work. Cursor comparison makes duplicate delivery harmless.
      if (previous.updatedAt < Date.now() - 10 * 60_000) {
        await ctx.scheduler.runAfter(0, internalRef.artistShowCounts.step, {
          generation: previous.generation, phase: previous.phase, cursor: previous.cursor,
        });
      }
      return null;
    }
    const generation = Math.max(Date.now(), (previous?.generation ?? 0) + 1);
    const run = { name: NAME, generation, phase: "counting" as const, cursor: null,
      showsCounted: 0, artistsUpdated: 0, startedAt: Date.now(), updatedAt: Date.now(), completedAt: undefined };
    if (previous) await ctx.db.patch(previous._id, run);
    else await ctx.db.insert("artistShowCountRuns", run);
    await ctx.scheduler.runAfter(0, internalRef.artistShowCounts.step, { generation, phase: "counting", cursor: null });
    return null;
  },
});

export const step = internalMutation({
  args: { generation: v.number(), phase: v.union(v.literal("counting"), v.literal("publishing")), cursor: cursorValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.query("artistShowCountRuns").withIndex("by_name", q => q.eq("name", NAME)).unique();
    if (!run || run.generation !== args.generation || run.phase !== args.phase || run.cursor !== args.cursor) return null;
    if (args.phase === "counting") {
      const result = await ctx.db.query("shows").withIndex("by_status_and_date", q => q.eq("status", "upcoming"))
        .paginate({ numItems: 200, cursor: args.cursor, maximumBytesRead: 1_000_000 });
      const totals = new Map<string, { artistId: typeof result.page[number]["artistId"]; count: number }>();
      for (const show of result.page) {
        const item = totals.get(show.artistId);
        totals.set(show.artistId, { artistId: show.artistId, count: (item?.count ?? 0) + 1 });
      }
      for (const { artistId, count } of totals.values()) {
        const old = await ctx.db.query("artistShowCountTotals").withIndex("by_generation_artist",
          q => q.eq("generation", args.generation).eq("artistId", artistId)).unique();
        if (old) await ctx.db.patch(old._id, { count: old.count + count });
        else await ctx.db.insert("artistShowCountTotals", { generation: args.generation, artistId, count });
      }
      const next = { generation: args.generation, phase: result.isDone ? "publishing" as const : "counting" as const,
        cursor: result.isDone ? null : result.continueCursor };
      await ctx.db.patch(run._id, { phase: next.phase, cursor: next.cursor,
        showsCounted: run.showsCounted + result.page.length, updatedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internalRef.artistShowCounts.step, next);
    } else {
      // Publish only from a fully counted generation; zero-show artists are included.
      const result = await ctx.db.query("artists").paginate({ numItems: 100, cursor: args.cursor, maximumBytesRead: 1_000_000 });
      for (const artist of result.page) {
        const total = await ctx.db.query("artistShowCountTotals").withIndex("by_generation_artist",
          q => q.eq("generation", args.generation).eq("artistId", artist._id)).unique();
        if (artist.upcomingShowsCount !== (total?.count ?? 0)) {
          await ctx.db.patch(artist._id, { upcomingShowsCount: total?.count ?? 0, lastTrendingUpdate: Date.now() });
        }
      }
      await ctx.db.patch(run._id, { phase: result.isDone ? "complete" : "publishing",
        cursor: result.isDone ? null : result.continueCursor,
        artistsUpdated: run.artistsUpdated + result.page.length, updatedAt: Date.now(),
        ...(result.isDone ? { completedAt: Date.now() } : {}) });
      if (result.isDone) {
        await ctx.scheduler.runAfter(0, internalRef.trending.updateArtistTrending, {});
        await ctx.scheduler.runAfter(0, internalRef.artistShowCounts.cleanup, { before: args.generation });
      } else await ctx.scheduler.runAfter(0, internalRef.artistShowCounts.step,
        { ...args, cursor: result.continueCursor });
    }
    return null;
  },
});

export const cleanup = internalMutation({
  args: { before: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("artistShowCountTotals").withIndex("by_generation_artist",
      q => q.lt("generation", args.before)).take(200);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === 200) await ctx.scheduler.runAfter(0, internalRef.artistShowCounts.cleanup, args);
    return null;
  },
});

export const status = query({
  args: {}, handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("artistShowCountRuns").withIndex("by_name", q => q.eq("name", NAME)).unique();
  },
});

