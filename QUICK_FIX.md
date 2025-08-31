# 🚨 Quick Fix for Your Deployment Issue

Your app is deployed but showing an error because **environment variables are missing on Vercel**.

## Immediate Fix (2 minutes):

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project**
3. **Go to Settings → Environment Variables**
4. **Add these EXACT variables**:

```bash
VITE_CONVEX_URL=https://exuberant-weasel-22.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cXVpZXQtcG9zc3VtLTcxLmNsZXJrLmFjY291bnRzLmRldiQ
```

5. **Click "Save"**
6. **Redeploy** - Either:
   - Push any small change (even a space in a comment)
   - OR click "Redeploy" button in Vercel dashboard

## That's it! Your app will work after the redeploy completes.

---

## Optional: Add these for full functionality:

```bash
CLERK_SECRET_KEY=sk_test_Lpv2rBqUhSOlGs6unmAIgFq4sO2ZzwzzjLduPpRbrv
TICKETMASTER_API_KEY=your-api-key
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SETLISTFM_API_KEY=your-api-key
```

## Verify it's working:

After redeployment, your app should show the concert setlist interface instead of the diagnostic page.

## For future deployments:

Run this command before deploying to check your environment:
```bash
npm run check:deployment
```