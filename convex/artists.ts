import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "./auth";

export const getById = query({
  args: { id: v.id("artists") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artists")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

// Accepts either a SEO slug or a document id string and returns artist
export const getBySlugOrId = query({
  args: { key: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    // Try by slug first (gracefully handle duplicates)
    const bySlug = await ctx.db
      .query("artists")
      .withIndex("by_slug", (q) => q.eq("slug", args.key))
      .first();
    if (bySlug) return bySlug;

    // Fallback: try by id
    try {
      // Validate that the key is a valid artist ID format
      const artistId = args.key as Id<"artists">;
      const artist = await ctx.db.get(artistId);
      // Verify it's actually an artist by checking for required fields
      if (artist && 'name' in artist && 'slug' in artist) {
        return artist;
      }
    } catch {
      // ignore invalid id format
    }

    // Finally: support navigation via Ticketmaster ID slugs
    const byTicketmaster = await ctx.db
      .query("artists")
      .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", args.key))
      .first();
    if (byTicketmaster) return byTicketmaster;

    // NEW: Fuzzy fallback by partial name match (for refresh resilience)
    const fuzzyMatches = await ctx.db
      .query("artists")
      .withIndex("by_lower_name", (q) => q.eq("lowerName", args.key.toLowerCase()))
      .first();
    if (fuzzyMatches) return fuzzyMatches;

    // NEW: Try partial slug match (e.g., slug with extra chars)
    const normalizedKey = args.key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const partialMatches = await ctx.db
      .query("artists")
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(100);
    
    const bestMatch = partialMatches.find(artist => 
      artist.slug.includes(normalizedKey) || normalizedKey.includes(artist.slug)
    );
    if (bestMatch) return bestMatch;

    return null;
  },
});

export const getTrending = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    // Use the optimized trending system - just query by the pre-calculated trending rank
    const trending = await ctx.db
      .query("artists")
      .withIndex("by_trending_rank")
      .filter((q) => q.neq(q.field("trendingRank"), undefined))
      .take(limit);
    
    // If no trending data, fallback to sorting by popularity
    if (trending.length === 0) {
      return await ctx.db
        .query("artists")
        .filter((q) => q.eq(q.field("isActive"), true))
        .order("desc")
        .take(limit);
    }
    
    return trending;
  },
});

export const search = query({
  args: { 
    query: v.string(),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
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

// Get all artists with basic sorting and optional limit - ENHANCED with pagination support
export const getAll = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    // ENHANCED: Use indexed query for better performance
    const artists = await ctx.db
      .query("artists")
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(Math.min(limit * 2, 200)); // Take more for sorting, but cap at 200

    return artists
      .sort((a, b) => {
        const scoreA = (b.trendingScore || 0) - (a.trendingScore || 0);
        if (scoreA !== 0) return scoreA;
        const followersDelta = (b.followers || 0) - (a.followers || 0);
        if (followersDelta !== 0) return followersDelta;
        return (b.popularity || 0) - (a.popularity || 0);
      })
      .slice(0, limit);
  },
});

export const isFollowing = query({
  args: { artistId: v.id("artists") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const follow = await ctx.db
      .query("userFollows")
      .withIndex("by_user_and_artist", (q) => 
        q.eq("userId", userId).eq("artistId", args.artistId)
      )
      .first();

    return !!follow;
  },
});

export const followArtist = mutation({
  args: { artistId: v.id("artists") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to follow artists");
    }

    const existingFollow = await ctx.db
      .query("userFollows")
      .withIndex("by_user_and_artist", (q) => 
        q.eq("userId", userId).eq("artistId", args.artistId)
      )
      .first();

    if (existingFollow) {
      await ctx.db.delete(existingFollow._id);
      return false; // unfollowed
    } else {
      await ctx.db.insert("userFollows", {
        userId,
        artistId: args.artistId,
        createdAt: Date.now(),
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

    if (existing) return existing._id;

    const lowerName = args.name.toLowerCase();
    const existingByName = await ctx.db
      .query("artists")
      .withIndex("by_lower_name", (q) => q.eq("lowerName", lowerName))
      .first();

    if (existingByName) {
      // Merge: Patch with new data if different
      await ctx.db.patch(existingByName._id, {
        genres: args.genres && args.genres.length > 0 ? args.genres : existingByName.genres,
        images: args.images && args.images.length > 0 ? args.images : existingByName.images,
        ticketmasterId: args.ticketmasterId, // Ensure TM ID is set
        lastSynced: Date.now(),
      });
      console.log(`✅ Updated existing artist ${args.name} (ID: ${existingByName._id}), genres: ${args.genres?.length || 0}`);
      return existingByName._id;
    }

    // Create slug from name
    const baseSlug = args.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Check for existing slugs and add a number if needed
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existingWithSlug = await ctx.db
        .query("artists")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      
      if (!existingWithSlug) break;
      
      // If an artist with this slug exists but it's the same ticketmaster ID, return it
      if (existingWithSlug.ticketmasterId === args.ticketmasterId) {
        console.log(`✅ Found existing artist by slug ${slug} (ID: ${existingWithSlug._id})`);
        return existingWithSlug._id;
      }
      
      // Otherwise, try a new slug
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Critical: Always set lastSynced on creation and initialize ALL optional fields
    const artistId = await ctx.db.insert("artists", {
      slug,
      name: args.name,
      ticketmasterId: args.ticketmasterId,
      genres: args.genres && args.genres.length > 0 ? args.genres : [],
      images: args.images && args.images.length > 0 ? args.images : [],
      isActive: true,
      trendingScore: 0, // Initialize with 0 instead of undefined
      trendingRank: undefined,
      upcomingShowsCount: 0, // Initialize with 0 - will be updated after show sync
      popularity: 0, // Initialize with 0 - will be updated by Spotify sync
      followers: 0, // Initialize with 0 - will be updated by Spotify sync
      spotifyId: undefined, // Will be set by Spotify sync
      lastSynced: Date.now(), // CRITICAL: Set initial sync timestamp
      lastTrendingUpdate: Date.now(), // Initialize trending timestamp
      lowerName, // Already defined above from checking existingByName
    });
    
    console.log(`✅ Created artist ${args.name} with ID ${artistId}, slug: ${slug}, genres: ${args.genres?.length || 0}`);
    return artistId;
  },
});

// Get recently active artists for cron jobs
export const getRecentlyActive = internalQuery({
  args: {
    since: v.number(),
    limit: v.number(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artists")
      .filter((q) => q.gte(q.field("lastSynced"), args.since))
      .order("desc")
      .take(args.limit);
  },
});

// Get all artists for maintenance (including incomplete ones)
export const getAllForMaintenance = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const allArtists = await ctx.db
      .query("artists")
      .order("desc")
      .take(100); // Limit for maintenance operations
    
    // Filter to prioritize artists with missing data
    const incompleteArtists = allArtists.filter(artist => 
      !artist.spotifyId || // Missing Spotify ID
      !artist.popularity || // Missing popularity score
      !artist.followers || // Missing follower count
      !artist.images || artist.images.length === 0 || // Missing images
      !artist.lastSynced // Never been synced
    );
    
    // Return incomplete artists first, then complete ones
    return [...incompleteArtists, ...allArtists.filter(a => !incompleteArtists.includes(a))];
  },
});





export const updateSpotifyData = internalMutation({
  args: {
    artistId: v.id("artists"),
    spotifyId: v.optional(v.string()),
    followers: v.optional(v.number()),
    popularity: v.optional(v.number()),
    genres: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: any = {
      lastSynced: Date.now(), // CRITICAL: Always update sync timestamp
      lastTrendingUpdate: Date.now(), // Update trending timestamp when Spotify data changes
    };
    
    if (args.spotifyId !== undefined) updates.spotifyId = args.spotifyId;
    // ENHANCED: Validate numeric fields and filter out NaN/Infinity
    if (args.followers !== undefined && Number.isFinite(args.followers)) {
      updates.followers = Math.max(0, args.followers);
    }
    if (args.popularity !== undefined && Number.isFinite(args.popularity)) {
      updates.popularity = Math.max(0, Math.min(100, args.popularity)); // Clamp to 0-100
    }
    if (args.genres !== undefined && Array.isArray(args.genres)) {
      updates.genres = args.genres.filter(g => typeof g === 'string' && g.trim().length > 0);
    }
    if (args.images !== undefined && Array.isArray(args.images)) {
      updates.images = args.images.filter(img => typeof img === 'string' && img.startsWith('http'));
    }
    
    await ctx.db.patch(args.artistId, updates);
    console.log(`✅ Updated Spotify data for artist ${args.artistId}`);
    return null;
  },
});

// New mutation specifically for updating show counts
export const updateShowCount = internalMutation({
  args: {
    artistId: v.id("artists"),
    upcomingShowsCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // ENHANCED: Validate count is never negative
    const validatedCount = Math.max(0, args.upcomingShowsCount);
    await ctx.db.patch(args.artistId, {
      upcomingShowsCount: validatedCount,
      lastSynced: Date.now(),
      lastTrendingUpdate: Date.now(), // Also update trending timestamp when show count changes
    });
    console.log(`✅ Updated artist ${args.artistId} show count: ${validatedCount}`);
    return null;
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

// Note: keep a single definition of getByTicketmasterIdInternal to avoid redeclarations.

export const createInternal = internalMutation({
  args: {
    name: v.string(),
    spotifyId: v.optional(v.string()),
    ticketmasterId: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    popularity: v.optional(v.number()),
    followers: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lowerName = args.name.toLowerCase();
    const existingByName = await ctx.db
      .query("artists")
      .withIndex("by_lower_name", (q) => q.eq("lowerName", lowerName))
      .first();

    if (existingByName) {
      // Merge: Patch with new data if different
      await ctx.db.patch(existingByName._id, {
        genres: args.genres,
        images: args.images,
        // Merge other fields, e.g., if no Spotify yet, but since this is TM, add TM-specific
        ticketmasterId: args.ticketmasterId, // Ensure TM ID is set
        lastSynced: Date.now(),
      });
      return existingByName._id;
    }

    // Create SEO-friendly slug
    const slug = args.name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '')    // Remove leading/trailing hyphens
      .substring(0, 100);       // Limit length for SEO

    const artistId = await ctx.db.insert("artists", {
      slug,
      name: args.name,
      spotifyId: args.spotifyId,
      ticketmasterId: args.ticketmasterId,
      genres: args.genres || [],
      images: args.images || [],
      popularity: args.popularity,
      followers: args.followers,
      isActive: true,
      trendingScore: 1,
      lowerName,
      lastSynced: Date.now(), // CRITICAL: Always set sync timestamp
    });
    
    console.log(`✅ Created artist ${args.name} with ID ${artistId}, slug: ${slug}`);
    return artistId;
  },
});



// DEPRECATED: Trending scores are now updated by trending.updateArtistTrending



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

// Required functions from CONVEX.md specification
export const getStaleArtists = query({
  args: { olderThan: v.number() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artists")
      .filter((q) => q.lt(q.field("lastSynced"), args.olderThan))
      .collect();
  },
});

export const updateArtist = mutation({
  args: { 
    artistId: v.id("artists"),
    name: v.string(),
    image: v.optional(v.string()),
    genres: v.array(v.string()),
    popularity: v.number(),
    followers: v.number(),
    lastSynced: v.number(),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      name: args.name,
      genres: args.genres,
      popularity: args.popularity,
      followers: args.followers,
      lastSynced: args.lastSynced,
    };
    if (args.image) {
      updates.images = [args.image];
    }
    await ctx.db.patch(args.artistId, updates);
  },
});

// Additional required queries referenced in sync.ts
export const getBySpotifyId = query({
  args: { spotifyId: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artists")
      .withIndex("by_spotify_id", (q) => q.eq("spotifyId", args.spotifyId))
      .first();
  },
});

export const getByName = query({
  args: { name: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artists")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

export const getByTicketmasterId = query({
  args: { ticketmasterId: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artists")
      .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", args.ticketmasterId))
      .first();
  },
});

export const getByTicketmasterIdInternal = internalQuery({
  args: { ticketmasterId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artists")
      .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", args.ticketmasterId))
      .first();
  },
});

// Internal mutations for sync operations
export const create = internalMutation({
  args: {
    name: v.string(),
    spotifyId: v.string(),
    image: v.optional(v.string()),
    genres: v.array(v.string()),
    popularity: v.number(),
    followers: v.number(),
    lastSynced: v.number(),
  },
  handler: async (ctx, args) => {
    const lowerName = args.name.toLowerCase();
    const existingByName = await ctx.db
      .query("artists")
      .withIndex("by_lower_name", (q) => q.eq("lowerName", lowerName))
      .first();

    if (existingByName) {
      // Merge: Patch with new data if different
      await ctx.db.patch(existingByName._id, {
        genres: args.genres,
        images: args.image ? [args.image] : [],
        lastSynced: args.lastSynced,
      });
      return existingByName._id;
    }

    // Create SEO-friendly slug
    const slug = args.name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '')    // Remove leading/trailing hyphens
      .substring(0, 100);       // Limit length for SEO

    const images = args.image ? [args.image] : [];
    const artistId = await ctx.db.insert("artists", {
      slug,
      name: args.name,
      spotifyId: args.spotifyId,
      images,
      genres: args.genres,
      popularity: args.popularity,
      followers: args.followers,
      lastSynced: args.lastSynced || Date.now(), // CRITICAL: Ensure timestamp
      isActive: true,
      trendingScore: 1,
      lowerName,
    });
    
    console.log(`✅ Created artist ${args.name} with ID ${artistId}, slug: ${slug}`);
    return artistId;
  },
});

// Minimal internal helper to set Ticketmaster ID on an existing artist.
export const setTicketmasterId = internalMutation({
  args: { artistId: v.id("artists"), ticketmasterId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.artistId, { ticketmasterId: args.ticketmasterId, lastSynced: Date.now() });
    return null;
  },
});


