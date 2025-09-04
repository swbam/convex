import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./auth";
import { Id } from "./_generated/dataModel";

// Get user's voting activity with detailed stats
export const getUserVotingStats = query({
  args: { 
    userId: v.optional(v.id("users")),
    timeframe: v.optional(v.union(v.literal("week"), v.literal("month"), v.literal("all")))
  },
  returns: v.object({
    totalVotes: v.number(),
    uniqueShows: v.number(),
    uniqueArtists: v.number(),
    favoriteArtists: v.array(v.object({
      artistId: v.id("artists"),
      artistName: v.string(),
      voteCount: v.number(),
    })),
    recentActivity: v.array(v.object({
      date: v.string(),
      votes: v.number(),
    })),
    accuracy: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = args.userId || await getAuthUserId(ctx);
    if (!userId) {
      return {
        totalVotes: 0,
        uniqueShows: 0,
        uniqueArtists: 0,
        favoriteArtists: [],
        recentActivity: [],
        accuracy: 0,
      };
    }

    const timeframe = args.timeframe || "all";
    let timeFilter = 0;
    
    if (timeframe === "week") {
      timeFilter = Date.now() - (7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "month") {
      timeFilter = Date.now() - (30 * 24 * 60 * 60 * 1000);
    }

    // Get user's votes
    const allVotes = await ctx.db
      .query("songVotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const votes = timeFilter > 0 
      ? allVotes.filter(v => v.createdAt > timeFilter)
      : allVotes;

    // Get unique shows and artists
    const uniqueSetlistIds = new Set(votes.map(v => v.setlistId));
    const setlists = await Promise.all(
      Array.from(uniqueSetlistIds).map(id => ctx.db.get(id))
    );
    
    const validSetlists = setlists.filter(s => s !== null);
    const uniqueShowIds = new Set(validSetlists.map(s => s.showId));
    
    const shows = await Promise.all(
      Array.from(uniqueShowIds).map(id => ctx.db.get(id))
    );
    
    const validShows = shows.filter(s => s !== null);
    const uniqueArtistIds = new Set(validShows.map(s => s.artistId));

    // Calculate favorite artists
    const artistVoteCounts = new Map<Id<"artists">, number>();
    
    for (const show of validShows) {
      const showVotes = votes.filter(v => {
        const setlist = validSetlists.find(s => s._id === v.setlistId);
        return setlist && setlist.showId === show._id;
      });
      
      const currentCount = artistVoteCounts.get(show.artistId) || 0;
      artistVoteCounts.set(show.artistId, currentCount + showVotes.length);
    }

    const favoriteArtists = await Promise.all(
      Array.from(artistVoteCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(async ([artistId, voteCount]) => {
          const artist = await ctx.db.get(artistId);
          return {
            artistId,
            artistName: artist?.name || "Unknown",
            voteCount,
          };
        })
    );

    // Calculate recent activity (last 30 days)
    const recentActivity = [];
    const now = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayStart = date.setHours(0, 0, 0, 0);
      const dayEnd = date.setHours(23, 59, 59, 999);
      
      const dayVotes = allVotes.filter(v => 
        v.createdAt >= dayStart && v.createdAt <= dayEnd
      ).length;
      
      if (dayVotes > 0 || i < 7) { // Show last 7 days even if no votes
        recentActivity.unshift({
          date: dateStr,
          votes: dayVotes,
        });
      }
    }

    return {
      totalVotes: votes.length,
      uniqueShows: uniqueShowIds.size,
      uniqueArtists: uniqueArtistIds.size,
      favoriteArtists,
      recentActivity: recentActivity.slice(0, 30),
      accuracy: votes.length > 0 ? Math.floor(Math.random() * 30) + 70 : 0, // Placeholder
    };
  },
});

// Get community leaderboard
export const getCommunityLeaderboard = query({
  args: { 
    type: v.union(v.literal("votes"), v.literal("accuracy"), v.literal("setlists")),
    limit: v.optional(v.number()) 
  },
  returns: v.array(v.object({
    _id: v.id("users"),
    username: v.string(),
    avatar: v.optional(v.string()),
    score: v.number(),
    rank: v.number(),
    badge: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const users = await ctx.db.query("users").collect();
    
    const userStats = await Promise.all(
      users.map(async (user) => {
        let score = 0;
        
        if (args.type === "votes") {
          const votes = await ctx.db
            .query("songVotes")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();
          score = votes.length;
        } else if (args.type === "setlists") {
          const setlists = await ctx.db
            .query("setlists")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();
          score = setlists.length;
        } else if (args.type === "accuracy") {
          // Placeholder accuracy calculation
          score = Math.floor(Math.random() * 100);
        }
        
        // Assign badges based on performance
        let badge;
        if (score >= 100) badge = "🏆 Champion";
        else if (score >= 50) badge = "🥇 Expert";
        else if (score >= 20) badge = "🥈 Pro";
        else if (score >= 10) badge = "🥉 Rising";
        
        return {
          _id: user._id,
          username: user.username,
          avatar: user.avatar,
          score,
          badge,
        };
      })
    );
    
    return userStats
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((user, index) => ({
        ...user,
        rank: index + 1,
      }));
  },
});