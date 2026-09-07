import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

async function getByIdIfType(ctx: any, key: string, requiredField: string) {
  try {
    const document = await ctx.db.get(key as any);
    return document && requiredField in document ? document : null;
  } catch {
    return null;
  }
}

export const getArtistPage = internalQuery({
  args: { key: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const artist =
      (await ctx.db.query("artists").withIndex("by_slug", (q) => q.eq("slug", args.key)).first()) ||
      (await getByIdIfType(ctx, args.key, "isActive"));
    if (!artist || !artist.isActive) return null;

    const [upcoming, completed, firstCatalogLink] = await Promise.all([
      ctx.db
        .query("shows")
        .withIndex("by_artist_status_and_date", (q) =>
          q.eq("artistId", artist._id).eq("status", "upcoming"),
        )
        .order("asc")
        .take(12),
      ctx.db
        .query("shows")
        .withIndex("by_artist_status_and_date", (q) =>
          q.eq("artistId", artist._id).eq("status", "completed"),
        )
        .order("desc")
        .take(8),
      ctx.db
        .query("artistSongs")
        .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
        .first(),
    ]);

    const hydrateShows = async (shows: any[]) =>
      Promise.all(
        shows.map(async (show) => ({
          ...show,
          venue: await ctx.db.get(show.venueId),
        })),
      );

    return {
      kind: "artist",
      artist,
      upcoming: await hydrateShows(upcoming),
      completed: await hydrateShows(completed),
      indexable: upcoming.length > 0 || completed.length > 0 || Boolean(firstCatalogLink),
      canonicalKey: artist.slug,
    };
  },
});

export const getShowPage = internalQuery({
  args: { key: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const show =
      (await ctx.db.query("shows").withIndex("by_slug", (q) => q.eq("slug", args.key)).first()) ||
      (await getByIdIfType(ctx, args.key, "artistId"));
    if (!show) return null;

    const [artist, venue, setlists, demand] = await Promise.all([
      ctx.db.get(show.artistId),
      ctx.db.get(show.venueId),
      ctx.db.query("setlists").withIndex("by_show", (q) => q.eq("showId", show._id)).take(25),
      ctx.db
        .query("showSongDemand")
        .withIndex("by_show_upvotes", (q) => q.eq("showId", show._id))
        .order("desc")
        .take(15),
    ]);
    if (!artist || !venue) return null;

    const official = setlists.find((setlist) => setlist.actualSetlist?.length) || null;
    const prediction =
      setlists.find((setlist) => !setlist.isOfficial && !setlist.userId && setlist.songs?.length) ||
      setlists.find((setlist) => !setlist.isOfficial && setlist.songs?.length) ||
      null;
    const actualSongs = official?.actualSetlist || [];
    const suggestedSongs = demand.length > 0 ? demand : prediction?.songs || [];
    const indexable =
      show.status === "upcoming" ||
      (show.status === "completed" && actualSongs.length >= 3);

    return {
      kind: "show",
      show,
      artist,
      venue,
      actualSongs,
      suggestedSongs,
      indexable,
      canonicalKey: show.slug || String(show._id),
    };
  },
});

export const getVenuePage = internalQuery({
  args: { key: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const venue =
      (await ctx.db.query("venues").withIndex("by_slug", (q) => q.eq("slug", args.key)).first()) ||
      (await getByIdIfType(ctx, args.key, "city"));
    if (!venue) return null;

    const [upcoming, completed] = await Promise.all([
      ctx.db
        .query("shows")
        .withIndex("by_venue_status_and_date", (q) =>
          q.eq("venueId", venue._id).eq("status", "upcoming"),
        )
        .order("asc")
        .take(12),
      ctx.db
        .query("shows")
        .withIndex("by_venue_status_and_date", (q) =>
          q.eq("venueId", venue._id).eq("status", "completed"),
        )
        .order("desc")
        .take(8),
    ]);
    const hydrateShows = (shows: any[]) =>
      Promise.all(
        shows.map(async (show) => ({
          ...show,
          artist: await ctx.db.get(show.artistId),
        })),
      );
    return {
      kind: "venue",
      venue,
      upcoming: await hydrateShows(upcoming),
      completed: await hydrateShows(completed),
      indexable: upcoming.length > 0 || completed.length > 0,
      canonicalKey: venue.slug || String(venue._id),
    };
  },
});
