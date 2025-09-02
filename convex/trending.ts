import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Backward-compatibility shim for older clients expecting `trending`.
// Re-implements the current logic from `trending.ts` so queries can run directly.

export const getTrendingShows = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    const shows = await ctx.db
      .query("trendingShows")
      .withIndex("by_last_updated")
      .order("desc")
      .take(limit * 2);

    const enrichedShows = await Promise.all(
      shows.map(async (show) => {
        if (show.artistId) {
          const artist = await ctx.db.get(show.artistId);
          if (artist) {
            return {
              ...show,
              artist: {
                _id: artist._id,
                name: artist.name,
                slug: artist.slug,
                images: artist.images,
                genres: artist.genres,
              },
            };
          }
        }
        return show;
      })
    );

    const sortedShows = enrichedShows
      .sort((a, b) => {
        const aHasPrice = a.priceRange ? 1 : 0;
        const bHasPrice = b.priceRange ? 1 : 0;
        if (aHasPrice !== bHasPrice) return bHasPrice - aHasPrice;

        const aIsStadium = /stadium|arena|center|amphitheatre|pavilion/i.test(a.venueName) ? 1 : 0;
        const bIsStadium = /stadium|arena|center|amphitheatre|pavilion/i.test(b.venueName) ? 1 : 0;
        if (aIsStadium !== bIsStadium) return bIsStadium - aIsStadium;

        return b.lastUpdated - a.lastUpdated;
      })
      .slice(0, limit);

    return sortedShows;
  },
});

export const getTrendingArtists = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    const artists = await ctx.db
      .query("trendingArtists")
      .withIndex("by_last_updated")
      .order("desc")
      .take(limit * 2);

    const majorArtists = [
      "taylor swift",
      "beyonce",
      "drake",
      "ed sheeran",
      "coldplay",
      "imagine dragons",
      "billie eilish",
      "the weeknd",
      "bruno mars",
      "ariana grande",
      "post malone",
      "dua lipa",
      "bad bunny",
      "harry styles",
      "olivia rodrigo",
      "travis scott",
      "kanye west",
      "eminem",
      "rihanna",
      "justin bieber",
      "lady gaga",
      "adele",
    ];

    const sortedArtists = artists
      .sort((a, b) => {
        const aEvents = a.upcomingEvents || 0;
        const bEvents = b.upcomingEvents || 0;
        if (aEvents !== bEvents) return bEvents - aEvents;

        const aIsMajor = majorArtists.some((major) => a.name.toLowerCase().includes(major)) ? 1 : 0;
        const bIsMajor = majorArtists.some((major) => b.name.toLowerCase().includes(major)) ? 1 : 0;
        if (aIsMajor !== bIsMajor) return bIsMajor - aIsMajor;

        return b.lastUpdated - a.lastUpdated;
      })
      .slice(0, limit);

    return sortedArtists;
  },
});

// Calculate and cache supporting fields used for trending.
export const updateArtistShowCounts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const artists = await ctx.db.query("artists").collect();
    for (const artist of artists) {
      const upcomingShows = await ctx.db
        .query("shows")
        .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
        .filter((q) => q.eq(q.field("status"), "upcoming"))
        .collect();

      await ctx.db.patch(artist._id, {
        upcomingShowsCount: upcomingShows.length,
        lastTrendingUpdate: Date.now(),
      });
    }
    return null;
  },
});

// Update artist trending scores and ranks based on simple heuristics.
export const updateArtistTrending = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const artists = await ctx.db.query("artists").collect();
    const scored = artists.map((a) => ({
      artist: a,
      score: (a.upcomingShowsCount || 0) + Math.floor((a.followers || 0) / 1_000_000),
    }));

    scored.sort((a, b) => b.score - a.score);

    const TOP_N = 100;
    for (let i = 0; i < scored.length; i += 1) {
      const { artist, score } = scored[i];
      await ctx.db.patch(artist._id, {
        trendingScore: score,
        trendingRank: i < TOP_N ? i + 1 : undefined,
        lastTrendingUpdate: Date.now(),
      });
    }
    return null;
  },
});

// Update show trending ranks (simple ordering: soonest upcoming first).
export const updateShowTrending = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const upcoming = await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "upcoming"))
      .collect();

    const parsed = upcoming.map((s) => ({
      show: s,
      when: new Date(s.date).getTime(),
    }));
    parsed.sort((a, b) => a.when - b.when);

    const TOP_N = 200;
    for (let i = 0; i < parsed.length; i += 1) {
      const { show } = parsed[i];
      await ctx.db.patch(show._id, {
        trendingRank: i < TOP_N ? i + 1 : undefined,
        lastTrendingUpdate: Date.now(),
      });
    }
    return null;
  },
});
