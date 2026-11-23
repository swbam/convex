import { internalAction, internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { internalRef } from "./adminHelpers";
const DAY = 86_400_000;

// Fair, indexed rotation supplements trending discovery and managed-artist warmup.
export const dispatch = internalMutation({
  args: {}, handler: async (ctx) => {
    const now = Date.now();
    const today = new Date(now - 12 * 3600_000).toISOString().slice(0, 10);
    const soon = new Date(now + 7 * DAY).toISOString().slice(0, 10);
    // Rotate through imminent shows independently of artists with no known dates.
    const rotation = await ctx.db.query("touringRefreshRotation").withIndex("by_key", q => q.eq("key", "week")).unique();
    const window = today + "/" + soon;
    const upcoming = await ctx.db.query("shows").withIndex("by_status_and_date", q =>
      q.eq("status", "upcoming").gte("date", today).lte("date", soon))
      .paginate({ cursor: rotation?.window === window ? rotation.cursor : null, numItems: 80, maximumBytesRead: 1_000_000 });
    const cursor = upcoming.isDone ? null : upcoming.continueCursor;
    if (rotation) await ctx.db.patch(rotation._id, { cursor, window });
    else await ctx.db.insert("touringRefreshRotation", { key: "week", window, cursor });

    const due = await ctx.db.query("artists").withIndex("by_active_show_refresh",
      q => q.eq("isActive", true).lte("nextShowRefreshAt", now)).take(60);
    const urgent = await Promise.all([...new Set(upcoming.page.map(s => s.artistId))].map(id => ctx.db.get(id)));
    const scheduled = new Set<string>();
    async function schedule(artist: Doc<"artists">, interval: number) {
      if (!artist.isActive || !artist.ticketmasterId || scheduled.has(artist._id)) return;
      if ((artist.lastShowSyncAt ?? 0) + interval > now ||
          (artist.lastShowRefreshAttemptAt ?? 0) + 2 * 3600_000 > now ||
          (artist.showRefreshFailures && (artist.nextShowRefreshAt ?? 0) > now)) return;
      await ctx.db.patch(artist._id, { lastShowRefreshAttemptAt: now, nextShowRefreshAt: now + 2 * 3600_000 });
      await ctx.scheduler.runAfter(scheduled.size * 15_000, internalRef.touringRefresh.run,
        { artistId: artist._id, ticketmasterId: artist.ticketmasterId, attemptAt: now, interval });
      scheduled.add(artist._id);
    }
    // Keep the existing eight-job ceiling and reserve two slots for the oldest due artists.
    for (const artist of urgent) {
      if (scheduled.size >= 6) break;
      if (artist) await schedule(artist, DAY);
    }
    for (const artist of due) {
      if (scheduled.size >= 8) break;
      if (scheduled.has(artist._id)) continue;
      if (!artist.ticketmasterId) {
        await ctx.db.patch(artist._id, { nextShowRefreshAt: now + 30 * DAY });
        continue;
      }
      const next = await ctx.db.query("shows").withIndex("by_artist_status_and_date",
        q => q.eq("artistId", artist._id).eq("status", "upcoming").gte("date", today)).first();
      const interval = !next ? 30 * DAY : next.date <= soon ? DAY : 7 * DAY;
      const eligibleAt = (artist.lastShowSyncAt ?? 0) + interval;
      if (eligibleAt > now) await ctx.db.patch(artist._id, { nextShowRefreshAt: eligibleAt });
      else await schedule(artist, interval);
    }
    return { examined: new Set([...urgent.filter(a => a !== null).map(a => a!._id), ...due.map(a => a._id)]).size,
      scheduled: scheduled.size };
  },
});

export const finish = internalMutation({
  args: { artistId: v.id("artists"), attemptAt: v.number(), interval: v.number(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const artist = await ctx.db.get(args.artistId);
    if (!artist || artist.lastShowRefreshAttemptAt !== args.attemptAt) return;
    const failures = args.error ? (artist.showRefreshFailures ?? 0) + 1 : 0;
    await ctx.db.patch(artist._id, { showRefreshFailures: failures, lastShowRefreshError: args.error,
      nextShowRefreshAt: Date.now() + (args.error ? Math.min(DAY * 7, 6 * 60 * 60_000 * 2 ** Math.min(failures - 1, 5)) : args.interval) });
  },
});

export const run = internalAction({
  args: { artistId: v.id("artists"), ticketmasterId: v.string(), attemptAt: v.number(), interval: v.number() },
  handler: async (ctx, args) => {
    try {
      await ctx.runAction(internalRef.ticketmaster.syncArtistShows, { artistId: args.artistId, ticketmasterId: args.ticketmasterId });
      await ctx.runMutation(internalRef.touringRefresh.finish,
        { artistId: args.artistId, attemptAt: args.attemptAt, interval: args.interval });
    } catch (error) {
      // Provider bodies/URLs can contain credentials; keep the durable error categorical.
      await ctx.runMutation(internalRef.touringRefresh.finish,
        { artistId: args.artistId, attemptAt: args.attemptAt, interval: args.interval,
          error: "Provider show refresh failed or was partial; existing shows retained." });
      throw new Error("Touring artist refresh failed; retry recorded");
    }
  },
});

