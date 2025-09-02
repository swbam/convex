#!/bin/bash

echo "🚀 Running post-deployment tasks..."

# Wait a few seconds for deployment to settle
sleep 5

# Trigger trending data sync with new system
echo "📊 Updating trending rankings..."
npx convex run maintenance:triggerTrendingSync || true

echo "✅ Post-deployment tasks completed!"