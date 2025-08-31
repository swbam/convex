# 🚨 CRITICAL: Vercel Deployment Fix

## The Problem
Your app is deployed but showing an error because **Vite environment variables are replaced at BUILD TIME, not runtime**. The environment variables MUST be available when Vercel builds your app.

## The Solution

### Step 1: Verify Your Environment Variables in Vercel

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings → Environment Variables**
4. Make sure these variables are set:

```
VITE_CONVEX_URL=https://necessary-mosquito-453.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cXVpZXQtcG9zc3VtLTcxLmNsZXJrLmFjY291bnRzLmRldiQ
```

### Step 2: CRITICAL - Check Variable Availability

Make sure the variables are available for:
- ✅ **Production**
- ✅ **Preview** 
- ✅ **Development**

All three checkboxes should be checked!

### Step 3: Trigger a Full Rebuild

**IMPORTANT:** After setting/updating environment variables, you MUST trigger a new deployment for them to take effect:

Option A (Recommended):
```bash
git commit --allow-empty -m "Trigger rebuild with environment variables"
git push
```

Option B:
1. In Vercel Dashboard, go to your project
2. Click on the "Deployments" tab
3. Find your latest deployment
4. Click the three dots menu (...)
5. Select "Redeploy"
6. **IMPORTANT:** Make sure "Use existing Build Cache" is **UNCHECKED**

## Why This Happens

Vite replaces `import.meta.env.VITE_*` variables during the build process, not at runtime. Your current deployment has these as undefined because the variables weren't available when Vercel built your app.

## Verification

After redeployment completes:
1. Your app should load normally
2. You should see the concert setlist interface
3. No more "Something went wrong" error

## Additional Environment Variables (Optional)

For full functionality, also add:
```
CLERK_SECRET_KEY=sk_test_Lpv2rBqUhSOlGs6unmAIgFq4sO2ZzwzzjLduPpRbrv
TICKETMASTER_API_KEY=your-api-key
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SETLISTFM_API_KEY=your-api-key
```

## Still Not Working?

If it's still not working after following these steps:

1. **Clear Build Cache**:
   - In Vercel project settings
   - Go to "Advanced" 
   - Click "Delete Build Cache"
   - Redeploy

2. **Check Build Logs**:
   - Look for any build errors
   - Verify environment variables are being read during build

3. **Verify Locally**:
   ```bash
   # Test build with env vars
   export VITE_CONVEX_URL=https://necessary-mosquito-453.convex.cloud
   export VITE_CLERK_PUBLISHABLE_KEY=pk_test_cXVpZXQtcG9zc3VtLTcxLmNsZXJrLmFjY291bnRzLmRldiQ
   npm run build
   npm run preview
   ```

## Summary

✅ Environment variables must be set in Vercel Dashboard
✅ Variables must be available for Production/Preview/Development
✅ You must trigger a FULL rebuild after setting variables
✅ Do NOT use build cache when redeploying