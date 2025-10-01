import { action, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

// Simplified trending sync - just update scores in main tables
export const syncTrendingData = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("📈 Updating trending scores...");
    
    try {
      // Step 1: Update artist show counts (cached)
      await ctx.runMutation(internal.trending.updateArtistShowCounts, {});
      console.log("✅ Updated artist show counts");
      
      // Step 2: Update artist trending scores and ranks
      await ctx.runMutation(internal.trending.updateArtistTrending, {});
      console.log("✅ Updated artist trending ranks");
      
      // Step 3: Update show trending scores and ranks
      await ctx.runMutation(internal.trending.updateShowTrending, {});
      console.log("✅ Updated show trending ranks");
      
      const fetchedAt = Date.now();
      let ticketmasterArtists: Array<any> = [];
      let ticketmasterShows: Array<any> = [];

      try {
        ticketmasterArtists = await ctx.runAction(api.ticketmaster.getTrendingArtists, { limit: 50 });
      } catch (error) {
        console.log("⚠️ Could not fetch Ticketmaster trending artists:", error);
      }

      try {
        ticketmasterShows = await ctx.runAction(api.ticketmaster.getTrendingShows, { limit: 50 });
      } catch (error) {
        console.log("⚠️ Could not fetch Ticketmaster trending shows:", error);
      }

      if (ticketmasterShows.length > 0) {
        await ctx.runMutation(internal.trending.replaceTrendingShowsCache, {
          fetchedAt,
          shows: ticketmasterShows.map((show, index) => ({
            ...show,
            rank: index + 1,
          })),
        });
      }

      if (ticketmasterArtists.length > 0) {
        await ctx.runMutation(internal.trending.replaceTrendingArtistsCache, {
          fetchedAt,
          artists: ticketmasterArtists.map((artist, index) => ({
            ...artist,
            rank: index + 1,
          })),
        });

        for (const tmArtist of ticketmasterArtists) {
          try {
            if (!tmArtist.ticketmasterId) continue;
            const existing = await ctx.runQuery(internal.artists.getByTicketmasterIdInternal, {
              ticketmasterId: tmArtist.ticketmasterId,
            });

            if (!existing) {
              console.log(`🆕 Importing trending artist: ${tmArtist.name}`);
              await ctx.runAction(api.ticketmaster.triggerFullArtistSync, {
                ticketmasterId: tmArtist.ticketmasterId,
                artistName: tmArtist.name,
                genres: tmArtist.genres,
                images: tmArtist.images,
              });
            }
          } catch (error) {
            console.error(`Failed to import ${tmArtist.name}:`, error);
          }
        }
      }

      console.log("✅ Trending data sync completed");
    } catch (error) {
      console.error("❌ Trending sync failed:", error);
    }
    
    return null;
  },
});

// Public action to trigger trending sync
export const triggerTrendingSync = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runAction(internal.maintenance.syncTrendingData, {});
    return null;
  },
});

// Fix missing artist data (unchanged)
export const fixMissingArtistData = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔧 Starting data integrity maintenance...");
    
    try {
      const incompleteArtists = await ctx.runQuery(internal.artists.getAllForMaintenance, {});
      
      console.log(`📊 Found ${incompleteArtists.length} artists to check`);
      
      let fixedCount = 0;
      
      for (const artist of incompleteArtists.slice(0, 20)) {
        try {
          if (!artist.spotifyId && artist.name) {
            console.log(`🔍 Fixing Spotify data for: ${artist.name}`);
            
            await ctx.runAction(internal.spotify.syncArtistCatalog, {
              artistId: artist._id,
              artistName: artist.name,
            });
            
            fixedCount++;
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
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
      await ctx.runMutation(internal.shows.cleanupOrphanedShows, {});
      console.log("✅ Shows cleanup completed");
      
      // Clean up orphaned songs (skip if it fails)
      try {
        await ctx.runMutation(internal.songs.cleanupOrphanedSongs, {});
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
      const artists = await ctx.runQuery(internal.artists.getAllForMaintenance, {});
      let fixedArtists = 0;
      
      for (const artist of artists) {
        let needsUpdate = false;
        
        // Fix NaN trendingScore by recalculating
        if (typeof artist.trendingScore === 'number' && !Number.isFinite(artist.trendingScore)) {
          needsUpdate = true;
        }
        
        // Fix NaN popularity
        if (typeof artist.popularity === 'number' && !Number.isFinite(artist.popularity)) {
          await ctx.runMutation(internal.artists.updateSpotifyData, {
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
          await ctx.runMutation(internal.artists.updateSpotifyData, {
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
      await ctx.runMutation(internal.trending.updateArtistShowCounts, {});
      await ctx.runMutation(internal.trending.updateArtistTrending, {});
      await ctx.runMutation(internal.trending.updateShowTrending, {});
      
      console.log("✅ Recalculated trending scores");
      
    } catch (error) {
      console.error("❌ Failed to fix NaN values:", error);
    }
    
    return null;
  },
});

// Public action to trigger NaN fix
export const triggerNaNFix = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runAction(internal.maintenance.fixNaNValues, {});
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
      // Step 1: Update engagement counts first (new)
      await ctx.runMutation(internal.trending.updateEngagementCounts, {});
      console.log("✅ Engagement counts updated");

      // Step 2: Update artist show counts
      await ctx.runMutation(internal.trending.updateArtistShowCounts, {});
      console.log("✅ Artist show counts updated");

      // Step 3: Update artist trending
      await ctx.runMutation(internal.trending.updateArtistTrending, {});
      console.log("✅ Artist trending updated");

      // Step 4: Update show trending with new weighting
      await ctx.runMutation(internal.trending.updateShowTrending, {});
      console.log("✅ Show trending updated");

      // Step 5: Optional Ticketmaster enrichment
      try {
        const trendingArtists = await ctx.runAction(api.ticketmaster.getTrendingArtists, { limit: 10 });
        let imported = 0;
        for (const tmArtist of trendingArtists) {
          try {
            const existing = await ctx.runQuery(internal.artists.getByTicketmasterIdInternal, {
              ticketmasterId: tmArtist.ticketmasterId
            });
            
            if (!existing) {
              console.log(`🆕 Importing trending artist: ${tmArtist.name}`);
              await ctx.runAction(api.ticketmaster.triggerFullArtistSync, {
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

    // Scan artists: missing counts or stale
    const incompleteArtists = await ctx.runQuery(internal.maintenance.getIncompleteArtists, { staleThreshold });

    for (const artist of incompleteArtists.slice(0, 10)) { // Limit to 10 per run
      try {
        if (artist.ticketmasterId) {
          await ctx.runAction(internal.ticketmaster.syncArtistShows, {
            artistId: artist._id,
            ticketmasterId: artist.ticketmasterId,
          });
          await ctx.runAction(internal.spotify.enrichArtistBasics, {
            artistId: artist._id,
            artistName: artist.name,
          });
        }
        const showCount = await ctx.runQuery(internal.shows.getUpcomingCountByArtist, { artistId: artist._id });
        await ctx.runMutation(internal.maintenance.updateArtistFields, {
          artistId: artist._id,
          upcomingShowsCount: showCount,
          lastSynced: now,
        });
        console.log(`✅ Populated fields for artist ${artist.name}`);
      } catch (e) {
        console.error(`❌ Failed to populate ${artist.name}:`, e);
      }
    }

    // Scan shows: missing artist/venue embeds or importStatus
    const incompleteShows = await ctx.runQuery(internal.maintenance.getIncompleteShows, {});

    for (const show of incompleteShows) {
      try {
        if (show.artistId) {
          const artist = await ctx.runQuery(internal.artists.getByIdInternal, { id: show.artistId });
          const venue = await ctx.runQuery(internal.venues.getByIdInternal, { id: show.venueId });
          
          if (artist || venue) {
            await ctx.runMutation(internal.maintenance.updateShowEmbeds, {
              showId: show._id,
              artist: artist ? { name: artist.name, slug: artist.slug, images: artist.images } : undefined,
              venue: venue ? { name: venue.name, city: venue.city, state: venue.state, country: venue.country } : undefined,
            });
          }
        }
        // Trigger setlist if completed and pending
        const artist = await ctx.runQuery(internal.artists.getByIdInternal, { id: show.artistId });
        const venue = await ctx.runQuery(internal.venues.getByIdInternal, { id: show.venueId });
        
        if (show.status === "completed" && (show.importStatus === "pending" || !show.importStatus) && artist && venue) {
          await ctx.scheduler.runAfter(0, internal.setlistfm.syncActualSetlist, {
            showId: show._id,
            artistName: artist.name,
            venueCity: venue.city,
            showDate: show.date,
          });
        }
        console.log(`✅ Fixed show ${show._id}`);
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
    return await ctx.db
      .query("artists")
      .filter((q) => q.or(
        q.eq(q.field("upcomingShowsCount"), 0),
        q.lt(q.field("lastSynced"), args.staleThreshold)
      ))
      .take(10);
  },
});

export const getIncompleteShows = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query("shows")
      .filter((q) => q.eq(q.field("status"), "completed"))
      .take(20);
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

export const updateShowEmbeds = internalMutation({
  args: { 
    showId: v.id("shows"), 
    artist: v.optional(v.any()),
    venue: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const update: any = {};
    if (args.artist) update.artist = args.artist;
    if (args.venue) update.venue = args.venue;
    if (Object.keys(update).length > 0) {
      await ctx.db.patch(args.showId, update);
    }
    return null;
  },
});

export const updateArtistCounts = internalAction({
  args: { artistId: v.id("artists") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const showCount = await ctx.runQuery(internal.shows.getUpcomingCountByArtist, { artistId: args.artistId });
    await ctx.runMutation(internal.maintenance.updateArtistFields, {
      artistId: args.artistId,
      upcomingShowsCount: showCount,
      lastSynced: Date.now(),
    });
    return null;
  },
});