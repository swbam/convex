#!/bin/bash

# Wait for Convex dev to be ready (10 seconds should be enough)
echo "⏳ Waiting for Convex dev server to initialize..."
sleep 10

# Trigger trending sync to populate homepage
echo "📊 Syncing trending artists and shows..."
npx convex run maintenance:triggerTrendingSync

echo "✅ Dev initialization complete! Trending data synced."
