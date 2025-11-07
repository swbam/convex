import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Get user's Spotify artists with upcoming shows (Query in V8 runtime)
export const getUserSpotifyArtists = query({
  args: { 
    limit: v.optional(v.number()),
    onlyWithShows: v.optional(v.boolean()),
  },
  returns: v.array(v.object({
    artist: v.any(),
    isFollowed: v.boolean(),
    isTopArtist: v.boolean(),
    topArtistRank: v.optional(v.number()),
    upcomingShowsCount: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .first();
    
    if (!user || !user.spotifyId) return [];
    
    const limit = args.limit || 50;
    const onlyWithShows = args.onlyWithShows ?? true;
    
    // Get user's Spotify artists
    const userArtists = await ctx.db
      .query("userSpotifyArtists")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    
    // Sort by priority: top artists first, then by rank
    const sortedUserArtists = userArtists.sort((a, b) => {
      if (a.isTopArtist && !b.isTopArtist) return -1;
      if (!a.isTopArtist && b.isTopArtist) return 1;
      if (a.isTopArtist && b.isTopArtist) {
        return (a.topArtistRank || 999) - (b.topArtistRank || 999);
      }
      return 0;
    });
    
    // Fetch artist details with upcoming shows
    const results = [];
    
    for (const userArtist of sortedUserArtists.slice(0, limit)) {
      const artist = await ctx.db.get(userArtist.artistId);
      if (!artist) continue;
      
      // Count upcoming shows - OPTIMIZED: Use compound index instead of filter
      const upcomingShows = await ctx.db
        .query("shows")
        .withIndex("by_artist_and_status", (q) => q.eq("artistId", artist._id).eq("status", "upcoming"))
        .collect();
      
      const upcomingShowsCount = upcomingShows.length;
      
      // Skip if no shows and onlyWithShows is true
      if (onlyWithShows && upcomingShowsCount === 0) continue;
      
      results.push({
        artist,
        isFollowed: !!userArtist.isFollowed,
        isTopArtist: !!userArtist.isTopArtist,
        topArtistRank: userArtist.topArtistRank,
        upcomingShowsCount,
      });
    }
    
    return results;
  },
});

// Track user's Spotify artist relationship (Mutation in V8 runtime)
export const trackUserArtist = internalMutation({
  args: {
    userId: v.id("users"),
    artistId: v.id("artists"),
    isFollowed: v.boolean(),
    isTopArtist: v.boolean(),
    topArtistRank: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if relationship already exists
    const existing = await ctx.db
      .query("userSpotifyArtists")
      .withIndex("by_user_artist", (q) => 
        q.eq("userId", args.userId).eq("artistId", args.artistId)
      )
      .first();
    
    if (existing) {
      // Update existing relationship
      await ctx.db.patch(existing._id, {
        isFollowed: args.isFollowed,
        isTopArtist: args.isTopArtist,
        topArtistRank: args.topArtistRank,
        lastUpdated: Date.now(),
      });
    } else {
      // Create new relationship
      await ctx.db.insert("userSpotifyArtists", {
        userId: args.userId,
        artistId: args.artistId,
        isFollowed: args.isFollowed,
        isTopArtist: args.isTopArtist,
        topArtistRank: args.topArtistRank,
        importedAt: Date.now(),
        lastUpdated: Date.now(),
      });
    }
    
    console.log(`✅ Tracked artist ${args.artistId} for user ${args.userId}`);
    return null;
  },
});

// Internal queries/mutations for token management
export const getStoredSpotifyToken = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("spotifyTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const listStoredSpotifyTokens = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("spotifyTokens").collect();
  },
});

export const updateStoredSpotifyToken = internalMutation({
  args: {
    tokenId: v.id("spotifyTokens"),
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    tokenType: v.optional(v.string()),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tokenId, {
      userId: args.userId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      scope: args.scope,
      tokenType: args.tokenType,
      updatedAt: args.updatedAt,
    });
    return null;
  },
});

export const insertStoredSpotifyToken = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    tokenType: v.optional(v.string()),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("spotifyTokens", {
      userId: args.userId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      scope: args.scope,
      tokenType: args.tokenType,
      updatedAt: args.updatedAt,
    });
    return null;
  },
});

export const setUserSpotifyId = internalMutation({
  args: {
    userId: v.id("users"),
    spotifyId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      spotifyId: args.spotifyId,
    });
    return null;
  },
});
