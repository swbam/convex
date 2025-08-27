import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getById = query({
  args: { id: v.id("artists") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artists")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const getTrending = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("artists")
      .withIndex("by_trending_score")
      .order("desc")
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(limit);
  },
});

export const search = query({
  args: { 
    query: v.string(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    // Simple text search - in production you'd use full-text search
    const artists = await ctx.db
      .query("artists")
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(100);
    
    return artists
      .filter(artist => 
        artist.name.toLowerCase().includes(args.query.toLowerCase())
      )
      .slice(0, limit);
  },
});

export const isFollowing = query({
  args: { artistId: v.id("artists") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const follow = await ctx.db
      .query("follows")
      .withIndex("by_user_and_artist", (q) => 
        q.eq("userId", userId).eq("artistId", args.artistId)
      )
      .first();

    return !!follow;
  },
});

export const followArtist = mutation({
  args: { artistId: v.id("artists") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to follow artists");
    }

    const existingFollow = await ctx.db
      .query("follows")
      .withIndex("by_user_and_artist", (q) => 
        q.eq("userId", userId).eq("artistId", args.artistId)
      )
      .first();

    if (existingFollow) {
      await ctx.db.delete(existingFollow._id);
      return false; // unfollowed
    } else {
      await ctx.db.insert("follows", {
        userId,
        artistId: args.artistId,
      });
      return true; // followed
    }
  },
});

export const createFromTicketmaster = internalMutation({
  args: {
    ticketmasterId: v.string(),
    name: v.string(),
    genres: v.array(v.string()),
    images: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if artist already exists
    const existing = await ctx.db
      .query("artists")
      .filter((q) => q.eq(q.field("ticketmasterId"), args.ticketmasterId))
      .first();

    if (existing) {
      return existing._id;
    }

    // Create slug from name
    const slug = args.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return await ctx.db.insert("artists", {
      slug,
      name: args.name,
      ticketmasterId: args.ticketmasterId,
      genres: args.genres,
      images: args.images,
      isActive: true,
      trendingScore: 0,
    });
  },
});

export const updateSpotifyData = internalMutation({
  args: {
    artistId: v.id("artists"),
    spotifyId: v.string(),
    followers: v.optional(v.number()),
    popularity: v.optional(v.number()),
    genres: v.array(v.string()),
    images: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.artistId, {
      spotifyId: args.spotifyId,
      followers: args.followers,
      popularity: args.popularity,
      genres: args.genres,
      images: args.images,
    });
  },
});

// Internal queries for sync operations
export const getBySlugInternal = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artists")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const getByIdInternal = internalQuery({
  args: { id: v.id("artists") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createInternal = internalMutation({
  args: {
    slug: v.string(),
    name: v.string(),
    spotifyId: v.optional(v.string()),
    ticketmasterId: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    popularity: v.optional(v.number()),
    followers: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("artists", {
      slug: args.slug,
      name: args.name,
      spotifyId: args.spotifyId,
      ticketmasterId: args.ticketmasterId,
      genres: args.genres || [],
      images: args.images || [],
      popularity: args.popularity,
      followers: args.followers,
      isActive: true,
      trendingScore: 1,
    });
  },
});

export const updateTrendingScore = internalMutation({
  args: {
    artistId: v.id("artists"),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.artistId, {
      trendingScore: args.score,
    });
  },
});

export const getAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("artists").collect();
  },
});

export const resetInactiveTrendingScores = internalMutation({
  args: {},
  handler: async (ctx) => {
    const artists = await ctx.db.query("artists").collect();
    
    for (const artist of artists) {
      // Reset trending score to 0 for artists with low activity
      if ((artist.trendingScore || 0) < 5) {
        await ctx.db.patch(artist._id, {
          trendingScore: 0,
        });
      }
    }
  },
});
