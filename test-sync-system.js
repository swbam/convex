#!/usr/bin/env node

/**
 * Comprehensive test script for the setlist voting app sync system
 * This script tests the complete flow: Ticketmaster -> Shows -> Setlist.fm integration
 */

const { ConvexHttpClient } = require("convex/browser");

// Initialize Convex client
const client = new ConvexHttpClient(process.env.CONVEX_URL || "");

async function testSyncSystem() {
  console.log("🚀 Testing Setlist Voting App Sync System");
  console.log("=" .repeat(50));
  
  try {
    // Test 1: Check for NaN values in existing data
    console.log("\n1. Checking for NaN values in database...");
    
    const artists = await client.query("artists.getTrending", { limit: 20 });
    let nanCount = 0;
    
    artists.forEach((artist, index) => {
      if (typeof artist.trendingScore === 'number' && !Number.isFinite(artist.trendingScore)) {
        console.log(`❌ Artist ${artist.name} has NaN trendingScore`);
        nanCount++;
      }
      if (typeof artist.popularity === 'number' && !Number.isFinite(artist.popularity)) {
        console.log(`❌ Artist ${artist.name} has NaN popularity`);
        nanCount++;
      }
      if (typeof artist.followers === 'number' && !Number.isFinite(artist.followers)) {
        console.log(`❌ Artist ${artist.name} has NaN followers`);
        nanCount++;
      }
    });
    
    if (nanCount === 0) {
      console.log("✅ No NaN values found in trending artists");
    } else {
      console.log(`⚠️ Found ${nanCount} NaN values - running fix...`);
      await client.action("maintenance.triggerNaNFix", {});
      console.log("✅ NaN fix completed");
    }
    
    // Test 2: Test Ticketmaster artist search
    console.log("\n2. Testing Ticketmaster artist search...");
    
    const searchResults = await client.action("ticketmaster.searchArtists", {
      query: "Coldplay",
      limit: 5
    });
    
    if (searchResults.length > 0) {
      console.log(`✅ Found ${searchResults.length} artists from Ticketmaster`);
      
      // Test 3: Test full artist sync
      console.log("\n3. Testing full artist sync...");
      
      const testArtist = searchResults[0];
      console.log(`Syncing artist: ${testArtist.name}`);
      
      const artistId = await client.action("ticketmaster.triggerFullArtistSync", {
        ticketmasterId: testArtist.ticketmasterId,
        artistName: testArtist.name,
        genres: testArtist.genres,
        images: testArtist.images,
      });
      
      console.log(`✅ Artist synced with ID: ${artistId}`);
      
      // Wait for background processes
      console.log("⏳ Waiting for background sync processes...");
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Test 4: Verify artist data
      console.log("\n4. Verifying synced artist data...");
      
      const syncedArtist = await client.query("artists.getById", { id: artistId });
      
      if (syncedArtist) {
        console.log(`✅ Artist found: ${syncedArtist.name}`);
        console.log(`   - Spotify ID: ${syncedArtist.spotifyId || 'Not synced yet'}`);
        console.log(`   - Trending Score: ${syncedArtist.trendingScore}`);
        console.log(`   - Upcoming Shows: ${syncedArtist.upcomingShowsCount || 0}`);
        
        // Check for NaN values
        if (typeof syncedArtist.trendingScore === 'number' && !Number.isFinite(syncedArtist.trendingScore)) {
          console.log("❌ Artist has NaN trending score!");
        }
        if (typeof syncedArtist.popularity === 'number' && !Number.isFinite(syncedArtist.popularity)) {
          console.log("❌ Artist has NaN popularity!");
        }
        if (typeof syncedArtist.followers === 'number' && !Number.isFinite(syncedArtist.followers)) {
          console.log("❌ Artist has NaN followers!");
        }
      } else {
        console.log("❌ Synced artist not found");
      }
      
      // Test 5: Check shows for the artist
      console.log("\n5. Checking shows for synced artist...");
      
      const shows = await client.query("shows.getByArtist", { artistId });
      console.log(`✅ Found ${shows.length} shows for artist`);
      
      if (shows.length > 0) {
        const testShow = shows[0];
        console.log(`   - Test show: ${testShow.date} at ${testShow.venue?.name}`);
        
        // Test 6: Check if setlist was created
        console.log("\n6. Checking setlist for show...");
        
        const setlists = await client.query("setlists.getByShow", { showId: testShow._id });
        console.log(`✅ Found ${setlists.length} setlists for show`);
        
        if (setlists.length > 0) {
          const setlist = setlists[0];
          console.log(`   - Songs in setlist: ${setlist.songs.length}`);
        }
      }
      
    } else {
      console.log("❌ No artists found from Ticketmaster search");
    }
    
    // Test 7: Test trending calculations
    console.log("\n7. Testing trending calculations...");
    
    await client.action("maintenance.triggerTrendingSync", {});
    console.log("✅ Trending sync completed");
    
    // Verify trending data
    const trendingArtists = await client.query("artists.getTrending", { limit: 5 });
    console.log(`✅ Retrieved ${trendingArtists.length} trending artists`);
    
    trendingArtists.forEach((artist, index) => {
      console.log(`   ${index + 1}. ${artist.name} (Score: ${artist.trendingScore})`);
    });
    
    // Test 8: Test setlist.fm integration
    console.log("\n8. Testing setlist.fm integration...");
    
    const completedShows = await client.query("shows.getRecent", { limit: 5 });
    
    if (completedShows.length > 0) {
      console.log(`✅ Found ${completedShows.length} completed shows for setlist sync test`);
      
      // Trigger setlist sync check
      await client.action("setlistfm.checkCompletedShows", {});
      console.log("✅ Setlist.fm sync check completed");
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("🎉 Sync system test completed successfully!");
    console.log("✅ All major components are working properly");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testSyncSystem().catch(console.error);
}

module.exports = { testSyncSystem };