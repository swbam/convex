// Test complete catalog import with a fresh artist
import { ConvexHttpClient } from "convex/browser";

async function testFreshImport() {
  console.log("🧪 Testing Fresh Artist Complete Catalog Import...\n");
  
  const client = new ConvexHttpClient("https://necessary-mosquito-453.convex.cloud");
  
  try {
    // Search for a different artist to test fresh import
    console.log("1️⃣ Searching for Kings of Leon...");
    const searchResults = await client.action("ticketmaster:searchArtists", {
      query: "kings of leon",
      limit: 5
    });
    
    if (searchResults.length === 0) {
      console.log("❌ No search results found");
      return false;
    }
    
    const artist = searchResults[0];
    console.log(`✅ Found artist: ${artist.name} (ID: ${artist.ticketmasterId})`);
    
    // Import the artist with complete catalog
    console.log("\n2️⃣ Starting complete import (this will take 60+ seconds)...");
    const startTime = Date.now();
    
    const artistId = await client.action("ticketmaster:triggerFullArtistSync", {
      ticketmasterId: artist.ticketmasterId,
      artistName: artist.name,
      genres: artist.genres,
      images: artist.images
    });
    
    const importTime = Date.now() - startTime;
    console.log(`✅ Import completed in ${importTime}ms`);
    console.log(`✅ Artist created with ID: ${artistId}`);
    
    // Check final song count
    console.log("\n3️⃣ Checking final song catalog...");
    const songs = await client.query("songs:getByArtist", { artistId, limit: 500 });
    console.log(`✅ FINAL SONG COUNT: ${songs.length} songs imported`);
    
    // Show some sample songs
    console.log("\n📀 Sample songs imported:");
    songs.slice(0, 10).forEach((song, i) => {
      console.log(`   ${i + 1}. ${song.title} (${song.album})`);
    });
    
    if (songs.length > 10) {
      console.log(`   ... and ${songs.length - 10} more songs`);
    }
    
    return songs.length > 50; // Expect a major artist to have 50+ songs
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    return false;
  }
}

testFreshImport().then(success => {
  console.log(success ? "\n✅ COMPLETE CATALOG IMPORT WORKING" : "\n❌ CATALOG IMPORT INSUFFICIENT");
  process.exit(success ? 0 : 1);
});
