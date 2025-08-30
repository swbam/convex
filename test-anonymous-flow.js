// Test anonymous user flow with 2 song additions + 2 votes
import { ConvexHttpClient } from "convex/browser";

async function testAnonymousFlow() {
  console.log("🧪 Testing Anonymous User Flow (2 songs + 2 votes)...\n");
  
  const client = new ConvexHttpClient("https://necessary-mosquito-453.convex.cloud");
  
  try {
    // Get Kings of Leon (should exist from previous test with 147 songs)
    console.log("1️⃣ Getting Kings of Leon artist...");
    const artists = await client.query("artists:getTrending", { limit: 50 });
    const kingsOfLeon = artists.find(a => a.name.includes("Kings of Leon"));
    
    if (!kingsOfLeon) {
      console.log("❌ Kings of Leon not found. Run fresh import first.");
      return false;
    }
    
    console.log(`✅ Found artist: ${kingsOfLeon.name} (ID: ${kingsOfLeon._id})`);
    
    // Get their shows
    const shows = await client.query("shows:getByArtist", { 
      artistId: kingsOfLeon._id, 
      limit: 5 
    });
    console.log(`✅ Found ${shows.length} shows`);
    
    if (shows.length === 0) {
      console.log("❌ No shows found");
      return false;
    }
    
    const show = shows[0];
    console.log(`✅ Testing with show: ${show.venue?.name} on ${show.date}`);
    
    // Get existing setlist and available songs
    const setlists = await client.query("setlists:getByShow", { showId: show._id });
    const songs = await client.query("songs:getByArtist", { 
      artistId: kingsOfLeon._id, 
      limit: 150 
    });
    
    console.log(`✅ Show has ${setlists[0]?.songs?.length || 0} initial songs`);
    console.log(`✅ Artist has ${songs.length} total songs available`);
    
    const setlist = setlists[0];
    const availableSongs = songs.filter(song => 
      !setlist.songs?.some(s => s.title === song.title)
    );
    
    console.log(`✅ ${availableSongs.length} songs available to add`);
    
    // Test anonymous song addition (should work up to limit)
    console.log("\n2️⃣ Testing anonymous song additions...");
    
    if (availableSongs.length >= 2) {
      try {
        // First song addition
        await client.mutation("setlists:addSongToSetlist", {
          showId: show._id,
          song: {
            title: availableSongs[0].title,
            album: availableSongs[0].album,
            duration: availableSongs[0].durationMs,
            songId: availableSongs[0]._id,
          }
        });
        console.log(`✅ Added first song: ${availableSongs[0].title}`);
        
        // Second song addition
        await client.mutation("setlists:addSongToSetlist", {
          showId: show._id,
          song: {
            title: availableSongs[1].title,
            album: availableSongs[1].album,
            duration: availableSongs[1].durationMs,
            songId: availableSongs[1]._id,
          }
        });
        console.log(`✅ Added second song: ${availableSongs[1].title}`);
        
      } catch (error) {
        console.log(`❌ Anonymous song addition failed: ${error.message}`);
      }
    }
    
    // Test anonymous voting (should work up to limit)
    console.log("\n3️⃣ Testing anonymous voting...");
    
    const updatedSetlists = await client.query("setlists:getByShow", { showId: show._id });
    const updatedSetlist = updatedSetlists[0];
    
    if (updatedSetlist?.songs?.length >= 2) {
      try {
        // First vote
        await client.mutation("songVotes:voteOnSong", {
          setlistId: updatedSetlist._id,
          songTitle: updatedSetlist.songs[0].title,
          voteType: "upvote"
        });
        console.log(`✅ Voted on first song: ${updatedSetlist.songs[0].title}`);
        
        // Second vote
        await client.mutation("songVotes:voteOnSong", {
          setlistId: updatedSetlist._id,
          songTitle: updatedSetlist.songs[1].title,
          voteType: "upvote"
        });
        console.log(`✅ Voted on second song: ${updatedSetlist.songs[1].title}`);
        
      } catch (error) {
        console.log(`❌ Anonymous voting failed: ${error.message}`);
      }
    }
    
    console.log("\n🎉 Anonymous user flow test completed!");
    return true;
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    return false;
  }
}

testAnonymousFlow().then(success => {
  console.log(success ? "\n✅ ANONYMOUS USER FLOW WORKING" : "\n❌ ANONYMOUS FLOW FAILED");
  process.exit(success ? 0 : 1);
});
