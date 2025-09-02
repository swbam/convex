import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Get user leaderboard based on voting accuracy and activity
export const getUserLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    userId: v.id("users"),
    username: v.string(),
    totalVotes: v.number(),
    accurateVotes: v.number(),
    accuracyPercentage: v.number(),
    totalSetlists: v.number(),
    score: v.number(),
    rank: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    // Get all users with their voting stats
    const users = await ctx.db.query("users").collect();
    const userStats = await Promise.all(
      users.map(async (user) => {
        // Get user's votes
        const votes = await ctx.db
          .query("votes")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
        
        const totalVotes = votes.length;
        const accurateVotes = votes.filter(v => v.voteType === "accurate").length;
        const accuracyPercentage = totalVotes > 0 ? (accurateVotes / totalVotes) * 100 : 0;
        
        // Get user's setlists
        const setlists = await ctx.db
          .query("setlists")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
        
        // Calculate score: accuracy weight + activity weight
        const activityScore = Math.min(50, totalVotes * 2); // Max 50 points for activity
        const accuracyScore = totalVotes >= 5 ? accuracyPercentage * 0.5 : 0; // Only count accuracy after 5+ votes
        const setlistScore = Math.min(25, setlists.length * 5); // Max 25 points for setlists
        const score = Math.round(activityScore + accuracyScore + setlistScore);
        
        return {
          userId: user._id,
          username: user.username,
          totalVotes,
          accurateVotes,
          accuracyPercentage: Math.round(accuracyPercentage),
          totalSetlists: setlists.length,
          score,
        };
      })
    );
    
    // Sort by score and add ranks
    const sortedStats = userStats
      .filter(stat => stat.totalVotes > 0) // Only include users who have voted
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((stat, index) => ({
        ...stat,
        rank: index + 1,
      }));
    
    return sortedStats;
  },
});

// Get artist leaderboard based on trending scores and activity
export const getArtistLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    artistId: v.id("artists"),
    name: v.string(),
    slug: v.string(),
    trendingScore: v.number(),
    totalShows: v.number(),
    totalSetlists: v.number(),
    totalVotes: v.number(),
    followers: v.optional(v.number()),
    popularity: v.optional(v.number()),
    rank: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    // Get all active artists with their activity stats
    const artists = await ctx.db
      .query("artists")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const artistStats = await Promise.all(
      artists.map(async (artist) => {
        // Get artist's shows
        const shows = await ctx.db
          .query("shows")
          .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
          .collect();
        
        // Get setlists for artist's shows
        let totalSetlists = 0;
        let totalVotes = 0;
        
        for (const show of shows) {
          const setlists = await ctx.db
            .query("setlists")
            .withIndex("by_show", (q) => q.eq("showId", show._id))
            .collect();
          
          totalSetlists += setlists.length;
          
          for (const setlist of setlists) {
            const votes = await ctx.db
              .query("votes")
              .withIndex("by_setlist", (q) => q.eq("setlistId", setlist._id))
              .collect();
            totalVotes += votes.length;
          }
        }
        
        return {
          artistId: artist._id,
          name: artist.name,
          slug: artist.slug,
          trendingScore: artist.trendingScore || 0,
          totalShows: shows.length,
          totalSetlists,
          totalVotes,
          followers: artist.followers,
          popularity: artist.popularity,
        };
      })
    );
    
    // Sort by trending score and add ranks
    const sortedStats = artistStats
      .filter(stat => stat.trendingScore > 0 || stat.totalVotes > 0)
      .sort((a, b) => {
        // Primary sort: trending score
        if (b.trendingScore !== a.trendingScore) {
          return b.trendingScore - a.trendingScore;
        }
        // Secondary sort: total votes
        if (b.totalVotes !== a.totalVotes) {
          return b.totalVotes - a.totalVotes;
        }
        // Tertiary sort: followers
        return (b.followers || 0) - (a.followers || 0);
      })
      .slice(0, limit)
      .map((stat, index) => ({
        ...stat,
        rank: index + 1,
      }));
    
    return sortedStats;
  },
});

// DEPRECATED: Trending scores are now calculated in trending_v2.ts
// This function is kept for backward compatibility but should not be used