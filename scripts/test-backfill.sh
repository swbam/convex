#!/bin/bash

# Test script to verify setlist generation fixes
# Run this after deploying the fixes

echo "🔍 Step 1: Finding shows without setlists..."
npx convex run diagnostics:findShowsWithoutSetlists '{"limit": 50}'

echo ""
echo "🔍 Step 2: Finding artists without songs (need catalog sync)..."
npx convex run diagnostics:findArtistsWithoutSongs '{"limit": 50}'

echo ""
echo "🔄 Step 3: Running backfill to generate missing setlists..."
npx convex run admin:testBackfillMissingSetlists '{"limit": 100}'

echo ""
echo "✅ Backfill complete! Check the output above for results."
echo ""
echo "Next steps:"
echo "1. Visit show pages that previously had no setlists"
echo "2. Verify they now show 5 random songs"
echo "3. Check Convex logs for any failures"

