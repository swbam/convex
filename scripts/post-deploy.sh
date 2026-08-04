#!/bin/bash

echo "🚀 Running post-deployment tasks..."

# Wait a few seconds for deployment to settle
sleep 5

# Refresh Ticketmaster-driven caches + update internal trending scores in production.
echo "📊 Refreshing production trending (Ticketmaster caches + internal ranks)..."
CONVEX_DEPLOY_KEY= npx convex run --prod admin:refreshTrendingCacheInternal
CONVEX_DEPLOY_KEY= npx convex run --prod maintenance:triggerTrendingSync

echo "✅ Post-deployment tasks completed!"
