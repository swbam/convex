import { query } from "./_generated/server";
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


