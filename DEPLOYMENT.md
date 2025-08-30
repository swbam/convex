# Deployment Guide

This is a Convex + Vite + React application with Clerk authentication. Follow these steps for deployment:

## Prerequisites

1. **Convex Account**: Sign up at [convex.dev](https://convex.dev)
2. **Clerk Account**: Sign up at [clerk.com](https://clerk.com)
3. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)

## Environment Variables

### Required Environment Variables for Vercel:

```bash
# Convex
VITE_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOY_KEY=your-convex-deploy-key

# Clerk Authentication  
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your-clerk-publishable-key
CLERK_SECRET_KEY=sk_live_your-clerk-secret-key
# Issuer domain for Convex auth config (Clerk instance Frontend API URL)
# Example: https://quiet-possum-71.clerk.accounts.dev
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-domain

# External APIs (for backend functions)
TICKETMASTER_API_KEY=your-ticketmaster-api-key
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SETLISTFM_API_KEY=your-setlistfm-api-key
```

## Deployment Steps

### 1. Deploy Convex Backend

```bash
# Install Convex CLI
npm install -g convex

# Login to Convex
npx convex login

# Deploy backend
npx convex deploy
```

### 2. Configure Clerk

1. Go to your Clerk dashboard
2. Add your production domain to allowed origins
3. Configure authentication settings
4. Get your production keys

### 3. Deploy to Vercel

#### Option A: Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

#### Option B: GitHub Integration
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### 4. Post-Deployment

1. **Test authentication flow**
2. **Verify Convex functions work**
3. **Check external API integrations**
4. **Test search and navigation**

## Architecture

- **Frontend**: Vite + React + TypeScript (deployed to Vercel)
- **Backend**: Convex (deployed to Convex Cloud)
- **Auth**: Clerk (SaaS)
- **APIs**: Ticketmaster, Spotify, Setlist.fm

## Build Process

The build process:
1. Vite builds the frontend React app
2. Convex deploys backend functions separately
3. Vercel serves the static frontend
4. Frontend connects to Convex backend via WebSocket/HTTP

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Ensure Convex URL is correctly set
2. **Auth Issues**: Verify Clerk keys and domain configuration
3. **API Errors**: Check external API key configuration
4. **Build Failures**: Ensure all environment variables are set

### Logs:
- **Frontend**: Vercel function logs
- **Backend**: Convex dashboard logs
- **Auth**: Clerk dashboard logs