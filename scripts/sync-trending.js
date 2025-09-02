#!/usr/bin/env node

import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.VITE_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

async function syncTrending() {
  console.log("🚀 Starting trending data sync...");
  
  const client = new ConvexHttpClient(CONVEX_URL);
  
  try {
    // Trigger trending sync
    console.log("📊 Syncing trending data...");
    await client.action("api/maintenance/triggerTrendingSync");
    
    console.log("✅ Trending sync triggered successfully!");
    console.log("ℹ️  The sync runs in the background and may take a few moments to complete.");
    
  } catch (error) {
    console.error("❌ Failed to trigger trending sync:", error);
    process.exit(1);
  }
}

syncTrending();