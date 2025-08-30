import { query, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";

export const getTrendingArtists = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    const artists = await ctx.db
      .query("artists")
      .order("desc")
      .take(limit);

    return artists;
  },
});

export const getTrendingShows = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "upcoming"))
      .order("desc")
      .take(limit);

    // Enrich with artist and venue data
    const enrichedShows = await Promise.all(
      shows.map(async (show) => {
        const [artist, venue] = await Promise.all([
          ctx.db.get(show.artistId),
          ctx.db.get(show.venueId),
        ]);

        return {
          ...show,
          artist,
          venue,
        };
      })
    );

    return enrichedShows;
  },
});

export const updateScores = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔄 Updating trending scores...");
    // Simple implementation for now
    return null;
  },
});