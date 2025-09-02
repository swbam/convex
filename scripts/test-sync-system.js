#!/usr/bin/env node

import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.VITE_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

async function testSyncSystem() {
  console.log("🧪 Testing Sync System...\n");
  
  const client = new ConvexHttpClient(CONVEX_URL);
  
  try {
    // Test 1: Search for an artist
    console.log("1️⃣ Testing Artist Search (Ticketmaster)...");
    const searchResults = await client.action("api/ticketmaster/searchArtists", {
      query: "Taylor Swift",
      limit: 1
    });
    
    if (searchResults.length === 0) {
      console.log("❌ No artists found in search");
      return;
    }
    
    const artist = searchResults[0];
    console.log(`✅ Found artist: ${artist.name} (${artist.ticketmasterId})`);
    console.log(`   - Genres: ${artist.genres.join(", ")}`);
    console.log(`   - Upcoming Events: ${artist.upcomingEvents}`);
    
    // Test 2: Trigger full artist sync
    console.log("\n2️⃣ Testing Artist Import...");
    const artistId = await client.action("api/ticketmaster/triggerFullArtistSync", {
      ticketmasterId: artist.ticketmasterId,
      artistName: artist.name,
      genres: artist.genres,
      images: artist.images
    });
    
    console.log(`✅ Artist created with ID: ${artistId}`);
    
    // Test 3: Check artist data
    console.log("\n3️⃣ Checking Artist Data...");
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for sync
    
    const artistData = await client.query("api/artists/getById", { id: artistId });
    console.log(`✅ Artist Data:`);
    console.log(`   - Name: ${artistData.name}`);
    console.log(`   - Slug: ${artistData.slug}`);
    console.log(`   - Spotify ID: ${artistData.spotifyId || "Not synced yet"}`);
    console.log(`   - Followers: ${artistData.followers || "Not synced yet"}`);
    console.log(`   - Last Synced: ${artistData.lastSynced ? new Date(artistData.lastSynced).toISOString() : "Never"}`);
    
    // Test 4: Check shows
    console.log("\n4️⃣ Checking Shows...");
    const shows = await client.query("api/shows/getByArtist", { 
      artistId: artistId,
      limit: 5 
    });
    
    console.log(`✅ Found ${shows.length} shows`);
    shows.forEach((show, i) => {
      console.log(`   ${i + 1}. ${show.date} - ${show.venue?.name}, ${show.venue?.city}`);
    });
    
    // Test 5: Check songs
    console.log("\n5️⃣ Checking Songs...");
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for Spotify sync
    
    const songs = await client.query("api/songs/getByArtist", { 
      artistId: artistId,
      limit: 10 
    });
    
    console.log(`✅ Found ${songs.length} songs`);
    songs.forEach((song, i) => {
      console.log(`   ${i + 1}. ${song.title} (${song.album}) - Popularity: ${song.popularity}`);
    });
    
    // Test 6: Test trending sync
    console.log("\n6️⃣ Testing Trending Sync...");
    await client.action("api/maintenance/triggerTrendingSync");
    console.log("✅ Trending sync triggered");
    
    // Test 7: Check trending data
    console.log("\n7️⃣ Checking Trending Data...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const trendingArtists = await client.query("api/trending/getTrendingArtists", { limit: 5 });
    const trendingShows = await client.query("api/trending/getTrendingShows", { limit: 5 });
    
    console.log(`✅ Trending Artists: ${trendingArtists.length}`);
    trendingArtists.forEach((artist, i) => {
      console.log(`   ${i + 1}. ${artist.name} - ${artist.upcomingEvents} events`);
    });
    
    console.log(`\n✅ Trending Shows: ${trendingShows.length}`);
    trendingShows.forEach((show, i) => {
      console.log(`   ${i + 1}. ${show.artistName} @ ${show.venueName} - ${show.date}`);
    });
    
    console.log("\n✅ All sync system tests passed!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testSyncSystem();