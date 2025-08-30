// Test basic app functionality to isolate the error
import { ConvexHttpClient } from "convex/browser";

async function testBasicApp() {
  console.log("🧪 Testing Basic App Functionality...\n");
  
  const client = new ConvexHttpClient("https://necessary-mosquito-453.convex.cloud");
  
  try {
    // Test 1: Basic health check
    console.log("1️⃣ Testing health check...");
    const health = await client.query("health:healthCheck", {});
    console.log(`✅ Health check: ${health.status}`);
    
    // Test 2: Dashboard stats
    console.log("\n2️⃣ Testing dashboard stats...");
    const stats = await client.query("dashboard:getStats", {});
    console.log(`✅ Dashboard stats: ${stats.totalArtists} artists, ${stats.totalShows} shows`);
    
    // Test 3: Trending artists
    console.log("\n3️⃣ Testing trending artists...");
    const artists = await client.query("artists:getTrending", { limit: 5 });
    console.log(`✅ Trending artists: ${artists.length} found`);
    
    // Test 4: Trending shows
    console.log("\n4️⃣ Testing trending shows...");
    const shows = await client.query("trending:getTrendingShows", { limit: 5 });
    console.log(`✅ Trending shows: ${shows.length} found`);
    
    // Test 5: Artist by slug (potential issue)
    console.log("\n5️⃣ Testing artist by slug...");
    if (artists.length > 0 && artists[0].slug) {
      const artistBySlug = await client.query("artists:getBySlugOrId", { key: artists[0].slug });
      console.log(`✅ Artist by slug: ${artistBySlug ? artistBySlug.name : 'Not found'}`);
    } else {
      console.log("⚠️ No artists with slugs to test");
    }
    
    console.log("\n🎉 All basic tests passed!");
    return true;
    
  } catch (error) {
    console.error("❌ Basic app test failed:", error);
    return false;
  }
}

testBasicApp().then(success => {
  console.log(success ? "\n✅ BASIC APP FUNCTIONALITY WORKING" : "\n❌ BASIC APP HAS ISSUES");
  process.exit(success ? 0 : 1);
});
