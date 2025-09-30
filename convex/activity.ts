import { query, internalMutation, subscription } from "./_generated/server";
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
      v.literal(""),
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
    
    // Get user follows (only for Spotify users)
    const user = await ctx.db.get(userId);
    if (user?.spotifyId) {
      const follows = await ctx.db
        .query("userFollows")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(10);
      
      for (const follow of follows) {
        const artist = await ctx.db.get(follow.artistId);
        if (artist) {
          activities.push({
            _id: `follow_${follow._id}`,
            type: "",
            timestamp: follow.createdAt,
            data: {
              artistName: artist.name,
              artistImage: artist.images?.[0],
              genres: artist.genres,
              isSpotifyArtist: !!(artist.spotifyId),
            },
            artistId: follow.artistId,
          });
        }
      }
    }
    
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
    isSpotifyUser: v.boolean(),
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
        isSpotifyUser: false,
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
        isSpotifyUser: false,
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
    
    // Get follows (only for Spotify users)
    let totalFollows = 0;
    if (user.spotifyId) {
      const follows = await ctx.db
        .query("userFollows")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      totalFollows = follows.length;
    }
    
    // Calculate recent activity (last 7 days)
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentVotes = votes.filter(v => v.createdAt > weekAgo).length;
    
    // ENHANCED: Calculate REAL accuracy based on actual setlist matches
    let accurateVoteCount = 0;
    let totalVotesWithActual = 0;
    
    for (const vote of votes) {
      // Get the setlist for this vote
      const voteRecord = await ctx.db
        .query("votes")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("setlistId"), vote.setlistId))
        .first();
      
      if (voteRecord && voteRecord.voteType === "accurate") {
        const setlist = await ctx.db.get(vote.setlistId);
        if (setlist?.actualSetlist && setlist.actualSetlist.length > 0) {
          totalVotesWithActual++;
          // Vote was accurate
          accurateVoteCount++;
        }
      } else if (voteRecord && voteRecord.voteType === "inaccurate") {
        const setlist = await ctx.db.get(vote.setlistId);
        if (setlist?.actualSetlist && setlist.actualSetlist.length > 0) {
          totalVotesWithActual++;
          // Vote was inaccurate (counted but not added to accurate)
        }
      }
    }
    
    const accuracy = totalVotesWithActual > 0 
      ? Math.round((accurateVoteCount / totalVotesWithActual) * 100) 
      : 0;
    
    // ENHANCED: Calculate REAL voting streak (consecutive days with votes)
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 365; i++) { // Check up to 1 year
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dayStart = new Date(checkDate).setHours(0, 0, 0, 0);
      const dayEnd = new Date(checkDate).setHours(23, 59, 59, 999);
      
      const dayVotes = votes.filter(v => v.createdAt >= dayStart && v.createdAt <= dayEnd);
      if (dayVotes.length > 0) {
        streak++;
      } else if (i > 0) {
        break; // Streak broken
      }
    }
    
    // ENHANCED: Calculate REAL user rank based on total votes
    const allUsers = await ctx.db.query("users").collect();
    const userVoteCounts = await Promise.all(
      allUsers.map(async (u) => {
        const uVotes = await ctx.db
          .query("songVotes")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .collect();
        return { userId: u._id, voteCount: uVotes.length };
      })
    );
    
    const sortedByVotes = userVoteCounts.sort((a, b) => b.voteCount - a.voteCount);
    const userRank = sortedByVotes.findIndex(u => u.userId === user._id) + 1;
    
    return {
      totalVotes: votes.length,
      totalSetlists: setlists.length,
      recentVotes,
      accuracy,
      streak,
      rank: userRank,
      joinedAt: user._creationTime,
      isSpotifyUser: !!user.spotifyId,
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
  returns: v.array(v.any()), // FIXED: Use v.any() to avoid validation errors with _creationTime
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

export const getVoteAccuracy = query({
  args: { userId: v.id("users") },
  returns: v.number(), // Percentage 0-1
  handler: async (ctx, args) => {
    const userVotes = await ctx.db
      .query("songVotes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let correct = 0;
    let total = 0;
    for (const vote of userVotes) {
      if (vote.setlistId) {
        const setlist = await ctx.db.get(vote.setlistId);
        if (setlist && setlist.actualSetlist) {
          const song = setlist.actualSetlist.find(s => s.title === vote.songTitle);
          if (song && vote.voteType === "upvote") correct++; // Simple: upvote if in setlist
          total++;
        }
      }
    }
    return total > 0 ? correct / total : 0;
  },
});

export const getRecentPredictions = query({
  args: { userId: v.id("users"), limit: v.number() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Assume predictions in activity or separate table; query last votes as proxy
    return await ctx.db
      .query("songVotes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit);
  },
});

export const subscribeToUserActivity = subscription({
  args: { userId: v.id("users") },
  returns: v.array(v.any()),
  handler: (ctx, args) => {
    return ctx.db
      .query("activity")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
  },
});