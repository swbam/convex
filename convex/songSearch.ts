import { matchesSearch } from "../shared/searchRelevance";
import { selectOfficialSetlist } from "./lib/officialSetlist";
import { query, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internalRef } from "./adminHelpers";
import { songKey } from "./lib/predictions";

// One entry per performed title/show; repeated encores never duplicate results.
async function syncPerformances(ctx: MutationCtx, show: Doc<"shows">, songs: { title: string }[]) {
  const wanted = new Map(songs.map(song => [songKey(song.title), song.title] as const).filter(([key]) => !!key));
  const existing = await ctx.db.query("songPerformances").withIndex("by_show", q => q.eq("showId", show._id)).collect();
  if (existing.length === wanted.size && existing.every(row => row.date === show.date && wanted.get(songKey(row.title)) === row.title)) return;
  const existingBySong = new Map(existing.map(row => [row.songId, row]));
  const retained = new Set<Id<"songPerformances">>();
  await Promise.all([...wanted].map(async ([key, title]) => {
    const song = await ctx.db.query("performedSongs").withIndex("by_song_key", q => q.eq("songKey", key)).first();
    const songId = song?._id ?? await ctx.db.insert("performedSongs", { songKey: key, title });
    const row = existingBySong.get(songId);
    if (row) {
      retained.add(row._id);
      if (row.date !== show.date || row.title !== title) await ctx.db.patch(row._id, { date: show.date, title });
    } else await ctx.db.insert("songPerformances", { songId, showId: show._id, title, date: show.date });
  }));
  await Promise.all(existing.filter(row => !retained.has(row._id)).map(row => ctx.db.delete(row._id)));
}

// Import mutations schedule this separately, avoiding search-index work in the import transaction.
export const indexShow = internalMutation({
  args: { showId: v.id("shows") },
  handler: async (ctx, { showId }) => {
    const show = await ctx.db.get(showId);
    const lists = await ctx.db.query("setlists").withIndex("by_show", q => q.eq("showId", showId)).collect();
    const official = selectOfficialSetlist(lists);
    if (!show || !official) {
      for (const row of await ctx.db.query("songPerformances").withIndex("by_show", q => q.eq("showId", showId)).collect()) await ctx.db.delete(row._id);
      return;
    }
    await syncPerformances(ctx, show, official.actualSetlist!);
  },
});

export const backfill = internalMutation({
  args: { cursor: v.optional(v.string()), order: v.optional(v.union(v.literal("asc"), v.literal("desc"))) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("setlists").withIndex("by_official", q => q.eq("isOfficial", true))
      .order(args.order ?? "asc")
      .paginate({ cursor: args.cursor ?? null, numItems: 10, maximumBytesRead: 500_000 });
    let titles = 0, indexed = 0;
    for (const list of page.page) {
      if (!list.actualSetlist?.length) continue;
      // An unusually large set gets its own transaction, preserving the batch read/write budget.
      if (titles + list.actualSetlist.length > 250) {
        await ctx.scheduler.runAfter(0, internalRef.songSearch.indexShow, { showId: list.showId });
        continue;
      }
      const show = await ctx.db.get(list.showId);
      if (!show) continue;
      await syncPerformances(ctx, show, list.actualSetlist);
      titles += list.actualSetlist.length;
      indexed++;
    }
    if (!page.isDone) await ctx.scheduler.runAfter(50, internalRef.songSearch.backfill, { ...args, cursor: page.continueCursor });
    return { indexed, done: page.isDone };
  },
});

export const search = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const key = songKey(args.query.trim().slice(0, 120));
    if (key.length < 2) return { results: [], refineQuery: false };
    const limit = Math.max(1, Math.min(20, args.limit ?? 10));
    // Exact titles use a B-tree and retrieve truly newest performances, independently of import order.
    const exact = await ctx.db.query("performedSongs").withIndex("by_song_key", q => q.eq("songKey", key)).first();
    const candidates = exact ? [exact] : await ctx.db.query("performedSongs")
      .withSearchIndex("search_title", q => q.search("songKey", key)).take(21);
    const performances = (await Promise.all(candidates.filter(song => matchesSearch(song.title, key)).slice(0, 20).map(song => ctx.db.query("songPerformances")
      .withIndex("by_song_date", q => q.eq("songId", song._id).lte("date", new Date().toISOString().slice(0, 10)))
      .order("desc").take(limit * 2)))).flat().sort((a, b) => b.date.localeCompare(a.date) || b._creationTime - a._creationTime);
    const seenShows = new Set<string>();
    const results = [];
    for (const performance of performances) {
      if (results.length >= limit) break;
      if (seenShows.has(performance.showId)) continue;
      seenShows.add(performance.showId);
      const show = await ctx.db.get(performance.showId);
      if (!show || show.status === "cancelled") continue;
      const [artist, venue] = await Promise.all([ctx.db.get(show.artistId), ctx.db.get(show.venueId)]);
      if (!artist || !venue) continue;
      results.push({ showId: show._id, slug: show.slug, songTitle: performance.title, date: show.date,
        artistName: artist.name, venueName: venue.name, city: venue.city, image: artist.images?.[0] });
    }
    return { results, refineQuery: !exact && candidates.length > 20 };
  },
});
