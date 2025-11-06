import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Bootstrap function to populate the app with initial trending data
 * Run this manually in Convex dashboard when setting up a new deployment
 * 
 * This will:
 * 1. Fetch trending artists from Ticketmaster
 * 2. Import top 10 trending artists with their shows
 * 3. Trigger trending sync to populate cache
 * 4. Result: Homepage will have data immediately
 */
export const bootstrapApp = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    artistsImported: v.number(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    console.log("🚀 Starting app bootstrap...");
    
    try {
      // Step 1: Fetch trending artists from Ticketmaster
      console.log("📡 Fetching trending artists from Ticketmaster...");
      const trendingArtists = await ctx.runAction(api.ticketmaster.getTrendingArtists, { limit: 15 });
      
      if (trendingArtists.length === 0) {
        console.warn("⚠️ No trending artists from Ticketmaster - API might be down or API key missing");
        return {
          success: false,
          artistsImported: 0,
          message: "Failed to fetch trending artists from Ticketmaster. Check your API key.",
        };
      }
      
      console.log(`✅ Found ${trendingArtists.length} trending artists`);
      
      // Step 2: Import top 10 artists (limit to avoid overwhelming the system)
      let imported = 0;
      const IMPORT_LIMIT = 10;
      
      for (let i = 0; i < Math.min(IMPORT_LIMIT, trendingArtists.length); i++) {
        const artist = trendingArtists[i];
        
        try {
          console.log(`📥 Importing ${i + 1}/${IMPORT_LIMIT}: ${artist.name}...`);
          
          await ctx.runAction(api.ticketmaster.triggerFullArtistSync, {
            ticketmasterId: artist.ticketmasterId,
            artistName: artist.name,
            genres: artist.genres,
            images: artist.images,
          });
          
          imported++;
          console.log(`✅ Imported ${artist.name}`);
          
          // Small delay to avoid overwhelming APIs
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Failed to import ${artist.name}:`, error);
          // Continue with next artist
        }
      }
      
      // Step 3: Trigger trending sync to populate cache
      console.log("🔄 Running trending sync to populate cache...");
      await ctx.runAction(api.maintenance.triggerTrendingSync, {});
      
      console.log(`🎉 Bootstrap complete! Imported ${imported} artists with their shows and songs.`);
      
      return {
        success: true,
        artistsImported: imported,
        message: `Successfully imported ${imported} artists. Homepage should now show trending data.`,
      };
      
    } catch (error) {
      console.error("❌ Bootstrap failed:", error);
      return {
        success: false,
        artistsImported: 0,
        message: `Bootstrap failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Quick check to see if app needs bootstrapping
 * Returns true if database is empty and needs initial data
 */
export const needsBootstrap = action({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    // Check if we have any artists - use internal query to check without limit restrictions
    try {
      const artistCheck = await ctx.runQuery(api.artists.getAll, { limit: 1 });
      const showCheck = await ctx.runQuery(api.shows.getAll, { limit: 1 });
      
      const isEmpty = (!artistCheck || (Array.isArray(artistCheck) && artistCheck.length === 0)) && 
                      (!showCheck || (Array.isArray(showCheck) && showCheck.length === 0));
      
      if (isEmpty) {
        console.log("⚠️ Database is empty - run bootstrapApp() to populate initial data");
      } else {
        console.log("✅ Database has data");
      }
      
      return isEmpty;
    } catch (error) {
      console.error("❌ Failed to check bootstrap status:", error);
      return false; // Assume it doesn't need bootstrap if we can't check
    }
  },
});
