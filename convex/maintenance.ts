"use node";

import { action, internalAction } from "./_generated/server";
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
      
      // Optional: Try to enrich with fresh Ticketmaster data
      try {
        const trendingArtists = await ctx.runAction(api.ticketmaster.getTrendingArtists, { limit: 10 });
        
        // Import any new trending artists from Ticketmaster
        for (const tmArtist of trendingArtists) {
          try {
            // Check if artist exists
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
            }
          } catch (error) {
            console.error(`Failed to import ${tmArtist.name}:`, error);
          }
        }
      } catch (error) {
        console.log("⚠️ Could not fetch Ticketmaster trending data:", error);
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