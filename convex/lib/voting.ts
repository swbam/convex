import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { hasVotingClosed } from "./showTiming";
import { songKey } from "./predictions";

export async function requireOpenShow(ctx: QueryCtx, showId: Id<"shows">) {
  const show = await ctx.db.get(showId);
  if (!show) throw new Error("Show not found");
  if (show.status !== "upcoming" || hasVotingClosed(show)) throw new Error("Voting is closed for this show");
  const official = await ctx.db.query("setlists").withIndex("by_show", q => q.eq("showId", showId))
    .filter(q => q.eq(q.field("isOfficial"), true)).first();
  if (official) throw new Error("Voting is closed for this show");
  return show;
}

export async function validateCatalogSong(ctx: QueryCtx, artistId: Id<"artists">, song: { title: string; songId?: Id<"songs"> }) {
  if (!song.songId) throw new Error("Choose a song from the artist catalog");
  const [record, link] = await Promise.all([
    ctx.db.get(song.songId),
    ctx.db.query("artistSongs").withIndex("by_artist_and_song", q => q.eq("artistId", artistId).eq("songId", song.songId!)).first(),
  ]);
  if (!record || !link || songKey(record.title) !== songKey(song.title)) throw new Error("Song does not belong to this artist's catalog");
  return { title: record.title, songId: record._id, album: record.album, duration: record.durationMs };
}
