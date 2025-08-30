// Test complete catalog import with improved pagination
import { ConvexHttpClient } from "convex/browser";

async function testCompleteCatalog() {
  console.log("🧪 Testing Complete Catalog Import (Improved)...\n");
  
  const client = new ConvexHttpClient("https://necessary-mosquito-453.convex.cloud");
  
  try {
    // Test with Imagine Dragons (major artist with many albums)
    console.log("1️⃣ Searching for Imagine Dragons...");
    const searchResults = await client.action("ticketmaster:searchArtists", {
      query: "imagine dragons",
      limit: 5
    });
    
    if (searchResults.length === 0) {
      console.log("❌ No search results found");
      return false;
    }
    
    const artist = searchResults[0];
    console.log(`✅ Found artist: ${artist.name} (ID: ${artist.ticketmasterId})`);
    
    // Import with complete catalog
    console.log("\n2️⃣ Starting COMPLETE catalog import (this may take 2-3 minutes)...");
    console.log("   📀 This will import ALL albums and singles with pagination...");
    
    const startTime = Date.now();
    
    const artistId = await client.action("ticketmaster:triggerFullArtistSync", {
      ticketmasterId: artist.ticketmasterId,
      artistName: artist.name,
      genres: artist.genres,
      images: artist.images
    });
    
    const importTime = Date.now() - startTime;
    console.log(`✅ Import completed in ${(importTime / 1000).toFixed(1)}s`);
    
    // Check final song count
    console.log("\n3️⃣ Checking COMPLETE song catalog...");
    const songs = await client.query("songs:getByArtist", { artistId, limit: 1000 });
    console.log(`🎵 FINAL SONG COUNT: ${songs.length} songs imported`);
    
    // Show album breakdown
    const albumCounts = {};
    songs.forEach(song => {
      if (song.album) {
        albumCounts[song.album] = (albumCounts[song.album] || 0) + 1;
      }
    });
    
    console.log(`\n📀 Songs by album (showing top 10):`);
    Object.entries(albumCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([album, count]) => {
        console.log(`   ${album}: ${count} songs`);
      });
    
    // Success criteria: major artist should have 80+ songs
    const success = songs.length >= 80;
    console.log(`\n${success ? '✅' : '❌'} Expected 80+ songs, got ${songs.length}`);
    
    return success;
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    return false;
  }
}

testCompleteCatalog().then(success => {
  console.log(success ? "\n🎉 COMPLETE CATALOG IMPORT SUCCESSFUL!" : "\n❌ CATALOG IMPORT NEEDS MORE WORK");
  process.exit(success ? 0 : 1);
});
