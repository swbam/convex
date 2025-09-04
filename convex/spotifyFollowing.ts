import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./auth";
import { Id } from "./_generated/dataModel";

// Helper function to check if user has Spotify authentication
async function requireSpotifyUser(ctx: any): Promise<{ userId: Id<"users">, user: any }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Must be logged in");
  }
  
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }
  
  if (!user.spotifyId) {
    throw new Error("Spotify authentication required. Please sign in with Spotify to follow artists.");
  }
  
  return { userId, user };
}

// Check if current user is a Spotify user
export const isSpotifyUser = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    
    const user = await ctx.db.get(userId);
    return !!(user?.spotifyId);
  },
});

// Follow/unfollow an artist (Spotify users only)
export const toggleArtistFollow = mutation({
  args: { artistId: v.id("artists") },
  returns: v.object({
    success: v.boolean(),
    isFollowing: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const { userId, user } = await requireSpotifyUser(ctx);

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

// Get user's followed artists (Spotify users only)
export const getFollowedArtists = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    _id: v.id("userFollows"),
    artist: v.any(),
    followedAt: v.number(),
    upcomingShowsCount: v.number(),
    totalShowsCount: v.number(),
    hasNewShows: v.boolean(),
    isSpotifyArtist: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const { userId, user } = await requireSpotifyUser(ctx);
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
        
        // Check if there are new shows since last visit
        const hasNewShows = upcomingShows.length > 0 && 
          upcomingShows.some(s => s._creationTime > follow.createdAt);

        // Check if this artist is from user's Spotify data
        const isSpotifyArtist = !!(artist.spotifyId);

        return {
          _id: follow._id,
          artist,
          followedAt: follow.createdAt,
          upcomingShowsCount: upcomingShows.length,
          totalShowsCount: shows.length,
          hasNewShows,
          isSpotifyArtist,
        };
      })
    );

    return followsWithDetails.filter(f => f !== null);
  },
});

// Check if user is following specific artists (Spotify users only)
export const getFollowStatus = query({
  args: { artistIds: v.array(v.id("artists")) },
  returns: v.record(v.id("artists"), v.boolean()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const result: Record<Id<"artists">, boolean> = {};
    
    // Initialize all as false
    args.artistIds.forEach(id => result[id] = false);
    
    if (!userId) return result;
    
    const user = await ctx.db.get(userId);
    if (!user?.spotifyId) return result; // Only Spotify users can follow

    const follows = await ctx.db
      .query("userFollows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const followedArtistIds = new Set(follows.map(f => f.artistId));
    
    args.artistIds.forEach(id => {
      result[id] = followedArtistIds.has(id);
    });

    return result;
  },
});

// Get artist followers count (public, but only shows Spotify users)
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
      isSpotifyUser: v.boolean(),
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
          isSpotifyUser: !!(user.spotifyId),
        };
      })
    );

    return {
      totalFollowers: follows.length,
      recentFollowers: recentFollowers.filter(f => f !== null),
    };
  },
});

// Get user's Spotify artists that have upcoming shows
export const getUserSpotifyArtistsWithShows = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    artist: v.any(),
    isFollowed: v.boolean(),
    isTopArtist: v.boolean(),
    topArtistRank: v.optional(v.number()),
    upcomingShowsCount: v.number(),
    spotifyFollowers: v.optional(v.number()),
    spotifyPopularity: v.optional(v.number()),
  })),
  handler: async (ctx, args) => {
    const { userId, user } = await requireSpotifyUser(ctx);
    const limit = args.limit || 50;

    // Get user's Spotify artists
    const spotifyArtists = await ctx.db
      .query("userSpotifyArtists")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(limit);

    // Get user's follows to check follow status
    const follows = await ctx.db
      .query("userFollows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    const followedArtistIds = new Set(follows.map(f => f.artistId));

    const artistsWithShows = await Promise.all(
      spotifyArtists.map(async (spotifyArtist) => {
        const artist = await ctx.db.get(spotifyArtist.artistId);
        if (!artist) return null;

        // Count upcoming shows for this artist
        const shows = await ctx.db
          .query("shows")
          .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
          .filter((q) => q.eq(q.field("status"), "upcoming"))
          .collect();

        if (shows.length === 0) return null; // Only return artists with upcoming shows

        return {
          artist,
          isFollowed: followedArtistIds.has(artist._id),
          isTopArtist: spotifyArtist.isTopArtist,
          topArtistRank: spotifyArtist.topArtistRank,
          upcomingShowsCount: shows.length,
          spotifyFollowers: artist.followers,
          spotifyPopularity: artist.popularity,
        };
      })
    );

    return artistsWithShows
      .filter(a => a !== null)
      .sort((a, b) => {
        // Sort by: top artists first, then by upcoming shows count, then by popularity
        if (a.isTopArtist && !b.isTopArtist) return -1;
        if (!a.isTopArtist && b.isTopArtist) return 1;
        if (a.isTopArtist && b.isTopArtist) {
          return (a.topArtistRank || 50) - (b.topArtistRank || 50);
        }
        if (a.upcomingShowsCount !== b.upcomingShowsCount) {
          return b.upcomingShowsCount - a.upcomingShowsCount;
        }
        return (b.spotifyPopularity || 0) - (a.spotifyPopularity || 0);
      });
  },
});