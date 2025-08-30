# Vercel Environment Variables Setup

## CRITICAL: Environment Variables for Production

The app is showing "Something went wrong" because the environment variables are not set on Vercel. You need to add these in the Vercel Dashboard:

### Required Environment Variables

Go to your Vercel project dashboard → Settings → Environment Variables and add:

```
VITE_CONVEX_URL=https://exuberant-weasel-22.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cXVpZXQtcG9zc3VtLTcxLmNsZXJrLmFjY291bnRzLmRldiQ
```

### Optional Environment Variables (for full functionality)

```
CLERK_SECRET_KEY=sk_test_Lpv2rBqUhSOlGs6unmAIgFq4sO2ZzwzzjLduPpRbrv
TICKETMASTER_API_KEY=your-ticketmaster-api-key
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SETLISTFM_API_KEY=your-setlistfm-api-key
```

## Important Notes

1. **Vite Environment Variables**: In Vite, only variables prefixed with `VITE_` are exposed to the browser code
2. **Deployment**: After adding environment variables, you need to redeploy the app
3. **Convex URL**: Make sure the Convex URL matches your deployed backend (currently `exuberant-weasel-22`)

## Steps to Fix

1. Log into Vercel Dashboard
2. Navigate to your project (convex-sable)
3. Go to Settings → Environment Variables
4. Add the variables listed above
5. Trigger a new deployment (or push a commit)

## Verification

After deployment, the app should:
- Load without the "Something went wrong" error
- Show the proper UI
- Connect to Convex backend
- Allow sign-in with Clerk

## Local Testing

The app works locally because .env.local is properly configured. The issue is only in production where these variables are missing.