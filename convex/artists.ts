import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "./auth";
import { internal } from "./_generated/api";

// Add Levenshtein helper
function levenshteinDistance(str1: string, str2: string): number {
  str1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  str2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  const maxLen = Math.max(str1.length, str2.length);
  return maxLen > 0 ? 1 - (matrix[str2.length][str1.length] / maxLen) : 0;
}

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
    // Existing: Try by slug
    const bySlug = await ctx.db
      .query("artists")
      .withIndex("by_slug", (q) => q.eq("slug", args.key))
      .first();
    if (bySlug) return bySlug;

    // Existing: Try by ID
    try {
      const artistId = args.key as Id<"artists">;
      const artist = await ctx.db.get(artistId);
      if (artist && 'name' in artist && 'slug' in artist) return artist;
    } catch {}

    // Existing: By Ticketmaster ID
    const byTicketmaster = await ctx.db
      .query("artists")
      .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", args.key))
      .first();
    if (byTicketmaster) return byTicketmaster;

    // Existing: Fuzzy by lowerName
    const fuzzyMatches = await ctx.db
      .query("artists")
      .withIndex("by_lower_name", (q) => q.eq("lowerName", args.key.toLowerCase()))
      .first();
    if (fuzzyMatches) return fuzzyMatches;

    // NEW: Parse TM ID from slug (e.g., /artists/tm:ABC123)
    if (args.key.startsWith("tm:")) {
      const tmId = args.key.slice(3);
      const byParsedTM = await ctx.db
        .query("artists")
        .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", tmId))
        .first();
      if (byParsedTM) return byParsedTM;
    }

    // NEW: Enhanced fuzzy by partial slug/name match with Levenshtein
    const partialCandidates = await ctx.db
      .query("artists")
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(100); // Limit candidates

    let bestMatch = null;
    let bestScore = 0;
    const threshold = 0.7; // Min similarity

    for (const artist of partialCandidates) {
      const normalizedKey = args.key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const score = Math.max(
        levenshteinDistance(artist.slug, normalizedKey),
        levenshteinDistance(artist.name.toLowerCase(), args.key.toLowerCase())
      );
      if (score > bestScore && score > threshold) {
        bestScore = score;
        bestMatch = artist;
      }
    }

    if (bestMatch) {
      console.log(`Fuzzy match found for "${args.key}": ${bestMatch.name} (score: ${bestScore})`);
      return bestMatch;
    }

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
    genres: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const lowerName = args.name.toLowerCase();
    // Check existing by name or TM ID
    let existing = await ctx.db
      .query("artists")
      .withIndex("by_lower_name", (q) => q.eq("lowerName", lowerName))
      .first();

    if (!existing) {
      existing = await ctx.db
        .query("artists")
        .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", args.ticketmasterId))
        .first();
    }

    if (existing) {
      // Merge: Patch with new data
      await ctx.db.patch(existing._id, {
        genres: args.genres || existing.genres || [],
        images: args.images || existing.images || [],
        lastSynced: Date.now(),
        popularity: existing.popularity || 0,
        followers: existing.followers || 0,
        upcomingShowsCount: existing.upcomingShowsCount || 0,
        trendingScore: existing.trendingScore || 0,
      });
      // Sync post-merge via scheduler (async, non-blocking)
      void ctx.scheduler.runAfter(0, internal.ticketmaster.syncArtistShows, { artistId: existing._id, ticketmasterId: args.ticketmasterId });
      void ctx.scheduler.runAfter(1000, internal.spotify.enrichArtistBasics, { artistId: existing._id, artistName: args.name });
      return existing._id;
    }

    // Create new
    const baseSlug = args.name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existingWithSlug = await ctx.db
        .query("artists")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!existingWithSlug) break;
      if (existingWithSlug.ticketmasterId === args.ticketmasterId) return existingWithSlug._id;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const artistId = await ctx.db.insert("artists", {
      slug,
      name: args.name,
      ticketmasterId: args.ticketmasterId,
      genres: args.genres || [],
      images: args.images || [],
      isActive: true,
      popularity: 0,
      followers: 0,
      lastSynced: Date.now(),
      trendingScore: 0,
      upcomingShowsCount: 0,
      lastTrendingUpdate: Date.now(),
      lowerName,
    });

    // Post-create sync via scheduler
    void ctx.scheduler.runAfter(0, internal.ticketmaster.syncArtistShows, { artistId, ticketmasterId: args.ticketmasterId });
    void ctx.scheduler.runAfter(1000, internal.spotify.enrichArtistBasics, { artistId, artistName: args.name });

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
    spotifyId: v.optional(v.string()),
    image: v.optional(v.string()),
    genres: v.array(v.string()),
    popularity: v.optional(v.number()),
    followers: v.optional(v.number()),
    lastSynced: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lowerName = args.name.toLowerCase();
    const existingByName = await ctx.db
      .query("artists")
      .withIndex("by_lower_name", (q) => q.eq("lowerName", lowerName))
      .first();

    if (existingByName) {
      await ctx.db.patch(existingByName._id, {
        genres: args.genres,
        images: args.image ? [args.image] : existingByName.images,
        spotifyId: args.spotifyId || existingByName.spotifyId,
        popularity: args.popularity || existingByName.popularity || 0,
        followers: args.followers || existingByName.followers || 0,
        lastSynced: args.lastSynced || Date.now(),
        trendingScore: existingByName.trendingScore || 0,
        upcomingShowsCount: existingByName.upcomingShowsCount || 0,
      });
      // Sync if new Spotify data via scheduler
      if (args.spotifyId) {
        void ctx.scheduler.runAfter(0, internal.spotify.enrichArtistBasics, { artistId: existingByName._id, artistName: args.name });
      }
      return existingByName._id;
    }

    // Create logic similar to above, with all fields set
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
      popularity: args.popularity ?? 0,
      followers: args.followers ?? 0,
      lastSynced: args.lastSynced ?? Date.now(),
      isActive: true,
      trendingScore: 0,
      upcomingShowsCount: 0,
      lastTrendingUpdate: Date.now(),
      lowerName,
    });

    // Post-create sync via scheduler
    if (args.spotifyId) {
      void ctx.scheduler.runAfter(0, internal.spotify.enrichArtistBasics, { artistId, artistName: args.name });
    }

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


