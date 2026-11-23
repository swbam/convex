import { getUserPredictionStats } from "./lib/songVoteCounts";
import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Get user leaderboard based on voting accuracy and activity
export const getUserLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    scope: v.literal("recent_250_votes"),
    evaluatedVotes: v.number(),
    userId: v.id("users"),
    username: v.string(),
    totalVotes: v.number(),
    accurateVotes: v.number(),
    accuracyPercentage: v.union(v.number(), v.null()),
    totalSetlists: v.number(),
    score: v.number(),
    rank: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 50));
    const votes = await ctx.db.query("songVotes").withIndex("by_created_at").order("desc").take(250);
    const setlists = await ctx.db.query("setlists").order("desc").take(250);
    const userIds = [...new Set(votes.map(vote => vote.userId))];
    const rows = [];
    for (const candidate of userIds) {
      const userId = ctx.db.normalizeId("users", candidate);
      if (!userId) continue;
      const user = await ctx.db.get(userId);
      if (!user) continue;
      const ownVotes = votes.filter(vote => vote.userId === userId);
      const stats = await getUserPredictionStats(ctx, ownVotes);
      rows.push({
        scope: "recent_250_votes" as const,
        userId, username: user.username, totalVotes: ownVotes.length,
        accurateVotes: stats.correct, evaluatedVotes: stats.evaluated,
        accuracyPercentage: stats.accuracy === null ? null : Math.round(stats.accuracy * 100),
        totalSetlists: setlists.filter(list => list.userId === userId).length,
        score: Math.round(Math.min(50, ownVotes.length * 2) + (stats.evaluated >= 5 ? (stats.accuracy ?? 0) * 50 : 0)),
      });
    }
    return rows.sort((a, b) => b.score - a.score).slice(0, limit).map((row, index) => ({ ...row, rank: index + 1 }));
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
        
        // OPTIMIZED: Use pre-aggregated counts only (cron jobs keep these updated)
        // Removed N+1 query fallback - rely on aggregates populated by trending cron
        let totalSetlists = 0;
        let totalVotes = 0;

        // Sum pre-aggregated counts from shows
          totalSetlists = shows.reduce((sum, s) => sum + (s.setlistCount || 0), 0);
          totalVotes = shows.reduce((sum, s) => sum + (s.voteCount || 0), 0);
        
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

// DEPRECATED: Trending scores are now calculated in trending.ts
// This function is kept for backward compatibility but should not be used