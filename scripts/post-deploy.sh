#!/bin/bash

echo "🚀 Running post-deployment tasks..."

# Wait a few seconds for deployment to settle
sleep 5

# Refresh Ticketmaster-driven caches + update internal trending scores
echo "📊 Refreshing trending (Ticketmaster caches + internal ranks)..."
npm run -s sync:trending || true

echo "✅ Post-deployment tasks completed!"