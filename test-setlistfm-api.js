#!/usr/bin/env node

/**
 * Test setlist.fm API directly to understand the correct format
 */

const API_KEY = 'xkutflW-aRy_Df9rF4OkJyCsHBYN88V37EBL';

async function testSetlistFmAPI() {
  console.log("🎵 Testing setlist.fm API directly...\n");
  
  try {
    // Test 1: Search for a well-known artist with recent shows
    console.log("1️⃣ Testing API with Coldplay (known to have many setlists)");
    const url1 = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=Coldplay&p=1`;
    
    const response1 = await fetch(url1, {
      headers: {
        'x-api-key': API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'TheSet/1.0'
      }
    });
    
    console.log(`   Status: ${response1.status}`);
    if (response1.ok) {
      const data1 = await response1.json();
      console.log(`   Found ${data1.setlist?.length || 0} setlists for Coldplay`);
      if (data1.setlist && data1.setlist.length > 0) {
        const firstSetlist = data1.setlist[0];
        console.log(`   Latest setlist: ${firstSetlist.artist.name} at ${firstSetlist.venue.name} on ${firstSetlist.eventDate}`);
        console.log(`   Songs in setlist: ${firstSetlist.sets?.set?.[0]?.song?.length || 0}`);
      }
    } else {
      console.log(`   Error: ${response1.statusText}`);
    }
    
    // Test 2: Test API key validity
    console.log("\n2️⃣ Testing API key validity");
    const url2 = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=U2&p=1`;
    
    const response2 = await fetch(url2, {
      headers: {
        'x-api-key': API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'TheSet/1.0'
      }
    });
    
    console.log(`   Status: ${response2.status}`);
    if (response2.ok) {
      const data2 = await response2.json();
      console.log(`   ✅ API key is valid - found ${data2.setlist?.length || 0} U2 setlists`);
    } else {
      console.log(`   ❌ API key issue: ${response2.statusText}`);
    }
    
    // Test 3: Test date format
    console.log("\n3️⃣ Testing date format requirements");
    const url3 = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=Green Day&date=27-06-2023`;
    
    const response3 = await fetch(url3, {
      headers: {
        'x-api-key': API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'TheSet/1.0'
      }
    });
    
    console.log(`   Status with DD-MM-YYYY format: ${response3.status}`);
    
  } catch (error) {
    console.error("❌ API test failed:", error);
  }
}

testSetlistFmAPI().catch(console.error);