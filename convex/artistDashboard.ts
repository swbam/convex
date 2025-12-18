import { query } from "./_generated/server";
import { v } from "convex/values";

async function getCurrentAppUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q: any) => q.eq("authId", identity.subject))
    .first();
}

async function requireArtistMember(ctx: any, artistId: any) {
  const user = await getCurrentAppUser(ctx);
  if (!user) throw new Error("Must be logged in");
  const membership = await ctx.db
    .query("artistMembers")
    .withIndex("by_user_artist", (q: any) => q.eq("userId", user._id).eq("artistId", artistId))
    .first();
  if (!membership) throw new Error("Artist access required");
  return { user, membership };
}

const parseDate = (dateString?: string) => new Date(dateString || "");

export const getArtistHome = query({
  args: { artistId: v.id("artists") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireArtistMember(ctx, args.artistId);

    const artist = await ctx.db.get(args.artistId);
    if (!artist) throw new Error("Artist not found");

    const upcoming = await ctx.db
      .query("shows")
      .withIndex("by_artist_and_status", (q) => q.eq("artistId", args.artistId).eq("status", "upcoming"))
      .order("asc")
      .take(100);

    const hydrated = await Promise.all(
      upcoming.map(async (s: any) => {
        const venue = await ctx.db.get(s.venueId);
        return { ...s, venue };
      }),
    );

    const shows = hydrated
      .filter((s: any) => !!s.venue)
      .sort((a: any, b: any) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

    return { artist, shows };
  },
});

function normalizeSongKey(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const getShowDemand = query({
  args: { showId: v.id("shows") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.showId);
    if (!show) throw new Error("Show not found");

    await requireArtistMember(ctx, show.artistId);

    const [artist, venue] = await Promise.all([ctx.db.get(show.artistId), ctx.db.get(show.venueId)]);

    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .collect();

    const prediction =
      setlists.find((s: any) => !s.isOfficial && !s.userId) ??
      setlists.find((s: any) => !s.isOfficial) ??
      null;

    const predictedTitles = Array.isArray(prediction?.songs)
      ? (prediction!.songs as any[])
          .map((s) => (typeof s === "string" ? s : s?.title))
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : [];

    const predictedSet = new Set(predictedTitles.map((t) => normalizeSongKey(t)));

    const demandRows = await ctx.db
      .query("showSongDemand")
      .withIndex("by_show_upvotes", (q) => q.eq("showId", args.showId))
      .order("desc")
      .take(250);

    const demandByKey = new Map<string, any>();
    for (const row of demandRows) {
      demandByKey.set(row.songKey, row);
    }

    const merged: Array<{
      songKey: string;
      songTitle: string;
      upvotes: number;
      inPrediction: boolean;
      lastVoteAt?: number;
    }> = [];

    // First: voted songs (descending), include whether they are already in prediction.
    for (const row of demandRows) {
      merged.push({
        songKey: row.songKey,
        songTitle: row.songTitle,
        upvotes: row.upvotes,
        inPrediction: predictedSet.has(row.songKey),
        lastVoteAt: row.lastVoteAt,
      });
    }

    // Then: prediction songs with 0 votes (so artists see the full predicted list).
    for (const title of predictedTitles) {
      const key = normalizeSongKey(title);
      if (demandByKey.has(key)) continue;
      merged.push({
        songKey: key,
        songTitle: title,
        upvotes: 0,
        inPrediction: true,
      });
    }

    return {
      show: { ...show, artist, venue },
      predictionSetlistId: prediction?._id ?? null,
      songs: merged,
    };
  },
});

