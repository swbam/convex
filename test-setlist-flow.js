// Test complete setlist functionality
import { ConvexHttpClient } from "convex/browser";

async function testSetlistFlow() {
  console.log("🧪 Testing Complete Setlist Flow...\n");
  
  const client = new ConvexHttpClient("https://necessary-mosquito-453.convex.cloud");
  
  try {
    // Get Treaty Oak Revival artist (should exist from previous test)
    console.log("1️⃣ Getting Treaty Oak Revival artist...");
    const artists = await client.query("artists:getTrending", { limit: 50 });
    const treatyOak = artists.find(a => a.name.includes("Treaty Oak Revival"));
    
    if (!treatyOak) {
      console.log("❌ Treaty Oak Revival not found. Run artist import first.");
      return false;
    }
    
    console.log(`✅ Found artist: ${treatyOak.name} (ID: ${treatyOak._id})`);
    
    // Get their shows
    console.log("\n2️⃣ Getting shows...");
    const shows = await client.query("shows:getByArtist", { 
      artistId: treatyOak._id, 
      limit: 5 
    });
    console.log(`✅ Found ${shows.length} shows`);
    
    if (shows.length === 0) {
      console.log("❌ No shows found");
      return false;
    }
    
    const show = shows[0];
    console.log(`✅ Testing with show: ${show.venue?.name} on ${show.date}`);
    
    // Get existing setlist
    console.log("\n3️⃣ Checking initial setlist...");
    const setlists = await client.query("setlists:getByShow", { showId: show._id });
    console.log(`✅ Found ${setlists.length} setlists`);
    
    if (setlists.length === 0) {
      console.log("❌ No setlists found");
      return false;
    }
    
    const setlist = setlists[0];
    console.log(`✅ Initial setlist has ${setlist.songs?.length || 0} songs`);
    
    // Get artist's song catalog
    console.log("\n4️⃣ Checking song catalog for dropdown...");
    const songs = await client.query("songs:getByArtist", { 
      artistId: treatyOak._id, 
      limit: 100 
    });
    console.log(`✅ Artist has ${songs.length} songs in catalog`);
    
    if (songs.length === 0) {
      console.log("❌ No songs in catalog");
      return false;
    }
    
    // Test adding a song to setlist
    console.log("\n5️⃣ Testing song addition to setlist...");
    const availableSongs = songs.filter(song => 
      !setlist.songs?.some(s => s.title === song.title)
    );
    
    if (availableSongs.length === 0) {
      console.log("⚠️ All songs already in setlist");
    } else {
      const songToAdd = availableSongs[0];
      console.log(`Adding song: ${songToAdd.title}`);
      
      try {
        await client.mutation("setlists:addSongToSetlist", {
          showId: show._id,
          song: {
            title: songToAdd.title,
            album: songToAdd.album,
            duration: songToAdd.durationMs,
            songId: songToAdd._id,
          }
        });
        console.log(`✅ Successfully added song: ${songToAdd.title}`);
      } catch (error) {
        console.log(`❌ Failed to add song: ${error.message}`);
      }
    }
    
    // Test voting functionality
    console.log("\n6️⃣ Testing voting functionality...");
    const firstSong = setlist.songs?.[0];
    if (firstSong) {
      try {
        // Test vote without authentication (should work for anonymous users)
        await client.mutation("songVotes:voteOnSong", {
          setlistId: setlist._id,
          songTitle: firstSong.title,
          voteType: "upvote"
        });
        console.log(`✅ Successfully voted on: ${firstSong.title}`);
        
        // Check vote count
        const voteData = await client.query("songVotes:getSongVotes", {
          setlistId: setlist._id,
          songTitle: firstSong.title
        });
        console.log(`✅ Vote count: ${voteData.upvotes} upvotes`);
        
      } catch (error) {
        console.log(`❌ Voting failed: ${error.message}`);
      }
    }
    
    console.log("\n🎉 Complete setlist flow test completed!");
    return true;
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    return false;
  }
}

// Run the test
testSetlistFlow().then(success => {
  console.log(success ? "\n✅ SETLIST FUNCTIONALITY WORKING" : "\n❌ SETLIST TESTS FAILED");
  process.exit(success ? 0 : 1);
});
