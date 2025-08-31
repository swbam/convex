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

// PUBLIC: Check recent shows and their setlists
export const checkRecentShows = action({
  args: {},
  returns: v.object({
    recentShows: v.array(v.any()),
    showsWithSetlists: v.array(v.any()),
    totalShows: v.number(),
    showsWithOfficialSetlists: v.number(),
  }),
  handler: async (ctx) => {
    // Get shows from last 2 days
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoString = twoDaysAgo.toISOString().split('T')[0];
    
    // Get all shows
    const allShows: any[] = await ctx.runQuery(api.shows.getAll, { limit: 1000 });
    
    // Filter shows from last 2 days
    const recentShows: any[] = allShows.filter((show: any) => show.date >= twoDaysAgoString);
    
    // Check which shows have setlists
    const showsWithSetlists = [];
    let showsWithOfficialSetlists = 0;
    
    for (const show of recentShows) {
      const setlists: any[] = await ctx.runQuery(api.setlists.getByShow, { showId: show._id });
      const officialSetlist: any = setlists?.find((s: any) => s.isOfficial);
      const communitySetlist: any = setlists?.find((s: any) => !s.isOfficial);
      
      if (setlists && setlists.length > 0) {
        showsWithSetlists.push({
          ...show,
          hasOfficialSetlist: !!officialSetlist,
          hasCommunitySetlist: !!communitySetlist,
          officialSongCount: officialSetlist?.songs?.length || 0,
          communitySongCount: communitySetlist?.songs?.length || 0,
          setlistfmId: officialSetlist?.setlistfmId,
        });
        
        if (officialSetlist) showsWithOfficialSetlists++;
      }
    }
    
    return {
      recentShows,
      showsWithSetlists,
      totalShows: recentShows.length,
      showsWithOfficialSetlists,
    };
  },
});

// REMOVED: Test data functions - using only real data sync system

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
      
      // Process trending shows to ensure artist data is properly linked
      const processedShows = [];
      for (const show of trendingShows) {
        try {
          // Check if artist exists in database
          let artistId = null;
          if (show.artistTicketmasterId) {
            const artist = await ctx.runQuery(internal.artists.getByTicketmasterIdInternal, { 
              ticketmasterId: show.artistTicketmasterId 
            });
            
            if (artist) {
              artistId = artist._id;
            } else {
              // Import the artist if not exists
              console.log(`🎤 Importing artist: ${show.artistName}`);
              artistId = await ctx.runAction(api.ticketmaster.triggerFullArtistSync, {
                ticketmasterId: show.artistTicketmasterId,
                artistName: show.artistName,
                genres: [],
                images: show.artistImage ? [show.artistImage] : [],
              });
            }
          }
          
          processedShows.push({
            ...show,
            artistId: artistId || null,
          });
        } catch (error) {
          console.error(`Failed to process show for ${show.artistName}:`, error);
          processedShows.push(show);
        }
      }
      
      // Process trending artists to ensure they exist in database
      const processedArtists = [];
      for (const artist of trendingArtists) {
        try {
          // Check if artist exists
          const existingArtist = await ctx.runQuery(internal.artists.getByTicketmasterIdInternal, { 
            ticketmasterId: artist.ticketmasterId 
          });
          
          if (!existingArtist) {
            // Import the artist
            console.log(`🎤 Importing trending artist: ${artist.name}`);
            await ctx.runAction(api.ticketmaster.triggerFullArtistSync, {
              ticketmasterId: artist.ticketmasterId,
              artistName: artist.name,
              genres: artist.genres || [],
              images: artist.images || [],
            });
          }
          
          processedArtists.push(artist);
        } catch (error) {
          console.error(`Failed to process artist ${artist.name}:`, error);
          processedArtists.push(artist);
        }
      }
      
      // Save to database tables for fast querying
      await ctx.runMutation(internal.trending.saveTrendingShows, { shows: processedShows });
      await ctx.runMutation(internal.trending.saveTrendingArtists, { artists: processedArtists });
      
      console.log(`✅ Synced and saved ${processedShows.length} trending shows and ${processedArtists.length} trending artists to database`);
      
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
