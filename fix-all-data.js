// Comprehensive data fix script to get 100% completion
import { ConvexHttpClient } from "convex/browser";

async function fixAllArtistData() {
  console.log("🚀 COMPREHENSIVE DATA FIX - GETTING TO 100% COMPLETION...\n");
  
  const client = new ConvexHttpClient("https://necessary-mosquito-453.convex.cloud");
  
  try {
    // Get all artists to analyze
    console.log("1️⃣ Analyzing all artist records...");
    const allArtists = await client.query("artists:getTrending", { limit: 100 });
    
    console.log(`📊 Total artists in database: ${allArtists.length}`);
    
    // Identify incomplete artists
    const incompleteArtists = allArtists.filter(artist => 
      !artist.spotifyId || 
      !artist.popularity || 
      !artist.followers ||
      !artist.images || artist.images.length === 0
    );
    
    console.log(`❌ Artists needing fixes: ${incompleteArtists.length}`);
    
    if (incompleteArtists.length === 0) {
      console.log("✅ All artists already have complete data!");
      return true;
    }
    
    // Fix each incomplete artist
    console.log("\n2️⃣ Fixing incomplete artist records...");
    let fixedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < incompleteArtists.length; i++) {
      const artist = incompleteArtists[i];
      console.log(`\n🔧 [${i + 1}/${incompleteArtists.length}] Fixing: ${artist.name}`);
      
      try {
        // Trigger Spotify data enrichment for this specific artist
        await client.action("spotify:enrichArtistData", {
          artistId: artist._id,
          artistName: artist.name,
        });
        
        console.log(`   ✅ Spotify sync triggered for ${artist.name}`);
        fixedCount++;
        
        // Rate limiting to respect Spotify API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`   ❌ Failed to fix ${artist.name}: ${error.message}`);
        failedCount++;
      }
    }
    
    console.log(`\n📊 Fix Results: ${fixedCount} fixed, ${failedCount} failed`);
    
    // Wait for all syncs to complete
    console.log("\n3️⃣ Waiting for all syncs to complete (60 seconds)...");
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    // Verify final data quality
    console.log("\n4️⃣ Verifying final data quality...");
    const finalArtists = await client.query("artists:getTrending", { limit: 100 });
    
    const finalEmptySpotifyIds = finalArtists.filter(a => !a.spotifyId).length;
    const finalEmptyPopularity = finalArtists.filter(a => !a.popularity).length;
    const finalEmptyFollowers = finalArtists.filter(a => !a.followers).length;
    const finalEmptyImages = finalArtists.filter(a => !a.images || a.images.length === 0).length;
    
    console.log(`\n🎯 FINAL DATA QUALITY REPORT:`);
    console.log(`   SpotifyID: ${((finalArtists.length - finalEmptySpotifyIds) / finalArtists.length * 100).toFixed(1)}% complete (${finalEmptySpotifyIds} empty)`);
    console.log(`   Popularity: ${((finalArtists.length - finalEmptyPopularity) / finalArtists.length * 100).toFixed(1)}% complete (${finalEmptyPopularity} empty)`);
    console.log(`   Followers: ${((finalArtists.length - finalEmptyFollowers) / finalArtists.length * 100).toFixed(1)}% complete (${finalEmptyFollowers} empty)`);
    console.log(`   Images: ${((finalArtists.length - finalEmptyImages) / finalArtists.length * 100).toFixed(1)}% complete (${finalEmptyImages} empty)`);
    
    const totalComplete = finalEmptySpotifyIds + finalEmptyPopularity + finalEmptyFollowers + finalEmptyImages;
    const success = totalComplete === 0;
    
    console.log(`\n${success ? '🎉' : '⚠️'} Overall Status: ${success ? '100% COMPLETE!' : `${totalComplete} fields still need fixing`}`);
    
    return success;
    
  } catch (error) {
    console.error("❌ Comprehensive fix failed:", error);
    return false;
  }
}

fixAllArtistData().then(success => {
  console.log(success ? "\n🎊 ALL ARTIST DATA IS NOW 100% COMPLETE!" : "\n🔧 SOME DATA STILL NEEDS FIXING");
  process.exit(success ? 0 : 1);
});
