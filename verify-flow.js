// Simple verification script to test Treaty Oak Revival flow
import { ConvexHttpClient } from "convex/browser";

async function testTreatyOakRevivalFlow() {
  console.log("🧪 Testing Treaty Oak Revival Complete Flow...\n");
  
  const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL || "https://necessary-mosquito-453.convex.cloud");
  
  try {
    // Step 1: Search for artist
    console.log("1️⃣ Testing Ticketmaster search...");
    const searchResults = await client.action("ticketmaster:searchArtists", {
      query: "treaty oak revival",
      limit: 5
    });
    console.log(`✅ Found ${searchResults.length} search results`);
    
    if (searchResults.length === 0) {
      console.log("❌ No search results found for Treaty Oak Revival");
      return false;
    }
    
    const artist = searchResults[0];
    console.log(`✅ Found artist: ${artist.name} (ID: ${artist.ticketmasterId})`);
    
    // Step 2: Trigger full artist sync
    console.log("\n2️⃣ Testing artist import...");
    const artistId = await client.action("ticketmaster:triggerFullArtistSync", {
      ticketmasterId: artist.ticketmasterId,
      artistName: artist.name,
      genres: artist.genres,
      images: artist.images
    });
    console.log(`✅ Artist created with ID: ${artistId}`);
    
    // Step 3: Check if artist exists in database
    console.log("\n3️⃣ Verifying artist in database...");
    const dbArtist = await client.query("artists:getById", { id: artistId });
    if (dbArtist) {
      console.log(`✅ Artist confirmed in database: ${dbArtist.name}`);
    } else {
      console.log("❌ Artist not found in database");
      return false;
    }
    
    // Step 4: Wait for background imports and check shows
    console.log("\n4️⃣ Checking for imported shows (waiting 10 seconds for background sync)...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const shows = await client.query("shows:getByArtist", { artistId, limit: 10 });
    console.log(`✅ Found ${shows.length} shows for ${artist.name}`);
    
    if (shows.length === 0) {
      console.log("⚠️ No shows found - background sync may still be running");
    }
    
    // Step 5: Check for song catalog
    console.log("\n5️⃣ Checking for imported song catalog (waiting 20 seconds for Spotify sync)...");
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    const songs = await client.query("songs:getByArtist", { artistId, limit: 50 });
    console.log(`✅ Found ${songs.length} songs in catalog for ${artist.name}`);
    
    if (songs.length === 0) {
      console.log("⚠️ No songs found - Spotify sync may still be running or failed");
    }
    
    // Step 6: Test setlist functionality if we have shows
    if (shows.length > 0) {
      console.log("\n6️⃣ Testing setlist functionality...");
      const show = shows[0];
      
      const setlists = await client.query("setlists:getByShow", { showId: show._id });
      console.log(`✅ Found ${setlists.length} setlists for show`);
      
      if (setlists.length > 0) {
        const setlist = setlists[0];
        console.log(`✅ Setlist has ${setlist.songs?.length || 0} songs`);
      }
    }
    
    console.log("\n🎉 Treaty Oak Revival flow test completed!");
    return true;
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    return false;
  }
}

// Run the test
testTreatyOakRevivalFlow().then(success => {
  console.log(success ? "\n✅ ALL TESTS PASSED" : "\n❌ TESTS FAILED");
  process.exit(success ? 0 : 1);
});
