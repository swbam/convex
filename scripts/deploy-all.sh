#!/bin/bash

# Complete deployment script for Concert Setlist Voting App
# Deploys both backend (Convex) and frontend (Vercel)

set -e  # Exit on any error

echo "🚀 Starting complete deployment..."
echo ""

# Step 1: Deploy Backend to Convex
echo "📦 Step 1/3: Deploying backend to Convex..."
npx convex deploy --yes
if [ $? -eq 0 ]; then
  echo "✅ Backend deployed successfully to Convex"
else
  echo "❌ Backend deployment failed"
  exit 1
fi
echo ""

# Step 2: Build Frontend
echo "🏗️  Step 2/3: Building frontend..."
npm run build
if [ $? -eq 0 ]; then
  echo "✅ Frontend built successfully"
else
  echo "❌ Frontend build failed"
  exit 1
fi
echo ""

# Step 3: Deploy Frontend to Vercel
echo "🌐 Step 3/3: Deploying frontend to Vercel..."
vercel --prod --yes
if [ $? -eq 0 ]; then
  echo "✅ Frontend deployed successfully to Vercel"
else
  echo "❌ Frontend deployment failed"
  exit 1
fi
echo ""

echo "🎉 Complete deployment successful!"
echo ""
echo "📊 Deployment Summary:"
echo "  Backend:  ✅ Convex (https://exuberant-weasel-22.convex.cloud)"
echo "  Frontend: ✅ Vercel (check output above for URL)"
echo ""
echo "🔗 Your app is now live!"
