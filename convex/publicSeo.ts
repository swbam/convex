import { resolveShowKey } from "./lib/showTickets";
import { festivalView } from "./lib/festivalMedia";
import { isFestivalListed } from "./lib/festivalIdentity";
import { selectOfficialSetlist } from "./lib/officialSetlist";
import { internalQuery } from "./_generated/server";
import { isShowIndexable } from "./seoEligibility";
import { v } from "convex/values";

async function getByIdIfType(ctx: any, key: string, table: "artists" | "shows" | "venues") {
  try {
    const id = ctx.db.normalizeId(table, key);
    return id ? await ctx.db.get(id) : null;
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
      (await getByIdIfType(ctx, args.key, "artists"));
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
    const show = await resolveShowKey(ctx, args.key);
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

    const official = selectOfficialSetlist(setlists);
    const prediction =
      setlists.find((setlist) => !setlist.isOfficial && !setlist.userId && setlist.songs?.length) ||
      setlists.find((setlist) => !setlist.isOfficial && setlist.songs?.length) ||
      null;
    const actualSongs = official?.actualSetlist || [];
    const requests = demand.filter((song) => song.upvotes > 0);
    const suggestedSongs = requests.length > 0 ? requests : prediction?.songs || [];
    const indexable =
      isShowIndexable(show.status, actualSongs.length);

    return {
      kind: "show",
      show,
      artist,
      venue,
      actualSongs,
      suggestedSongs,
      hasFanRequests: requests.length > 0,
      indexable,
      canonicalKey: show.canonicalKey,
    };
  },
});

export const getVenuePage = internalQuery({
  args: { key: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const venue =
      (await ctx.db.query("venues").withIndex("by_slug", (q) => q.eq("slug", args.key)).first()) ||
      (await getByIdIfType(ctx, args.key, "venues"));
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

export const getFestivalPage = internalQuery({
  args: { key: v.string() }, returns: v.any(),
  handler: async (ctx, { key }) => {
    const festival = await ctx.db.query("festivals").withIndex("by_slug", q => q.eq("slug", key)).first();
    if (!festival || !isFestivalListed(festival)) return null;
    const shows = await ctx.db.query("shows").withIndex("by_festival", q => q.eq("festivalId", festival._id)).take(40);
    const roster = await ctx.db.query("festivalLineupEntries").withIndex("by_festival", q => q.eq("festivalId", festival._id)).take(500);
    return { roster, kind: "festival", festival: festivalView(festival), shows: await Promise.all(shows.map(async show => ({ ...show, artist: await ctx.db.get(show.artistId) }))) };
  },
});
export const getBrowsePage = internalQuery({
  args: { path: v.string() }, returns: v.any(),
  handler: async (ctx, { path }) => {
    if (path === "/festivals") return { festivals: (await ctx.db.query("festivals").withIndex("by_discovery_end", q => q.eq("discoveryState", "listed").gte("endDate", new Date().toISOString().slice(0,10))).take(30)).map(festivalView) };
    if (path === "/shows") {
      const shows = await ctx.db.query("shows").withIndex("by_status_and_date", q => q.eq("status", "upcoming")).take(24);
      return { shows: await Promise.all(shows.map(async show => ({ ...show, artist: await ctx.db.get(show.artistId), venue: await ctx.db.get(show.venueId) }))) };
    }
    return { artists: (await ctx.db.query("artists").withIndex("by_trending_score").order("desc").take(32)).filter(artist => artist.isActive).slice(0, 24) };
  },
});
