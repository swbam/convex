import { action, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apiRef = api as any;

// Simplified trending sync - just update scores in main tables
export const syncTrendingData = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("📈 Updating trending scores...");

    // Acquire lock to prevent overlapping runs
    const lockName = "trending";
    const STALE_MS = 60 * 60 * 1000; // 60 minutes
    const acquired = await ctx.runMutation(internalRef.maintenance.acquireLock, { name: lockName, staleMs: STALE_MS });
    if (!acquired) {
      console.warn("⏳ Trending sync already running, skipping this invocation");
      return null;
    }
    
    try {
      // Step 1: Update artist show counts (cached)
      await ctx.runMutation(internalRef.trending.updateArtistShowCounts, {});
      console.log("✅ Updated artist show counts");
      
      // Step 2: Update artist trending scores and ranks
      await ctx.runMutation(internalRef.trending.updateArtistTrending, {});
      console.log("✅ Updated artist trending ranks");
      
      // Step 3: Update show trending scores and ranks
      await ctx.runMutation(internalRef.trending.updateShowTrending, {});
      console.log("✅ Updated show trending ranks");
      // NOTE:
      // We intentionally do NOT write to `trendingArtists`/`trendingShows` here.
      // Those tables are treated as external (Ticketmaster-driven) caches and are refreshed by
      // `admin.refreshTrendingCacheInternal`. Mixing internal engagement-based ranking into those
      // caches causes confusing homepage results (e.g. upcomingEvents=0 filtered out).

      console.log("✅ Trending data sync completed");
    } catch (error) {
      console.error("❌ Trending sync failed:", error);
    } finally {
      await ctx.runMutation(internalRef.maintenance.releaseLock, { name: lockName });
    }
    
    return null;
  },
});

// Internal helpers for maintenance lock
export const acquireLock = internalMutation({
  args: { name: v.string(), staleMs: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("maintenanceLocks")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (!existing) {
      await ctx.db.insert("maintenanceLocks", { name: args.name, isRunning: true, updatedAt: now });
      return true;
    }
    if (existing.isRunning && (now - existing.updatedAt) < args.staleMs) {
      return false;
    }
    await ctx.db.patch(existing._id, { isRunning: true, updatedAt: now });
    return true;
  },
});

export const releaseLock = internalMutation({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const lock = await ctx.db
      .query("maintenanceLocks")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (lock) {
      await ctx.db.patch(lock._id, { isRunning: false, updatedAt: Date.now() });
    }
    return null;
  },
});

// Public action to trigger trending sync
export const triggerTrendingSync = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runAction(internalRef.maintenance.syncTrendingData, {});
    return null;
  },
});

// Public: Normalize existing show slugs by removing legacy time suffix ("-hh-mm")
export const normalizeShowSlugs = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ processed: v.number(), updated: v.number() }),
  handler: async (ctx, args): Promise<{ processed: number; updated: number }> => {
    const result = await ctx.runMutation(internalRef.shows.normalizeSlugsInternal, { limit: args.limit ?? 1000 });
    return result as { processed: number; updated: number };
  },
});

// CRITICAL: Fix artists with 0 songs by importing Spotify catalogs
export const fixArtistsWithNoSongs = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ processed: v.number(), imported: v.number(), failed: v.number() }),
  handler: async (ctx, args): Promise<{ processed: number; imported: number; failed: number }> => {
    const limit = args.limit ?? 50;
    console.log(`🔍 Finding artists with 0 songs (limit: ${limit})...`);
    
    // Get all artists
    const artists = await ctx.runQuery(internalRef.artists.getAllInternal, { limit });
    let processed = 0;
    let imported = 0;
    let failed = 0;
    
    for (const artist of artists) {
      processed++;
      
      // Check if artist has any songs
      const artistSongs = await ctx.runQuery(internalRef.artistSongs.getByArtist, { artistId: artist._id });
      
      if (!artistSongs || artistSongs.length === 0) {
        console.log(`📥 Importing catalog for ${artist.name} (0 songs)...`);
        try {
          await ctx.runAction(internalRef.spotify.syncArtistCatalog, {
            artistId: artist._id,
            artistName: artist.name,
          });
          imported++;
          
          // Wait to respect rate limits
          await new Promise(r => setTimeout(r, 1000));
        } catch (error) {
          console.error(`❌ Failed to import catalog for ${artist.name}:`, error);
          failed++;
        }
      }
    }
    
    console.log(`✅ Catalog import complete: ${imported} imported, ${failed} failed, ${processed - imported - failed} already had songs`);
    
    // Now regenerate setlists for shows that don't have them
    console.log(`🎵 Regenerating missing setlists...`);
    const setlistResult = await ctx.runMutation(internalRef.setlists.refreshMissingAutoSetlists, { limit: 100 });
    console.log(`✅ Setlist generation: ${setlistResult.scheduled} setlist generations scheduled`);
    
    return { processed, imported, failed };
  },
});

// One-off backfill to seed auto-generated setlists for upcoming shows
export const backfillMissingSetlists = action({
  args: { limit: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const result = await ctx.runMutation(internalRef.setlists.refreshMissingAutoSetlists, { limit });
    console.log(`Backfill scheduled: ${result.scheduled} setlist generations queued`);
    return null;
  },
});

// CRITICAL: Regenerate all empty setlists (songs: [])
export const regenerateEmptySetlists = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ found: v.number(), deleted: v.number(), scheduled: v.number() }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    console.log(`🔍 Finding setlists with empty songs arrays (limit: ${limit})...`);
    
    // Get all setlists
    const allSetlists = await ctx.db.query("setlists").take(limit * 2); // Get more to filter
    
    // Filter for empty setlists (songs: [] or no songs)
    const emptySetlists = allSetlists.filter(s => 
      !s.isOfficial && // Don't touch official setlists
      (!s.songs || s.songs.length === 0) // Empty or missing songs
    );
    
    console.log(`📊 Found ${emptySetlists.length} empty setlists out of ${allSetlists.length} total`);
    
    let deleted = 0;
    let scheduled = 0;
    const showsToRegenerate = new Set<string>();
    
    // Delete empty placeholders and collect shows that need regeneration
    for (const setlist of emptySetlists.slice(0, limit)) {
      try {
        await ctx.db.delete(setlist._id);
        deleted++;
        showsToRegenerate.add(setlist.showId);
        console.log(`🗑️ Deleted empty setlist ${setlist._id} for show ${setlist.showId}`);
      } catch (error) {
        console.error(`❌ Failed to delete setlist ${setlist._id}:`, error);
      }
    }
    
    // Schedule regeneration for each show with staggered delays
    const showIds = Array.from(showsToRegenerate);
    for (let i = 0; i < showIds.length; i++) {
      const showIdStr = showIds[i];
      
      try {
        // Get show to find artistId - need to query since we only have string ID
        const shows = await ctx.db.query("shows").collect();
        const show = shows.find(s => s._id === showIdStr);
        
        if (!show || !show.artistId) {
          console.log(`⚠️ Show ${showIdStr} not found or missing artistId, skipping`);
          continue;
        }
        
        // Schedule with staggered delay (10 seconds apart)
        const delayMs = i * 10000;
        void ctx.scheduler.runAfter(delayMs, internalRef.setlists.autoGenerateSetlist, {
          showId: show._id,
          artistId: show.artistId,
        });
        scheduled++;
        console.log(`📅 Scheduled setlist regeneration for show ${showIdStr} (delay: ${delayMs}ms)`);
      } catch (error) {
        console.error(`❌ Failed to schedule regeneration for show ${showIdStr}:`, error);
      }
    }
    
    console.log(`✅ Regeneration complete: ${deleted} empty setlists deleted, ${scheduled} regenerations scheduled`);
    
    return {
      found: emptySetlists.length,
      deleted,
      scheduled,
    };
  },
});

// Public action to trigger empty setlist regeneration
export const triggerEmptySetlistRegeneration = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ found: v.number(), deleted: v.number(), scheduled: v.number() }),
  handler: async (ctx, args): Promise<{ found: number; deleted: number; scheduled: number }> => {
    const result = await ctx.runMutation(internalRef.maintenance.regenerateEmptySetlists, { limit: args.limit ?? 100 });
    return result;
  },
});

// CRITICAL: Import trending shows from cache into main database
export const importTrendingShows = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    imported: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const stats = { processed: 0, imported: 0, errors: 0 };
    
    const cached = await ctx.db.query("trendingShows").take(limit);
    
    for (const show of cached) {
      stats.processed++;
      if (show.showId) continue; // Skip if already imported
      
      try {
        if (!show.artistName || !show.venueName || !show.date) continue;
        
        // CRITICAL: US-only filter - skip non-US shows
        const country = (show.venueCountry || '').toLowerCase();
        const isUS = country === 'united states of america' || 
                     country === 'united states' || 
                     country === 'usa' || 
                     country === 'us';
        if (!isUS) continue;
        
        // Get/create artist
        let artistId = show.artistId;
        if (!artistId) {
          const lowerName = show.artistName.toLowerCase();
          let artist = await ctx.db.query("artists").withIndex("by_lower_name", (q) => q.eq("lowerName", lowerName)).first();
          if (!artist && show.artistTicketmasterId) {
            artist = await ctx.db.query("artists").withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", show.artistTicketmasterId!)).first();
          }
          if (!artist) {
            const slug = show.artistName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 100);
            artistId = await ctx.db.insert("artists", {
              slug, name: show.artistName, ticketmasterId: show.artistTicketmasterId, lowerName, genres: [],
              images: show.artistImage ? [show.artistImage] : [], isActive: true, popularity: 0, followers: 0,
              trendingScore: 0, trendingRank: 0, upcomingShowsCount: 0, lastSynced: Date.now(), lastTrendingUpdate: Date.now(),
            });
          } else {
            artistId = artist._id;
          }
        }
        
        // Get/create venue
        let venue = await ctx.db.query("venues").withIndex("by_name_city", (q) => q.eq("name", show.venueName).eq("city", show.venueCity)).first();
        const venueId = venue ? venue._id : await ctx.db.insert("venues", { name: show.venueName, city: show.venueCity, country: show.venueCountry });
        
        // Create show
        const artist = await ctx.db.get(artistId);
        const ven = await ctx.db.get(venueId);
        if (!artist || !ven) continue;
        
        const slug = `${artist.slug}-${ven.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${ven.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${show.date}`.substring(0, 200);
        const showId = await ctx.db.insert("shows", {
          slug, artistId, venueId, date: show.date, startTime: show.startTime,
          status: (show.status || '').includes('cancel') ? 'cancelled' as const : 'upcoming' as const,
          ticketmasterId: show.ticketmasterId, ticketUrl: show.ticketUrl, priceRange: show.priceRange,
          voteCount: 0, setlistCount: 0, trendingScore: 0, trendingRank: 0, lastSynced: Date.now(), lastTrendingUpdate: Date.now(),
        });
        
        await ctx.db.patch(show._id, { showId, artistId });
        stats.imported++;
      } catch (e) {
        stats.errors++;
      }
    }
    
    return stats;
  },
});

export const triggerShowImport = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ processed: v.number(), imported: v.number(), errors: v.number() }),
  handler: async (ctx, args): Promise<{processed: number; imported: number; errors: number}> => {
    return await ctx.runMutation(internalRef.maintenance.importTrendingShows, { limit: args.limit ?? 50 });
  },
});

// Fix missing artist data (unchanged)
export const fixMissingArtistData = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔧 Starting data integrity maintenance...");
    
    try {
      const incompleteArtists = await ctx.runQuery(internalRef.artists.getAllForMaintenance, {});
      
      console.log(`📊 Found ${incompleteArtists.length} artists to check`);
      
      let fixedCount = 0;
      
      for (const artist of incompleteArtists.slice(0, 20)) {
        try {
          if (!artist.spotifyId && artist.name) {
            console.log(`🔍 Fixing Spotify data for: ${artist.name}`);

            const delayMs = fixedCount * 1500;
            void ctx.scheduler.runAfter(delayMs, internalRef.spotify.syncArtistCatalog, {
              artistId: artist._id,
              artistName: artist.name,
            });

            fixedCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to fix artist ${artist.name}:`, error);
        }
      }
      
      console.log(`✅ Data integrity maintenance completed: ${fixedCount} artists fixed`);
      
    } catch (error) {
      console.error("❌ Data integrity maintenance failed:", error);
    }
    
    return null;
  },
});

// Clean up orphaned records (unchanged)
export const cleanupOrphanedRecords = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🧹 Starting database cleanup...");
    
    try {
      // Clean up shows with invalid artist references
      await ctx.runMutation(internalRef.shows.cleanupOrphanedShows, {});
      console.log("✅ Shows cleanup completed");
      
      // Clean up orphaned songs (skip if it fails)
      try {
        await ctx.runMutation(internalRef.songs.cleanupOrphanedSongs, {});
        console.log("✅ Songs cleanup completed");
      } catch (songError) {
        console.log("⚠️ Songs cleanup skipped:", songError);
      }
      
      console.log("✅ Database cleanup completed");
    } catch (error) {
      console.error("❌ Database cleanup failed:", error);
    }
    
    return null;
  },
});

// Fix existing NaN values in the database
export const fixNaNValues = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔧 Fixing NaN values in database...");
    
    try {
      // Fix artists with NaN trending scores
      const artists = await ctx.runQuery(internalRef.artists.getAllForMaintenance, {});
      let fixedArtists = 0;
      
      for (const artist of artists) {
        let needsUpdate = false;
        
        // Fix NaN trendingScore by recalculating
        if (typeof artist.trendingScore === 'number' && !Number.isFinite(artist.trendingScore)) {
          needsUpdate = true;
        }
        
        // Fix NaN popularity
        if (typeof artist.popularity === 'number' && !Number.isFinite(artist.popularity)) {
          await ctx.runMutation(internalRef.artists.updateSpotifyData, {
            artistId: artist._id,
            spotifyId: artist.spotifyId || "",
            followers: artist.followers,
            popularity: undefined, // Reset NaN popularity
            genres: artist.genres || [],
            images: artist.images || [],
          });
          needsUpdate = true;
        }
        
        // Fix NaN followers
        if (typeof artist.followers === 'number' && !Number.isFinite(artist.followers)) {
          await ctx.runMutation(internalRef.artists.updateSpotifyData, {
            artistId: artist._id,
            spotifyId: artist.spotifyId || "",
            followers: undefined, // Reset NaN followers
            popularity: artist.popularity,
            genres: artist.genres || [],
            images: artist.images || [],
          });
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          fixedArtists++;
        }
      }
      
      console.log(`✅ Fixed ${fixedArtists} artists with NaN values`);
      
      // Recalculate trending scores with proper NaN handling
      await ctx.runMutation(internalRef.trending.updateArtistShowCounts, {});
      await ctx.runMutation(internalRef.trending.updateArtistTrending, {});
      await ctx.runMutation(internalRef.trending.updateShowTrending, {});
      
      console.log("✅ Recalculated trending scores");
      
    } catch (error) {
      console.error("❌ Failed to fix NaN values:", error);
    }
    
    return null;
  },
});

// Cleanup old operational data (logs, webhook events) to keep DB lean
// FIXED: Use proper mutation calls instead of (ctx as any).db hack
export const cleanupOldOperationalData = internalAction({
  args: {
    olderThanMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = args.olderThanMs ?? now - THIRTY_DAYS;

    console.log("🧹 Cleaning up operational data older than", new Date(cutoff).toISOString());

    // Delete old error logs via mutation
    const logsDeleted = await ctx.runMutation(internalRef.maintenance.deleteOldErrorLogs, {
      cutoff,
      limit: 500,
    });

    // Delete old Clerk webhook events via mutation
    const webhooksDeleted = await ctx.runMutation(internalRef.maintenance.deleteOldWebhookEvents, {
      cutoff,
      limit: 500,
    });

    // Delete old cron run history
    const cronRunsDeleted = await ctx.runMutation(internalRef.maintenance.deleteOldCronRuns, {
      cutoff,
      limit: 500,
    });

    // Delete old admin audit logs
    const adminAuditDeleted = await ctx.runMutation(internalRef.maintenance.deleteOldAdminAuditLogs, {
      cutoff,
      limit: 500,
    });

    console.log(
      `✅ cleanupOldOperationalData complete. Deleted ${logsDeleted} errorLogs, ${webhooksDeleted} clerkWebhookEvents, ${cronRunsDeleted} cronRuns, ${adminAuditDeleted} adminAuditLogs`,
    );
    return null;
  },
});

// Public action to trigger NaN fix
export const triggerNaNFix = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runAction(internalRef.maintenance.fixNaNValues, {});
    return null;
  },
});

// Enhanced trending sync with detailed logging
export const syncTrendingDataWithLogging = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("📈 Starting enhanced trending sync with logging...");
    const startTime = Date.now();
    
    try {
      // Step 1: Update artist show counts
      await ctx.runMutation(internalRef.trending.updateArtistShowCounts, {});
      console.log("✅ Artist show counts updated");

      // Step 2: Update artist trending
      await ctx.runMutation(internalRef.trending.updateArtistTrending, {});
      console.log("✅ Artist trending updated");

      // Step 3: Update show trending with new weighting
      await ctx.runMutation(internalRef.trending.updateShowTrending, {});
      console.log("✅ Show trending updated");

      // Step 4: Optional Ticketmaster enrichment
      try {
        const trendingArtists: any[] = await ctx.runAction(apiRef.ticketmaster.getTrendingArtists, { limit: 10 });
        let imported = 0;
        for (const tmArtist of trendingArtists) {
          try {
            const existing = await ctx.runQuery(internalRef.artists.getByTicketmasterIdInternal, {
              ticketmasterId: tmArtist.ticketmasterId
            });
            
            if (!existing) {
              console.log(`🆕 Importing trending artist: ${tmArtist.name}`);
              await ctx.runAction(apiRef.ticketmaster.triggerFullArtistSync, {
                ticketmasterId: tmArtist.ticketmasterId,
                artistName: tmArtist.name,
                genres: tmArtist.genres,
                images: tmArtist.images,
              });
              imported++;
            }
          } catch (error) {
            console.error(`Failed to import ${tmArtist.name}:`, error);
          }
        }
        console.log(`✅ Imported ${imported} new trending artists from Ticketmaster`);
      } catch (error) {
        console.log("⚠️ Ticketmaster enrichment skipped:", error);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Enhanced trending sync completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Enhanced trending sync failed after ${duration}ms:`, error);
    }

    return null;
  },
});

export const populateMissingFields = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔍 Scanning for missing/incomplete fields...");

    const now = Date.now();
    const staleThreshold = now - 24 * 60 * 60 * 1000; // 24h

    // Artists: prioritize stale artists with Ticketmaster IDs (cheap index-driven selection).
    // Do not block on third-party APIs here; schedule staggered work instead.
    const staleArtists = await ctx.runQuery(internalRef.maintenance.getIncompleteArtists, { staleThreshold });
    const candidates = (staleArtists || [])
      .filter((a: any) => Boolean(a?.ticketmasterId) && a?.isActive !== false)
      .slice(0, 10);

    for (let i = 0; i < candidates.length; i++) {
      const artist = candidates[i];
      const delayMs = i * 2000;
      try {
        console.log(`🗓️ Scheduling field backfill for artist: ${artist.name} (delay: ${delayMs}ms)`);
        void ctx.scheduler.runAfter(delayMs, internalRef.ticketmaster.syncArtistShowsWithTracking, {
          artistId: artist._id,
          ticketmasterId: artist.ticketmasterId,
        });

        // Spotify basics are secondary and can be rate-limited separately.
        void ctx.scheduler.runAfter(delayMs + 5000, internalRef.spotify.enrichArtistBasics, {
          artistId: artist._id,
          artistName: artist.name,
        });
      } catch (e) {
        console.error(`❌ Failed to schedule backfill for artist ${artist.name}:`, e);
      }
    }

    // Shows: focus on completed shows that still need setlist.fm import.
    const incompleteShows = await ctx.runQuery(internalRef.maintenance.getIncompleteShows, {});

    let scheduledShows = 0;
    for (const show of incompleteShows) {
      try {
        const artist = await ctx.runQuery(internalRef.artists.getByIdInternal, { id: show.artistId });
        const venue = await ctx.runQuery(internalRef.venues.getByIdInternal, { id: show.venueId });
        
        const needsSetlistImport =
          show.status === "completed" &&
          (show.importStatus === "pending" || show.importStatus === "failed" || !show.importStatus) &&
          !show.setlistfmId;

        if (needsSetlistImport && artist && venue) {
          const delayMs = scheduledShows * 1500;
          scheduledShows += 1;
          void ctx.scheduler.runAfter(delayMs, internalRef.setlistfm.syncActualSetlist, {
            showId: show._id,
            artistName: artist.name,
            venueCity: venue.city,
            showDate: show.date,
          });
        }
      } catch (e) {
        console.error(`❌ Failed to fix show ${show._id}:`, e);
      }
    }

    console.log("✅ Missing fields population complete");
    return null;
  },
});

// Helper queries/mutations for populateMissingFields
export const getIncompleteArtists = internalQuery({
  args: { staleThreshold: v.number() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Index-driven: pull artists that haven't been synced recently.
    // Note: artists without lastSynced won't appear here; they should be rare.
    return await ctx.db
      .query("artists")
      .withIndex("by_last_synced", (q) => q.lt("lastSynced", args.staleThreshold))
      .order("asc")
      .take(50);
  },
});

export const getIncompleteShows = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    // Index-driven: recent completed shows. We do the finer filtering in the action.
    return await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .order("desc")
      .take(50);
  },
});

export const updateArtistFields = internalMutation({
  args: { artistId: v.id("artists"), upcomingShowsCount: v.number(), lastSynced: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.artistId, {
      upcomingShowsCount: args.upcomingShowsCount,
      lastSynced: args.lastSynced,
    });
    return null;
  },
});

export const updateArtistCounts = internalAction({
  args: { artistId: v.id("artists") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const showCount = await ctx.runQuery(internalRef.shows.getUpcomingCountByArtist, { artistId: args.artistId });
    await ctx.runMutation(internalRef.maintenance.updateArtistFields, {
      artistId: args.artistId,
      upcomingShowsCount: showCount,
      lastSynced: Date.now(),
    });
    return null;
  },
});

// Helper mutation to delete old error logs
export const deleteOldErrorLogs = internalMutation({
  args: { cutoff: v.number(), limit: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("errorLogs")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", args.cutoff))
      .take(args.limit);
    
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }
    
    return logs.length;
  },
});

// Helper mutation to delete old webhook events
export const deleteOldWebhookEvents = internalMutation({
  args: { cutoff: v.number(), limit: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("clerkWebhookEvents")
      .filter((q) => q.lt(q.field("processedAt"), args.cutoff))
      .take(args.limit);
    
    for (const evt of events) {
      await ctx.db.delete(evt._id);
    }
    
    return events.length;
  },
});

export const deleteOldCronRuns = internalMutation({
  args: { cutoff: v.number(), limit: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("cronRuns")
      .withIndex("by_started_at", (q) => q.lt("startedAt", args.cutoff))
      .take(args.limit);
    for (const r of runs) {
      await ctx.db.delete(r._id);
    }
    return runs.length;
  },
});

export const deleteOldAdminAuditLogs = internalMutation({
  args: { cutoff: v.number(), limit: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("adminAuditLogs")
      .withIndex("by_created_at", (q) => q.lt("createdAt", args.cutoff))
      .take(args.limit);
    for (const l of logs) {
      await ctx.db.delete(l._id);
    }
    return logs.length;
  },
});

// Helper mutation to delete old sync jobs
export const deleteOldSyncJobs = internalMutation({
  args: { status: v.string(), cutoff: v.number(), limit: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Only allow "completed" or "failed" status
    if (args.status !== "completed" && args.status !== "failed") {
      return 0;
    }
    
    const jobs = await ctx.db
      .query("syncJobs")
      .withIndex("by_status", (q) => q.eq("status", args.status as any))
      .take(args.limit);
    
    let deleted = 0;
    for (const job of jobs) {
      const completedAt = job.completedAt ?? job.startedAt ?? job._creationTime;
      if (typeof completedAt === "number" && completedAt < args.cutoff) {
        await ctx.db.delete(job._id);
        deleted++;
      }
    }
    
    return deleted;
  },
});

// Periodic cleanup of old sync jobs and error logs to keep the database lean
export const cleanupOldJobsAndErrors = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🧹 Cleaning up old sync jobs and error logs...");

    const now = Date.now();
    const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const cutoff = now - RETENTION_MS;

    // 1) Delete old error logs in batches
    const LOG_BATCH = 100;
    let logsDeleted = 0;
    let batch = 0;
    
    do {
      batch = await ctx.runMutation(internalRef.maintenance.deleteOldErrorLogs, {
        cutoff,
        limit: LOG_BATCH,
      });
      logsDeleted += batch;
    } while (batch === LOG_BATCH);

    // 2) Delete old completed/failed sync jobs in batches
    const JOB_BATCH = 100;
    let jobsDeleted = 0;
    const jobStatuses: Array<"completed" | "failed"> = ["completed", "failed"];

    for (const status of jobStatuses) {
      let batch = 0;
      do {
        batch = await ctx.runMutation(internalRef.maintenance.deleteOldSyncJobs, {
          status,
          cutoff,
          limit: JOB_BATCH,
        });
        jobsDeleted += batch;
      } while (batch === JOB_BATCH);
    }

    console.log(`✅ Cleanup complete. Deleted ${logsDeleted} error logs and ${jobsDeleted} sync jobs older than 30 days.`);
    return null;
  },
});
