#!/bin/bash

# Wait for Convex dev to be ready (10 seconds should be enough)
echo "⏳ Waiting for Convex dev server to initialize..."
sleep 10

# Trigger trending cache refresh to populate homepage (Ticketmaster + ranks)
echo "📊 Syncing trending artists and shows..."
npm run -s sync:trending

echo "✅ Dev initialization complete! Trending data synced."
