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
    console.log("📈 Syncing trending data...");
    
    try {
      // Get existing artists and shows from database as fallback
      const allArtists = await ctx.runQuery(api.artists.getTrending, { limit: 30 });
      const allShows = await ctx.runQuery(api.shows.getUpcoming, { limit: 50 });
      
      // Format artists for trending
      const trendingArtists = allArtists
        .filter(artist => artist.name && artist.name !== 'Unknown Artist')
        .map(artist => ({
          ticketmasterId: artist.ticketmasterId || artist._id,
          name: artist.name,
          genres: artist.genres || [],
          images: artist.images || [],
          upcomingEvents: artist.upcomingShows || 0,
          url: artist.url || '',
        }));
      
      // Format shows for trending
      const trendingShows = allShows
        .filter(show => show.artist?.name && show.artist.name !== 'Unknown Artist')
        .map(show => ({
          ticketmasterId: show.ticketmasterId || show._id,
          artistTicketmasterId: show.artist?.ticketmasterId,
          artistId: show.artist?._id,
          artistName: show.artist?.name || 'Unknown Artist',
          venueName: show.venue?.name || 'Unknown Venue',
          venueCity: show.venue?.city || '',
          venueCountry: show.venue?.country || '',
          date: show.date,
          startTime: show.startTime,
          artistImage: show.artist?.images?.[0],
          ticketUrl: show.ticketUrl,
          priceRange: show.priceRange,
          status: show.status || 'upcoming',
          lastUpdated: Date.now(),
        }));
      
      // Try to get data from Ticketmaster API
      try {
        const apiShows = await ctx.runAction(api.ticketmaster.getTrendingShows, { limit: 20 });
        const apiArtists = await ctx.runAction(api.ticketmaster.getTrendingArtists, { limit: 20 });
        
        // If API returns data, use it; otherwise use fallback
        if (apiShows.length > 0) {
          console.log(`✅ Got ${apiShows.length} shows from Ticketmaster API`);
          trendingShows.unshift(...apiShows);
        }
        if (apiArtists.length > 0) {
          console.log(`✅ Got ${apiArtists.length} artists from Ticketmaster API`);
          trendingArtists.unshift(...apiArtists);
        }
      } catch (error) {
        console.log("⚠️ Ticketmaster API failed, using database fallback");
      }
      
      // Save to database tables for fast querying
      if (trendingShows.length > 0) {
        await ctx.runMutation(internal.trending.saveTrendingShows, { shows: trendingShows.slice(0, 50) });
      }
      if (trendingArtists.length > 0) {
        await ctx.runMutation(internal.trending.saveTrendingArtists, { artists: trendingArtists.slice(0, 30) });
      }
      
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
