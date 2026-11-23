import { getUserPredictionStats } from "./lib/songVoteCounts";
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
      v.literal("artist_followed"),
      v.literal("show_attended")
    ),
    createdAt: v.number(),
    description: v.string(),
    data: v.optional(v.any()),
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

    const setlistIds = Array.from(new Set(votes.map((vote) => vote.setlistId)));
    const voteSetlists = setlistIds.length > 0
      ? await Promise.all(setlistIds.map((id) => ctx.db.get(id)))
      : [];
    const setlistMap = new Map(setlistIds.map((id, idx) => [id, voteSetlists[idx] ?? null]));

    const showIdsFromVotes = new Set<Id<"shows">>();
    for (const setlist of setlistMap.values()) {
      if (setlist) {
        showIdsFromVotes.add(setlist.showId);
      }
    }

    // Get user's created setlists
    const userSetlists = await ctx.db
      .query("setlists")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);

    for (const setlist of userSetlists) {
      setlistMap.set(setlist._id, setlist);
      showIdsFromVotes.add(setlist.showId);
    }

    const showIds = Array.from(showIdsFromVotes);
    const shows = showIds.length > 0
      ? await Promise.all(showIds.map((id) => ctx.db.get(id)))
      : [];
    const showMap = new Map(showIds.map((id, idx) => [id, shows[idx] ?? null]));

    const artistIds = new Set<Id<"artists">>();
    const venueIds = new Set<Id<"venues">>();
    for (const show of showMap.values()) {
      if (show) {
        artistIds.add(show.artistId);
        venueIds.add(show.venueId);
      }
    }

    const artistIdList = Array.from(artistIds);
    const venueIdList = Array.from(venueIds);
    const artists = artistIdList.length > 0
      ? await Promise.all(artistIdList.map((id) => ctx.db.get(id)))
      : [];
    const venues = venueIdList.length > 0
      ? await Promise.all(venueIdList.map((id) => ctx.db.get(id)))
      : [];
    const artistMap = new Map(artistIdList.map((id, idx) => [id, artists[idx] ?? null]));
    const venueMap = new Map(venueIdList.map((id, idx) => [id, venues[idx] ?? null]));

    for (const vote of votes) {
      const setlist = setlistMap.get(vote.setlistId) ?? null;
      const show = setlist ? showMap.get(setlist.showId) ?? null : null;
      const artist = show ? artistMap.get(show.artistId) ?? null : null;
      const venue = show ? venueMap.get(show.venueId) ?? null : null;

      activities.push({
        _id: `vote_${vote._id}`,
        type: "song_vote",
        createdAt: vote.createdAt,
        description: `You ${vote.voteType === "upvote" ? "upvoted" : "downvoted"} "${vote.songTitle}" for ${artist?.name ?? "Unknown Artist"} at ${venue?.name ?? "Unknown Venue"}.`,
        data: {
          songTitle: vote.songTitle,
          artistName: artist?.name,
          venueName: venue?.name,
          showDate: show?.date,
        },
        showId: show?._id,
        artistId: show?.artistId,
        setlistId: vote.setlistId,
      });
    }

    for (const setlist of userSetlists) {
      const show = showMap.get(setlist.showId) ?? null;
      const artist = show ? artistMap.get(show.artistId) ?? null : null;
      const venue = show ? venueMap.get(show.venueId) ?? null : null;

      activities.push({
        _id: `setlist_${setlist._id}`,
        type: "setlist_created",
        createdAt: setlist.lastUpdated ?? setlist._creationTime,
        description: `You created a setlist for ${artist?.name ?? "Unknown Artist"} at ${venue?.name ?? "Unknown Venue"} (${setlist.songs.length} songs).`,
        data: {
          songsCount: setlist.songs.length,
          artistName: artist?.name,
          venueName: venue?.name,
          showDate: show?.date,
          isVerified: setlist.verified,
        },
        showId: show?._id,
        artistId: show?.artistId,
        setlistId: setlist._id,
      });
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
        let followedArtist = artistMap.get(follow.artistId) ?? null;
        if (!followedArtist) {
          followedArtist = await ctx.db.get(follow.artistId);
          if (followedArtist) {
            artistMap.set(follow.artistId, followedArtist);
          }
        }
        if (!followedArtist) continue;

        activities.push({
          _id: `follow_${follow._id}`,
          type: "artist_followed",
          createdAt: follow.createdAt,
          description: `You followed ${followedArtist.name}.`,
          data: {
            artistName: followedArtist.name,
            artistImage: followedArtist.images?.[0],
            genres: followedArtist.genres,
            isSpotifyArtist: !!followedArtist.spotifyId,
          },
          artistId: follow.artistId,
        });
      }
    }
    
    // Sort by createdAt and apply pagination
    return activities
      .sort((a, b) => b.createdAt - a.createdAt)
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
    accuracy: v.union(v.number(), v.null()),
    evaluatedVotes: v.number(),
    historyLimited: v.boolean(),
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
        accuracy: null,
        evaluatedVotes: 0,
        historyLimited: false,
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
        accuracy: null,
        evaluatedVotes: 0,
        historyLimited: false,
        streak: 0,
        rank: 0,
        joinedAt: 0,
        isSpotifyUser: false,
      };
    }

    // Get vote statistics
    const votes = await ctx.db
      .query("songVotes")
      .withIndex("by_user_created_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(501);
    
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    // Calculate recent activity (last 7 days)
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentVotes = votes.filter(v => v.createdAt > weekAgo).length;
    
    const predictionStats = await getUserPredictionStats(ctx, votes.slice(0, 500));
    const accuracy = predictionStats.accuracy === null ? null : Math.round(predictionStats.accuracy * 100);

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
    
    // Global rank needs a maintained leaderboard, not a per-page scan of every account.
    const userRank = 0;

    return {
      totalVotes: Math.min(votes.length, 500),
      totalSetlists: setlists.length,
      recentVotes,
      accuracy,
      evaluatedVotes: predictionStats.evaluated,
      historyLimited: votes.length > 500,
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
  returns: v.array(v.object({
    _id: v.id("setlists"),
    voteCount: v.number(),
    show: v.optional(v.any()),
    artist: v.optional(v.any()),
    venue: v.optional(v.any()),
    songs: v.optional(v.array(v.any())),
  })),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 20, 50));
    // Rank by maintained real-vote totals before fetching related records.
    const candidates = await ctx.db.query("setlists")
      .withIndex("by_song_vote_count", q => q.gt("songVoteCount", 0)).order("desc").take(limit);
    const results = await Promise.all(candidates.map(async setlist => {
      const show = await ctx.db.get(setlist.showId);
      if (!show) return null;
      const [artist, venue] = await Promise.all([ctx.db.get(show.artistId), ctx.db.get(show.venueId)]);
      return { _id: setlist._id, voteCount: setlist.songVoteCount ?? 0, show, artist, venue, songs: setlist.songs };
    }));
    return results.filter((row): row is NonNullable<typeof row> => row !== null);
  },
});

export const getVoteAccuracy = query({
  args: { userId: v.id("users") },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || userId !== args.userId) return null;
    const votes = await ctx.db.query("songVotes")
      .withIndex("by_user_created_at", q => q.eq("userId", userId)).order("desc").take(500);
    return (await getUserPredictionStats(ctx, votes)).accuracy;
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

export const subscribeToUserActivity = query({
  args: { userId: v.id("users") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Activity table removed from schema - activity is computed from other tables
    // Use getUserActivityFeed instead for comprehensive activity tracking
    console.warn("subscribeToUserActivity is deprecated - use getUserActivityFeed instead");
    return [];
  },
});
