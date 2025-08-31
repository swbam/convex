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
    const allShows = await ctx.runQuery(api.shows.getAll, { limit: 1000 });
    
    // Filter shows from last 2 days
    const recentShows = allShows.filter(show => show.date >= twoDaysAgoString);
    
    // Check which shows have setlists
    const showsWithSetlists = [];
    let showsWithOfficialSetlists = 0;
    
    for (const show of recentShows) {
      const setlists = await ctx.runQuery(api.setlists.getByShow, { showId: show._id });
      const officialSetlist = setlists?.find(s => s.isOfficial);
      const communitySetlist = setlists?.find(s => !s.isOfficial);
      
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

// PUBLIC: Populate database with sample data for testing
export const populateTestData = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🚀 Populating database with test data...");
    
    try {
      // Create test artists
      const testArtists = [
        { name: "Arctic Monkeys", genres: ["Rock", "Indie"], popularity: 85 },
        { name: "Taylor Swift", genres: ["Pop", "Country"], popularity: 95 },
        { name: "The Strokes", genres: ["Rock", "Indie"], popularity: 78 },
        { name: "Billie Eilish", genres: ["Pop", "Alternative"], popularity: 92 },
        { name: "Radiohead", genres: ["Alternative", "Rock"], popularity: 88 }
      ];
      
      for (const artistData of testArtists) {
        const artistId = await ctx.runMutation(internal.artists.createInternal, {
          name: artistData.name,
          spotifyId: `spotify_${artistData.name.toLowerCase().replace(/\s+/g, '_')}`,
          genres: artistData.genres,
          popularity: artistData.popularity,
          followers: Math.floor(Math.random() * 1000000) + 100000,
          lastSynced: Date.now(),
        });
        
        // Create test venue
        const venueId = await ctx.runMutation(internal.venues.createInternal, {
          name: `${artistData.name} Arena`,
          city: "New York",
          country: "USA",
          capacity: 20000,
        });
        
        // Create test shows (mix of upcoming and completed)
        const today = new Date();
        const futureDate = new Date(today.getTime() + (Math.random() * 30 + 1) * 24 * 60 * 60 * 1000);
        const pastDate = new Date(today.getTime() - (Math.random() * 30 + 1) * 24 * 60 * 60 * 1000);
        
        // Create upcoming show
        const upcomingShowId = await ctx.runMutation(internal.shows.createInternal, {
          artistId,
          venueId,
          date: futureDate.toISOString().split('T')[0],
          startTime: "20:00",
          status: "upcoming",
        });
        
        // Create completed show with sample setlist
        const completedShowId = await ctx.runMutation(internal.shows.createInternal, {
          artistId,
          venueId,
          date: pastDate.toISOString().split('T')[0],
          startTime: "20:00",
          status: "completed",
        });
        
        // Create official setlist for completed show
        const sampleSongs = [
          { title: "Do I Wanna Know?", album: "AM" },
          { title: "R U Mine?", album: "AM" },
          { title: "Arabella", album: "AM" },
          { title: "505", album: "Favourite Worst Nightmare" },
          { title: "I Bet You Look Good on the Dancefloor", album: "Whatever People Say I Am, That's What I'm Not" }
        ];
        
        // Create the official setlist using the internal function
        await ctx.db.insert("setlists", {
          showId: completedShowId,
          userId: undefined,
          songs: sampleSongs,
          verified: true,
          source: "setlistfm",
          lastUpdated: Date.now(),
          isOfficial: true,
          confidence: 1.0,
          upvotes: 0,
          downvotes: 0,
          setlistfmId: `setlistfm_${artistData.name.toLowerCase().replace(/\s+/g, '_')}`,
        });
        
        // Also create a community prediction setlist for comparison
        const communityPredictions = [
          { title: "Do I Wanna Know?" }, // Correct prediction
          { title: "Fluorescent Adolescent" }, // Wrong prediction
          { title: "R U Mine?" }, // Correct prediction
          { title: "Crying Lightning" }, // Wrong prediction
          { title: "505" }, // Correct prediction
        ];
        
        await ctx.db.insert("setlists", {
          showId: completedShowId,
          userId: undefined,
          songs: communityPredictions,
          verified: false,
          source: "user_submitted",
          lastUpdated: Date.now(),
          isOfficial: false,
          confidence: 0.7,
          upvotes: 15,
          downvotes: 3,
        });
      }
      
      console.log("✅ Test data populated successfully!");
      
    } catch (error) {
      console.error("❌ Failed to populate test data:", error);
    }
    
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
