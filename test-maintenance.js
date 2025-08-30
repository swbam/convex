// Test the data integrity maintenance system
import { ConvexHttpClient } from "convex/browser";

async function testMaintenance() {
  console.log("🔧 Testing Data Integrity Maintenance...\n");
  
  const client = new ConvexHttpClient("https://necessary-mosquito-453.convex.cloud");
  
  try {
    // Check current state of artists
    console.log("1️⃣ Checking current artist data quality...");
    const artists = await client.query("artists:getTrending", { limit: 50 });
    
    const emptySpotifyIds = artists.filter(a => !a.spotifyId).length;
    const emptyTicketmasterIds = artists.filter(a => !a.ticketmasterId).length;
    const emptyPopularity = artists.filter(a => !a.popularity).length;
    const emptyFollowers = artists.filter(a => !a.followers).length;
    const emptyImages = artists.filter(a => !a.images || a.images.length === 0).length;
    
    console.log(`📊 Data Quality Report:`);
    console.log(`   Artists with empty spotifyId: ${emptySpotifyIds}/${artists.length}`);
    console.log(`   Artists with empty ticketmasterId: ${emptyTicketmasterIds}/${artists.length}`);
    console.log(`   Artists with empty popularity: ${emptyPopularity}/${artists.length}`);
    console.log(`   Artists with empty followers: ${emptyFollowers}/${artists.length}`);
    console.log(`   Artists with empty images: ${emptyImages}/${artists.length}`);
    
    // Manually trigger maintenance to fix missing data
    console.log("\n2️⃣ Triggering data integrity maintenance...");
    await client.action("maintenance:triggerDataMaintenance", {});
    
    // Wait for maintenance to complete
    console.log("\n3️⃣ Waiting for maintenance to complete (30 seconds)...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Check improved data quality
    console.log("\n4️⃣ Checking improved data quality...");
    const updatedArtists = await client.query("artists:getTrending", { limit: 50 });
    
    const newEmptySpotifyIds = updatedArtists.filter(a => !a.spotifyId).length;
    const newEmptyPopularity = updatedArtists.filter(a => !a.popularity).length;
    const newEmptyFollowers = updatedArtists.filter(a => !a.followers).length;
    const newEmptyImages = updatedArtists.filter(a => !a.images || a.images.length === 0).length;
    
    console.log(`📈 Improved Data Quality:`);
    console.log(`   Empty spotifyId: ${emptySpotifyIds} → ${newEmptySpotifyIds} (${emptySpotifyIds - newEmptySpotifyIds} fixed)`);
    console.log(`   Empty popularity: ${emptyPopularity} → ${newEmptyPopularity} (${emptyPopularity - newEmptyPopularity} fixed)`);
    console.log(`   Empty followers: ${emptyFollowers} → ${newEmptyFollowers} (${emptyFollowers - newEmptyFollowers} fixed)`);
    console.log(`   Empty images: ${emptyImages} → ${newEmptyImages} (${emptyImages - newEmptyImages} fixed)`);
    
    const totalFixed = (emptySpotifyIds - newEmptySpotifyIds) + (emptyPopularity - newEmptyPopularity) + (emptyFollowers - newEmptyFollowers) + (emptyImages - newEmptyImages);
    
    console.log(`\n✅ Total data fields fixed: ${totalFixed}`);
    
    return totalFixed > 0;
    
  } catch (error) {
    console.error("❌ Maintenance test failed:", error);
    return false;
  }
}

testMaintenance().then(success => {
  console.log(success ? "\n🎉 DATA INTEGRITY MAINTENANCE WORKING!" : "\n❌ MAINTENANCE SYSTEM NEEDS WORK");
  process.exit(success ? 0 : 1);
});
