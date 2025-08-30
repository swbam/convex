# Deployment Checklist for Vercel

## ✅ Fixed Issues

1. **Vercel Configuration** - Updated `vercel.json` to use `rewrites` instead of deprecated `routes`
2. **Build Scripts** - Simplified build process to avoid Convex deployment during Vercel builds
3. **Environment Variables** - Set up proper `.env.local` file for local development
4. **Clerk Authentication** - Configured with correct keys and auth setup
5. **TypeScript** - No compilation errors

## 📋 Vercel Deployment Steps

### 1. Environment Variables to Set in Vercel Dashboard

Go to your project settings in Vercel and add these environment variables:

```
# Convex Configuration
VITE_CONVEX_URL=https://exuberant-weasel-22.convex.cloud

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cXVpZXQtcG9zc3VtLTcxLmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_Lpv2rBqUhSOlGs6unmAIgFq4sO2ZzwzzjLduPpRbrv

# External APIs (if you have them)
TICKETMASTER_API_KEY=your-ticketmaster-api-key
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SETLISTFM_API_KEY=your-setlistfm-api-key
```

### 2. Deployment Command

The deployment will use these settings from `vercel.json`:
- Build Command: `npm run build`
- Output Directory: `dist`
- Framework: `vite`

### 3. Post-Deployment Verification

After deployment, verify:
1. ✅ The app loads without errors
2. ✅ Clerk authentication works (sign up/sign in)
3. ✅ Convex backend connection is established
4. ✅ All routes work correctly (SPA routing)

## 🚨 Important Notes

1. **Convex Deployment**: Convex backend is already deployed separately. The frontend just connects to it.
2. **API Keys**: External API keys are optional for basic functionality but required for:
   - Ticketmaster: Show discovery
   - Spotify: Artist catalog sync
   - Setlist.fm: Historical setlist data
3. **Production Keys**: For production deployment, replace test Clerk keys with production keys

## 🔧 Troubleshooting

If build fails on Vercel:
1. Check Vercel build logs for specific errors
2. Ensure all environment variables are set
3. Verify Node.js version compatibility (should work with Node 18+)
4. Check if `pnpm-lock.yaml` is committed (it should be)

## 📦 Local Testing

Before deploying:
```bash
# Install dependencies
npm install

# Test build
npm run build

# Preview production build
npm run preview
```

Visit http://localhost:4173 to test the production build locally.