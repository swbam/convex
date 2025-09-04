import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./auth";
import { Id } from "./_generated/dataModel";

// Follow/unfollow an artist
export const toggleArtistFollow = mutation({
  args: { artistId: v.id("artists") },
  returns: v.object({
    success: v.boolean(),
    isFollowing: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to follow artists");
    }

    // Check if artist exists
    const artist = await ctx.db.get(args.artistId);
    if (!artist) {
      throw new Error("Artist not found");
    }

    // Check if already following
    const existingFollow = await ctx.db
      .query("userFollows")
      .withIndex("by_user_and_artist", (q) => 
        q.eq("userId", userId).eq("artistId", args.artistId)
      )
      .first();

    if (existingFollow) {
      // Unfollow
      await ctx.db.delete(existingFollow._id);
      return {
        success: true,
        isFollowing: false,
        message: `Unfollowed ${artist.name}`,
      };
    } else {
      // Follow
      await ctx.db.insert("userFollows", {
        userId,
        artistId: args.artistId,
        createdAt: Date.now(),
      });
      return {
        success: true,
        isFollowing: true,
        message: `Now following ${artist.name}`,
      };
    }
  },
});

// Get user's followed artists with show counts
export const getFollowedArtists = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    _id: v.id("userFollows"),
    artist: v.any(),
    followedAt: v.number(),
    upcomingShowsCount: v.number(),
    totalShowsCount: v.number(),
    hasNewShows: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const limit = args.limit || 50;

    const follows = await ctx.db
      .query("userFollows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    const followsWithDetails = await Promise.all(
      follows.map(async (follow) => {
        const artist = await ctx.db.get(follow.artistId);
        if (!artist) return null;

        // Count shows for this artist
        const shows = await ctx.db
          .query("shows")
          .withIndex("by_artist", (q) => q.eq("artistId", follow.artistId))
          .collect();

        const upcomingShows = shows.filter(s => s.status === "upcoming");
        
        // Check if there are new shows since last visit (simplified)
        const hasNewShows = upcomingShows.length > 0 && 
          upcomingShows.some(s => s._creationTime > follow.createdAt);

        return {
          _id: follow._id,
          artist,
          followedAt: follow.createdAt,
          upcomingShowsCount: upcomingShows.length,
          totalShowsCount: shows.length,
          hasNewShows,
        };
      })
    );

    return followsWithDetails.filter(f => f !== null);
  },
});

// Check if user is following specific artists
export const getFollowStatus = query({
  args: { artistIds: v.array(v.id("artists")) },
  returns: v.record(v.id("artists"), v.boolean()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      const result: Record<Id<"artists">, boolean> = {};
      args.artistIds.forEach(id => result[id] = false);
      return result;
    }

    const follows = await ctx.db
      .query("userFollows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const followedArtistIds = new Set(follows.map(f => f.artistId));
    const result: Record<Id<"artists">, boolean> = {};
    
    args.artistIds.forEach(id => {
      result[id] = followedArtistIds.has(id);
    });

    return result;
  },
});

// Get artist followers count and recent followers
export const getArtistFollowers = query({
  args: { 
    artistId: v.id("artists"),
    limit: v.optional(v.number()) 
  },
  returns: v.object({
    totalFollowers: v.number(),
    recentFollowers: v.array(v.object({
      _id: v.id("users"),
      username: v.string(),
      avatar: v.optional(v.string()),
      followedAt: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const follows = await ctx.db
      .query("userFollows")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .collect();

    const recentFollows = follows
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    const recentFollowers = await Promise.all(
      recentFollows.map(async (follow) => {
        const user = await ctx.db.get(follow.userId);
        if (!user) return null;

        return {
          _id: user._id,
          username: user.username,
          avatar: user.avatar,
          followedAt: follow.createdAt,
        };
      })
    );

    return {
      totalFollowers: follows.length,
      recentFollowers: recentFollowers.filter(f => f !== null),
    };
  },
});

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