"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

// PUBLIC: Trigger data integrity maintenance
export const triggerDataMaintenance = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runAction(internal.maintenance.fixMissingArtistData, {});
    return null;
  },
});

// PUBLIC: Manually trigger trending data sync for testing
export const triggerTrendingSync = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runAction(internal.maintenance.syncTrendingData, {});
    return null;
  },
});

// CRITICAL: Fix artists with missing spotifyId or other data
export const fixMissingArtistData = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔧 Starting data integrity maintenance...");
    
    try {
      // Get artists with missing Spotify data
      const incompleteArtists = await ctx.runQuery(internal.artists.getAllForMaintenance, {});
      
      console.log(`📊 Found ${incompleteArtists.length} artists with missing data`);
      
      let fixedCount = 0;
      
      for (const artist of incompleteArtists.slice(0, 20)) { // Limit to prevent timeouts
        try {
          if (!artist.spotifyId && artist.name) {
            console.log(`🔍 Fixing Spotify data for: ${artist.name}`);
            
            // Trigger Spotify sync to populate missing data
            await ctx.runAction(internal.spotify.syncArtistCatalog, {
              artistId: artist._id,
              artistName: artist.name,
            });
            
            fixedCount++;
          }
          
          // Rate limiting to respect APIs
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



// Sync trending data from external APIs
export const syncTrendingData = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("📈 Syncing trending data from APIs...");
    
    try {
      // Fetch trending data from Ticketmaster API
      const trendingShows = await ctx.runAction(api.ticketmaster.getTrendingShows, { limit: 50 });
      const trendingArtists = await ctx.runAction(api.ticketmaster.getTrendingArtists, { limit: 30 });
      
      // Save to database tables for fast querying
      await ctx.runMutation(internal.trending.saveTrendingShows, { shows: trendingShows });
      await ctx.runMutation(internal.trending.saveTrendingArtists, { artists: trendingArtists });
      
      console.log(`✅ Synced and saved ${trendingShows.length} trending shows and ${trendingArtists.length} trending artists to database`);
      
    } catch (error) {
      console.error("❌ Failed to sync trending data:", error);
    }
    
    return null;
  },
});

// Clean up orphaned records
export const cleanupOrphanedRecords = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🧹 Starting database cleanup...");
    
    try {
      // Clean up orphaned songs
      await ctx.runMutation(internal.songs.cleanupOrphanedSongs, {});
      
      console.log("✅ Database cleanup completed");
      
    } catch (error) {
      console.error("❌ Database cleanup failed:", error);
    }
    
    return null;
  },
});
