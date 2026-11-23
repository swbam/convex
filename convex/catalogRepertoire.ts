import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalRef } from "./adminHelpers";
import type { Doc, Id } from "./_generated/dataModel";
import { songKey } from "./lib/predictions";

// A performance is evidence that a song can be requested, not that the artist
// released a studio recording. Keep that provenance on the artist relationship.
async function mergeShow(ctx: MutationCtx, show: Doc<"shows">) {
  const lists = await ctx.db.query("setlists").withIndex("by_show", q => q.eq("showId", show._id)).collect();
  const official = lists.filter(s => s.isOfficial && s.setlistfmId && s.actualSetlist?.length)
    .sort((a, b) => (b.lastUpdated ?? b._creationTime) - (a.lastUpdated ?? a._creationTime))[0];
  if (!official) return 0;
  const links = await ctx.db.query("artistSongs").withIndex("by_artist", q => q.eq("artistId", show.artistId)).take(1001);
  if (links.length > 1000) return 0;
  const keys = new Set<string>();
  for (const link of links) {
    const song = await ctx.db.get(link.songId);
    if (song) keys.add(songKey(song.title));
  }
  let added = 0;
  for (const song of official.actualSetlist!.slice(0, 150)) {
    const title = song.title.trim();
    const key = songKey(title);
    // Do not turn multi-song medleys into a single catalog song.
    if (!key || keys.has(key) || title.includes(" / ") || title.length > 200) continue;
    const songId = await ctx.db.insert("songs", { title, isLive: false, isRemix: false });
    await ctx.db.insert("artistSongs", {
      artistId: show.artistId, songId, isPrimaryArtist: false,
      source: "setlistfm", sourceSetlistId: official._id,
    });
    keys.add(key);
    added++;
  }
  return added;
}

export const mergeFromShow = internalMutation({
  args: { showId: v.id("shows") },
  handler: async (ctx, { showId }) => {
    const show = await ctx.db.get(showId);
    return show ? mergeShow(ctx, show) : 0;
  },
});

async function startHead(ctx: MutationCtx, id: Id<"repertoireMergeJobs">) {
  const scheduledId = await ctx.scheduler.runAfter(0, internalRef.catalogRepertoire.processHead, { id });
  await ctx.db.patch(id, { scheduledId });
}

// A burst of history imports for one artist shares one serial worker.
export async function queueRepertoireMerge(ctx: MutationCtx, show: Doc<"shows">) {
  const existing = await ctx.db.query("repertoireMergeJobs").withIndex("by_show", q => q.eq("showId", show._id)).unique();
  if (existing) return;
  const head = await ctx.db.query("repertoireMergeJobs").withIndex("by_artist", q => q.eq("artistId", show.artistId)).first();
  const id = await ctx.db.insert("repertoireMergeJobs", { showId: show._id, artistId: show.artistId });
  if (!head) await startHead(ctx, id);
}

export const processHead = internalMutation({
  args: { id: v.id("repertoireMergeJobs") }, returns: v.null(),
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (!job) return null;
    const show = await ctx.db.get(job.showId);
    if (show) await mergeShow(ctx, show);
    await ctx.db.delete(id);
    const next = await ctx.db.query("repertoireMergeJobs").withIndex("by_artist", q => q.eq("artistId", job.artistId)).first();
    if (next) await startHead(ctx, next._id);
    return null;
  },
});

export const recoverQueues = internalMutation({
  args: { cursor: v.optional(v.string()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const heads = await ctx.db.query("repertoireMergeJobs").withIndex("by_scheduled", q =>
      q.gt("scheduledId", undefined)).paginate({ cursor: args.cursor ?? null, numItems: 100 });
    for (const head of heads.page) {
      const task = await ctx.db.system.get(head.scheduledId!);
      if (!task || task.state.kind === "failed" || task.state.kind === "canceled") await startHead(ctx, head._id);
    }
    if (!heads.isDone) await ctx.scheduler.runAfter(0, internalRef.catalogRepertoire.recoverQueues, { cursor: heads.continueCursor });
    return null;
  },
});

// Bounded, idempotent repair using existing verified provider imports. No API calls.
export const backfillArtist = internalMutation({
  args: { artistId: v.id("artists") },
  handler: async (ctx, { artistId }) => {
    const shows = await ctx.db.query("shows").withIndex("by_artist_status_and_date", q =>
      q.eq("artistId", artistId).eq("status", "completed")).order("desc").take(30);
    let added = 0;
    for (const show of shows) added += await mergeShow(ctx, show);
    return { showsChecked: shows.length, added };
  },
});

// Batch writes preserve existing song IDs and votes, and are safe to retry.
export const mergeSpotifyTracks = internalMutation({
  args: {
    artistId: v.id("artists"),
    tracks: v.array(v.object({
      title: v.string(), album: v.string(), spotifyId: v.string(),
      sourceArtistName: v.string(), sourceSpotifyArtistId: v.string(), sourceTrackTitle: v.string(),
    })),
  },
  handler: async (ctx, { artistId, tracks }) => {
    if (tracks.length > 200) throw new Error("Catalog batch exceeds 200 tracks");
    if (!await ctx.db.get(artistId)) throw new Error("Artist not found");
    const links = await ctx.db.query("artistSongs").withIndex("by_artist", q => q.eq("artistId", artistId)).take(5001);
    if (links.length > 5000) throw new Error("Catalog requires paginated maintenance");
    const keys = new Set<string>();
    for (const link of links) {
      const song = await ctx.db.get(link.songId);
      if (song && !song.isLive && !song.isRemix) keys.add(songKey(song.title));
    }
    let added = 0;
    for (const track of tracks) {
      const key = songKey(track.title);
      if (!key || keys.has(key)) continue;
      // These are requestable compositions; sourceTrackTitle retains the actual
      // recording title, including its live/acoustic designation.
      const songId = await ctx.db.insert("songs", {
        title: track.title, album: track.album, spotifyId: track.spotifyId, isLive: false, isRemix: false,
      });
      await ctx.db.insert("artistSongs", {
        artistId, songId, isPrimaryArtist: false, source: "spotify_repertoire",
        sourceArtistName: track.sourceArtistName, sourceSpotifyArtistId: track.sourceSpotifyArtistId,
        sourceTrackTitle: track.sourceTrackTitle,
      });
      keys.add(key); added++;
    }
    return { processed: tracks.length, added };
  },
});
