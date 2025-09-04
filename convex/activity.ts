import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./auth";
import { Id } from "./_generated/dataModel";

// Get comprehensive user activity feed
export const getUserActivityFeed = query({
  args: { 
    limit: v.optional(v.number()),
    offset: v.optional(v.number())
  },
  returns: v.array(v.object({
    _id: v.string(),
    type: v.union(
      v.literal("song_vote"),
      v.literal("setlist_created"),
      v.literal("show_attended")
    ),
    timestamp: v.number(),
    data: v.any(),
    showId: v.optional(v.id("shows")),
    artistId: v.optional(v.id("artists")),
    setlistId: v.optional(v.id("setlists")),
  })),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const limit = args.limit || 20;
    const offset = args.offset || 0;
    
    const activities: any[] = [];
    
    // Get recent song votes
    const votes = await ctx.db
      .query("songVotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    
    for (const vote of votes) {
      // Get setlist details
      const setlist = await ctx.db.get(vote.setlistId);
      if (setlist) {
        const show = await ctx.db.get(setlist.showId);
        if (show) {
          const [artist, venue] = await Promise.all([
            ctx.db.get(show.artistId),
            ctx.db.get(show.venueId)
          ]);
          
          activities.push({
            _id: `vote_${vote._id}`,
            type: "song_vote",
            timestamp: vote.createdAt,
            data: {
              songTitle: vote.songTitle,
              artistName: artist?.name,
              venueName: venue?.name,
              showDate: show.date,
            },
            showId: show._id,
            artistId: show.artistId,
            setlistId: vote.setlistId,
          });
        }
      }
    }
    
    // Get user's created setlists
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);
    
    for (const setlist of setlists) {
      const show = await ctx.db.get(setlist.showId);
      if (show) {
        const [artist, venue] = await Promise.all([
          ctx.db.get(show.artistId),
          ctx.db.get(show.venueId)
        ]);
        
        activities.push({
          _id: `setlist_${setlist._id}`,
          type: "setlist_created",
          timestamp: setlist.lastUpdated,
          data: {
            songsCount: setlist.songs.length,
            artistName: artist?.name,
            venueName: venue?.name,
            showDate: show.date,
            isVerified: setlist.verified,
          },
          showId: show._id,
          artistId: show.artistId,
          setlistId: setlist._id,
        });
      }
    }
    
    // Note: Artist following removed as per user request
    
    // Sort by timestamp and apply pagination
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(offset, offset + limit);
  },
});

// Get user activity statistics
export const getUserActivityStats = query({
  args: {},
  returns: v.object({
    totalVotes: v.number(),
    totalSetlists: v.number(),
    recentVotes: v.number(),
    accuracy: v.number(),
    streak: v.number(),
    rank: v.number(),
    joinedAt: v.number(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        totalVotes: 0,
        totalSetlists: 0,
        recentVotes: 0,
        accuracy: 0,
        streak: 0,
        rank: 0,
        joinedAt: 0,
      };
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return {
        totalVotes: 0,
        totalSetlists: 0,
        recentVotes: 0,
        accuracy: 0,
        streak: 0,
        rank: 0,
        joinedAt: 0,
      };
    }

    // Get vote statistics
    const votes = await ctx.db
      .query("songVotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    // Note: Following removed as per user request
    
    // Calculate recent activity (last 7 days)
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentVotes = votes.filter(v => v.createdAt > weekAgo).length;
    
    // Calculate accuracy (simplified - would need actual setlist comparison)
    const accuracy = votes.length > 0 ? Math.floor(Math.random() * 30) + 70 : 0; // Placeholder
    
    // Calculate voting streak (consecutive days with votes)
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dayStart = checkDate.setHours(0, 0, 0, 0);
      const dayEnd = checkDate.setHours(23, 59, 59, 999);
      
      const dayVotes = votes.filter(v => v.createdAt >= dayStart && v.createdAt <= dayEnd);
      if (dayVotes.length > 0) {
        streak++;
      } else if (i > 0) {
        break; // Streak broken
      }
    }
    
    // Get user rank (simplified)
    const allUsers = await ctx.db.query("users").collect();
    const userRank = Math.floor(Math.random() * allUsers.length) + 1; // Placeholder
    
    return {
      totalVotes: votes.length,
      totalSetlists: setlists.length,
      recentVotes,
      accuracy,
      streak,
      rank: userRank,
      joinedAt: user._creationTime,
    };
  },
});

// Get global activity feed (public activities)
export const getGlobalActivityFeed = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    _id: v.string(),
    type: v.union(
      v.literal("song_vote"),
      v.literal("setlist_created"),
      v.literal("show_imported")
    ),
    timestamp: v.number(),
    data: v.any(),
    userId: v.optional(v.id("users")),
    username: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const activities: any[] = [];
    
    // Get recent song votes (anonymized)
    const recentVotes = await ctx.db
      .query("songVotes")
      .order("desc")
      .take(limit);
    
    for (const vote of recentVotes.slice(0, 10)) {
      if (vote.userId !== "anonymous") {
        const user = await ctx.db.get(vote.userId as Id<"users">);
        const setlist = await ctx.db.get(vote.setlistId);
        
        if (setlist) {
          const show = await ctx.db.get(setlist.showId);
          if (show) {
            const artist = await ctx.db.get(show.artistId);
            
            activities.push({
              _id: `global_vote_${vote._id}`,
              type: "song_vote",
              timestamp: vote.createdAt,
              data: {
                songTitle: vote.songTitle,
                artistName: artist?.name,
              },
              userId: user?._id,
              username: user?.username,
            });
          }
        }
      }
    }
    
    // Get recent setlist creations
    const recentSetlists = await ctx.db
      .query("setlists")
      .order("desc")
      .take(10);
    
    for (const setlist of recentSetlists) {
      if (setlist.userId) {
        const user = await ctx.db.get(setlist.userId);
        const show = await ctx.db.get(setlist.showId);
        
        if (show) {
          const artist = await ctx.db.get(show.artistId);
          
          activities.push({
            _id: `global_setlist_${setlist._id}`,
            type: "setlist_created",
            timestamp: setlist.lastUpdated,
            data: {
              songsCount: setlist.songs.length,
              artistName: artist?.name,
              isVerified: setlist.verified,
            },
            userId: user?._id,
            username: user?.username,
          });
        }
      }
    }
    
    // Get recent show imports
    const recentShows = await ctx.db
      .query("shows")
      .order("desc")
      .take(5);
    
    for (const show of recentShows) {
      const [artist, venue] = await Promise.all([
        ctx.db.get(show.artistId),
        ctx.db.get(show.venueId)
      ]);
      
      activities.push({
        _id: `global_show_${show._id}`,
        type: "show_imported",
        timestamp: show._creationTime,
        data: {
          artistName: artist?.name,
          venueName: venue?.name,
          venueCity: venue?.city,
          showDate: show.date,
        },
      });
    }
    
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
});

// Get trending setlists based on vote activity
export const getTrendingSetlists = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    _id: v.id("setlists"),
    showId: v.id("shows"),
    songs: v.array(v.any()),
    verified: v.boolean(),
    source: v.string(),
    lastUpdated: v.number(),
    voteCount: v.number(),
    show: v.any(),
    artist: v.any(),
    venue: v.any(),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    // Get all setlists and calculate vote counts
    const setlists = await ctx.db.query("setlists").collect();
    const setlistsWithVotes = await Promise.all(
      setlists.map(async (setlist) => {
        const votes = await ctx.db
          .query("songVotes")
          .withIndex("by_setlist", (q) => q.eq("setlistId", setlist._id))
          .collect();
        
        const show = await ctx.db.get(setlist.showId);
        if (!show) return null;
        
        const [artist, venue] = await Promise.all([
          ctx.db.get(show.artistId),
          ctx.db.get(show.venueId)
        ]);
        
        return {
          ...setlist,
          voteCount: votes.length,
          show,
          artist,
          venue,
        };
      })
    );
    
    return setlistsWithVotes
      .filter(s => s !== null)
      .sort((a: any, b: any) => b.voteCount - a.voteCount)
      .slice(0, limit);
  },
});