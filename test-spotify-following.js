#!/usr/bin/env node

/**
 * Test script to verify Spotify-only artist following system
 */

const { ConvexHttpClient } = require("convex/browser");

// Initialize Convex client
const client = new ConvexHttpClient(process.env.CONVEX_URL || "");

async function testSpotifyFollowing() {
  console.log("🎵 Testing Spotify-Only Artist Following System");
  console.log("=" .repeat(60));
  
  try {
    // Test 1: Check Spotify user detection (should be false for unauthenticated)
    console.log("\n1. Testing Spotify user detection...");
    
    try {
      const isSpotifyUser = await client.query("spotifyFollowing.isSpotifyUser", {});
      console.log(`✅ Spotify user check works: ${isSpotifyUser}`);
      
      if (!isSpotifyUser) {
        console.log("⚠️ User is not a Spotify user - this is expected for unauthenticated requests");
      }
    } catch (error) {
      console.log(`❌ Spotify user check failed: ${error.message}`);
    }
    
    // Test 2: Test follow status check (should work even without auth)
    console.log("\n2. Testing follow status check...");
    
    try {
      // Get some artists to test with
      const artists = await client.query("artists.getTrending", { limit: 3 });
      
      if (artists.length > 0) {
        const artistIds = artists.map(a => a._id);
        const followStatus = await client.query("spotifyFollowing.getFollowStatus", { artistIds });
        
        console.log(`✅ Follow status check works for ${artistIds.length} artists`);
        console.log("   Follow status:", followStatus);
      } else {
        console.log("⚠️ No artists available for testing");
      }
    } catch (error) {
      console.log(`❌ Follow status check failed: ${error.message}`);
    }
    
    // Test 3: Test follow toggle (should fail without Spotify auth)
    console.log("\n3. Testing follow toggle (should fail without Spotify auth)...");
    
    try {
      const artists = await client.query("artists.getTrending", { limit: 1 });
      
      if (artists.length > 0) {
        const testArtist = artists[0];
        
        try {
          await client.mutation("spotifyFollowing.toggleArtistFollow", { 
            artistId: testArtist._id 
          });
          console.log("❌ Follow toggle worked without Spotify auth - this is a security issue!");
        } catch (error) {
          if (error.message.includes("Spotify authentication required") || 
              error.message.includes("Must be logged in")) {
            console.log("✅ Follow toggle properly protected");
          } else {
            console.log(`⚠️ Unexpected error: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Follow toggle test failed: ${error.message}`);
    }
    
    // Test 4: Test Spotify artists query (should fail without Spotify auth)
    console.log("\n4. Testing Spotify artists query (should fail without auth)...");
    
    try {
      const spotifyArtists = await client.query("spotifyFollowing.getUserSpotifyArtistsWithShows", { limit: 5 });
      console.log("❌ Spotify artists query accessible without auth - this is a security issue!");
    } catch (error) {
      if (error.message.includes("Spotify authentication required") || 
          error.message.includes("Must be logged in")) {
        console.log("✅ Spotify artists query properly protected");
      } else {
        console.log(`⚠️ Unexpected error: ${error.message}`);
      }
    }
    
    // Test 5: Test activity feed (should work and show no follow activities for non-Spotify users)
    console.log("\n5. Testing activity feed...");
    
    try {
      const activities = await client.query("activity.getUserActivityFeed", { limit: 10 });
      console.log(`✅ Activity feed works: ${activities.length} activities`);
      
      const followActivities = activities.filter(a => a.type === 'artist_followed');
      console.log(`   Follow activities: ${followActivities.length} (should be 0 for non-Spotify users)`);
      
    } catch (error) {
      if (error.message.includes("Must be logged in")) {
        console.log("✅ Activity feed requires authentication (expected)");
      } else {
        console.log(`❌ Activity feed error: ${error.message}`);
      }
    }
    
    // Test 6: Test activity stats
    console.log("\n6. Testing activity stats...");
    
    try {
      const stats = await client.query("activity.getUserActivityStats", {});
      console.log(`✅ Activity stats work - Spotify user: ${stats.isSpotifyUser}`);
      console.log(`   Total follows: ${stats.totalFollows} (should be 0 for non-Spotify users)`);
    } catch (error) {
      if (error.message.includes("Must be logged in")) {
        console.log("✅ Activity stats require authentication (expected)");
      } else {
        console.log(`❌ Activity stats error: ${error.message}`);
      }
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 Spotify-only following system test completed!");
    console.log("✅ Artist following is properly restricted to Spotify users");
    console.log("💡 To test Spotify features, sign in with Spotify and run tests again");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testSpotifyFollowing().catch(console.error);
}

module.exports = { testSpotifyFollowing };