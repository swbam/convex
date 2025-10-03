# Clerk OAuth Setup - Production Checklist

## Critical Auth Configuration

### 1. Clerk Dashboard Settings

#### Enable OAuth Providers
Navigate to **Clerk Dashboard → Configure → Authentication**

Enable the following providers:
- ✅ **Google OAuth** (Social Connections)
- ✅ **Spotify OAuth** (Social Connections)
- ✅ **Email/Password** (Email & Phone)

#### Configure Redirect URIs
In each OAuth provider settings, add:

**Development:**
- `http://localhost:5173/sso-callback`
- `http://localhost:5173/`

**Production:**
- `https://yourdomain.com/sso-callback`
- `https://yourdomain.com/`

#### Set Allowed Origins (CORS)
Navigate to **Clerk Dashboard → Configure → Domains**

Add frontend origins:
- Development: `http://localhost:5173`
- Production: `https://yourdomain.com`

### 2. Environment Variables

#### Required Variables (.env)
```bash
# Clerk (from dashboard)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_... # or pk_live_...

# Convex (from convex dashboard)
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# Optional: Spotify/Ticketmaster for enhanced features
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_secret
TICKETMASTER_API_KEY=your_tm_api_key
```

#### Verify .env.production
Ensure production env has **live** keys:
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

### 3. Code Verification Checklist

#### ✅ ClerkProvider Initialization (main.tsx)
- ClerkProvider wraps app with publishableKey
- Fallback to DiagnosticApp if key missing

#### ✅ Auth Pages (SignUpPage.tsx, SignInPage.tsx)
- Check `isLoaded` before form submit
- Toast "not ready" only when `!isLoaded || !signUp/signIn`
- OAuth uses `authenticateWithRedirect({ redirectUrl: '/sso-callback' })`

#### ✅ SSOCallback Handler (SSOCallback.tsx)
- Calls `handleRedirectCallback()`
- Redirects to `/` on success
- Shows error + redirects to `/signin` on failure

#### ✅ Convex Auth (convex/auth.config.ts)
- Domain matches Clerk issuer URL
- ApplicationID matches Clerk app ID

### 4. Common Issues & Fixes

#### "Authentication not ready" Error
**Cause:** `isLoaded` is false (Clerk still initializing)

**Solutions:**
1. Verify `VITE_CLERK_PUBLISHABLE_KEY` in .env
2. Check browser console for Clerk errors
3. Ensure Clerk dashboard has correct origins
4. Clear browser cache/cookies
5. Wait for network (slow Clerk CDN load)

#### OAuth Redirect Loop
**Cause:** Missing `/sso-callback` redirect URI

**Fix:** Add exact URI in Clerk dashboard OAuth settings

#### CORS Errors
**Cause:** Frontend origin not allowlisted

**Fix:** Add origin in Clerk dashboard → Domains

#### User Not Created in Convex
**Cause:** `convex/auth.ts` triggers on first login

**Check:**
- Run `npx convex dev` to ensure deployment active
- Verify `auth.config.ts` domain/applicationID correct
- Check Convex logs for errors during user creation

### 5. Testing Procedure

#### Local Testing
```bash
# 1. Start Convex
npx convex dev

# 2. Start frontend
npm run dev

# 3. Test flows
- Sign up with email → should work without "not ready"
- Sign in with Google → redirect to /sso-callback → home
- Sign in with Spotify → import artists on success
```

#### Production Testing
```bash
# Deploy
npm run build
vercel deploy --prod

# Test same flows on production domain
```

### 6. Spotify-Specific Setup

If users sign in with Spotify, the app imports their top artists.

**Convex Function:** `api.spotifyAuth.importUserSpotifyArtistsWithToken`

**Requirements:**
- Spotify OAuth enabled in Clerk
- Spotify app credentials in Clerk OAuth settings
- Clerk metadata includes Spotify access token

**Verify:** After Spotify login, check user's dashboard for "My Spotify Artists"

---

## Quick Verification Commands

```bash
# Check env vars loaded
npm run dev
# Open browser console, type: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

# Verify Convex connection
npx convex dev
# Should show deployment URL

# Check Clerk config
curl -H "Authorization: Bearer sk_test_..." https://api.clerk.com/v1/instance
```

## Production Deploy Checklist

- [ ] Clerk publishable key uses `pk_live_...` (not test)
- [ ] Production domain added to Clerk origins
- [ ] `/sso-callback` redirect URI includes production URL
- [ ] Convex deployment URL points to prod
- [ ] `.env.production` file committed (without secrets)
- [ ] Vercel env vars match production keys
- [ ] Test signup/signin on production domain
- [ ] Verify Spotify import works in prod

---

## Support

If auth still fails after following this guide:
1. Check browser console for specific errors
2. Review Convex logs: `npx convex logs`
3. Verify Clerk dashboard → Sessions shows active sessions
4. Test with incognito window (rules out cache issues)

**Auth is now 100% configured if all checkboxes above are complete.**
