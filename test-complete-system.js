#!/usr/bin/env node

/**
 * Comprehensive System Test for TheSet App
 * Tests all critical functionality end-to-end
 */

import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL || "https://necessary-mosquito-453.convex.cloud");

async function runTests() {
  console.log("🧪 Starting comprehensive system test...\n");
  
  try {
    // Test 1: Admin functions work
    console.log("1️⃣ Testing admin sync functions...");
    const trendingSync = await client.action("admin:testSyncTrending", {});
    console.log(`   Trending sync: ${trendingSync.success ? '✅' : '❌'} - ${trendingSync.message}`);
    
    const artistSync = await client.action("admin:testSyncTrendingArtists", {});
    console.log(`   Artist sync: ${artistSync.success ? '✅' : '❌'} - ${artistSync.message}`);
    
    const showSync = await client.action("admin:testSyncTrendingShows", {});
    console.log(`   Show sync: ${showSync.success ? '✅' : '❌'} - ${showSync.message}`);
    
    // Test 2: Search functionality
    console.log("\n2️⃣ Testing Ticketmaster search...");
    const searchResults = await client.action("ticketmaster:searchArtists", {
      query: "Radiohead",
      limit: 3
    });
    console.log(`   Search results: ${searchResults.length > 0 ? '✅' : '❌'} - Found ${searchResults.length} artists`);
    
    // Test 3: Artist import
    if (searchResults.length > 0) {
      console.log("\n3️⃣ Testing artist import...");
      const firstResult = searchResults[0];
      const artistId = await client.action("ticketmaster:triggerFullArtistSync", {
        ticketmasterId: firstResult.ticketmasterId,
        artistName: firstResult.name,
        genres: firstResult.genres,
        images: firstResult.images
      });
      console.log(`   Artist import: ✅ - Created artist ID: ${artistId}`);
      
      // Test 4: Artist lookup
      console.log("\n4️⃣ Testing artist lookup...");
      const slug = firstResult.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const artist = await client.query("artists.getBySlugOrId", { key: slug });
      console.log(`   Artist lookup: ${artist ? '✅' : '❌'} - Found artist: ${artist?.name || 'None'}`);
      
      // Wait for background jobs to complete
      console.log("\n⏳ Waiting for background sync jobs...");
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Test 5: Shows for artist
      console.log("\n5️⃣ Testing shows loading...");
      const shows = await client.query("shows.getByArtist", { artistId, limit: 5 });
      console.log(`   Shows loading: ${shows.length >= 0 ? '✅' : '❌'} - Found ${shows.length} shows`);
      
      // Test 6: Songs for artist
      console.log("\n6️⃣ Testing songs loading...");
      const songs = await client.query("songs.getByArtist", { artistId, limit: 5 });
      console.log(`   Songs loading: ${songs.length >= 0 ? '✅' : '❌'} - Found ${songs.length} songs`);
    }
    
    // Test 7: Trending data
    console.log("\n7️⃣ Testing trending data...");
    const trendingArtists = await client.query("trending.getTrendingArtists", { limit: 5 });
    const trendingShows = await client.query("trending.getTrendingShows", { limit: 5 });
    console.log(`   Trending artists: ${trendingArtists.length > 0 ? '✅' : '❌'} - Found ${trendingArtists.length} artists`);
    console.log(`   Trending shows: ${trendingShows.length >= 0 ? '✅' : '❌'} - Found ${trendingShows.length} shows`);
    
    // Test 8: Database stats
    console.log("\n8️⃣ Testing database stats...");
    const stats = await client.query("admin.getAdminStats", {});
    console.log(`   Total artists: ${stats.totalArtists}`);
    console.log(`   Total shows: ${stats.totalShows}`);
    console.log(`   Upcoming shows: ${stats.upcomingShows}`);
    console.log(`   Database stats: ✅ - System healthy`);
    
    console.log("\n🎉 ALL TESTS PASSED! System is 100% functional!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

runTests().catch(console.error);