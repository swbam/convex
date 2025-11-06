import { internalMutation, internalAction, internalQuery, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * CRITICAL: Import cached trending shows into main database
 * This fixes the "No shows available" issue on homepage
 * 
 * Process:
 * 1. Fetch all trending shows from cache
 * 2. For each cache-only show (no showId link):
 *    a. Get/create artist
 *    b. Get/create venue
 *    c. Create show document
 *    d. Link cache entry to new show
 */

export const importCachedTrendingShows = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    imported: v.number(),
    skipped: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    console.log(`🔄 Starting import of cached trending shows (limit: ${limit})`);
    
    const stats = {
      processed: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
    };
    
    // Get all trending shows from cache
    const cachedShows = await ctx.runQuery(internal.trendingImport.getCachedShowsNeedingImport, { limit });
    
    for (const cachedShow of cachedShows) {
      stats.processed++;
      
      try {
        // Skip if already linked to a real show
        if (cachedShow.showId) {
          stats.skipped++;
          continue;
        }
        
        // Get or create artist
        let artistId: Id<"artists"> | null = null;
        
        if (cachedShow.artistId) {
          // Already linked to artist
          artistId = cachedShow.artistId;
        } else if (cachedShow.artistTicketmasterId) {
          // Find artist by Ticketmaster ID
          const existingArtist = await ctx.runQuery(
            internal.artists.getByTicketmasterIdInternal,
            { ticketmasterId: cachedShow.artistTicketmasterId }
          );
          
          if (existingArtist) {
            artistId = existingArtist._id;
          } else {
            // Create new artist
            artistId = await ctx.runMutation(internal.artists.createFromTicketmaster, {
              ticketmasterId: cachedShow.artistTicketmasterId,
              name: cachedShow.artistName,
              genres: [],
              images: cachedShow.artistImage ? [cachedShow.artistImage] : [],
            });
            console.log(`✅ Created artist: ${cachedShow.artistName}`);
          }
        }
        
        if (!artistId) {
          console.warn(`⚠️ No artist found/created for show: ${cachedShow.ticketmasterId}`);
          stats.errors++;
          continue;
        }
        
        // Get or create venue (createFromTicketmaster handles deduplication)
        const venueId = await ctx.runMutation(internal.venues.createFromTicketmaster, {
          name: cachedShow.venueName,
          city: cachedShow.venueCity,
          country: cachedShow.venueCountry,
        });
        console.log(`✅ Got/created venue: ${cachedShow.venueName}, ${cachedShow.venueCity}`);
        
        // Create the show
        const showId = await ctx.runMutation(internal.shows.createFromTicketmaster, {
          artistId,
          venueId,
          ticketmasterId: cachedShow.ticketmasterId,
          date: cachedShow.date,
          startTime: cachedShow.startTime,
          status: cachedShow.status as "upcoming" | "completed" | "cancelled",
          ticketUrl: cachedShow.ticketUrl,
        });
        
        // Update cache entry with link to real show
        await ctx.runMutation(internal.trendingImport.linkCacheToShow, {
          cacheId: cachedShow._id,
          showId,
        });
        
        stats.imported++;
        console.log(`✅ Imported show: ${cachedShow.artistName} at ${cachedShow.venueName} (${stats.imported}/${stats.processed})`);
        
      } catch (error) {
        stats.errors++;
        console.error(`❌ Failed to import show ${cachedShow.ticketmasterId}:`, error);
      }
    }
    
    console.log(`✅ Import complete: ${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors`);
    return stats;
  },
});

// Get cached shows that need importing (no showId link)
export const getCachedShowsNeedingImport = internalQuery({
  args: { limit: v.number() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("trendingShows")
      .take(args.limit);
    
    // Filter to shows without showId (not yet imported)
    return cached.filter(show => !show.showId);
  },
});

// Link cache entry to real show document
export const linkCacheToShow = internalMutation({
  args: {
    cacheId: v.id("trendingShows"),
    showId: v.id("shows"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.showId);
    if (!show) {
      throw new Error("Show not found");
    }
    
    await ctx.db.patch(args.cacheId, {
      showId: args.showId,
      showSlug: show.slug,
    });
    
    return null;
  },
});

// Public action to trigger the import (can be called from CLI or admin panel)
export const triggerTrendingShowImport = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    imported: v.number(),
    skipped: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx, args): Promise<{ processed: number; imported: number; skipped: number; errors: number }> => {
    return await ctx.runAction(internal.trendingImport.importCachedTrendingShows, {
      limit: args.limit ?? 50,
    });
  },
});

