# 🎵 Spotify OAuth Complete Setup Guide

## 🎯 Current Status

✅ **Code**: All auth fixes applied and deployed  
⚠️ **Clerk Dashboard**: Needs Spotify OAuth configuration (5 min setup)  
⚠️ **Spotify Dashboard**: Needs redirect URLs configured (5 min setup)  

---

## 🚀 Quick Start

### Step 1: Enable Spotify in Clerk (REQUIRED)

1. **Go to Clerk Dashboard**:
   ```
   https://dashboard.clerk.com/apps/<your-app-id>/user-authentication/social-connections
   ```

2. **Click "Add social connection"**

3. **Select "Spotify"**

4. **Enter Credentials**:
   ```
   Client ID:     2946864dc822469b9c672292ead45f43
   Client Secret: feaf0fc901124b839b11e02f97d18a8d
   ```

5. **Set Scopes** (CRITICAL):
   ```
   ✅ user-read-email      (required - get user's email)
   ✅ user-top-read        (get top artists)
   ✅ user-follow-read     (get followed artists)
   ```

6. **Save**

---

### Step 2: Configure Redirect URLs in Spotify Dashboard

1. **Go to Spotify Developer Dashboard**:
   ```
   https://developer.spotify.com/dashboard
   ```

2. **Select your app** (or create one if needed)

3. **Edit Settings**

4. **Add Redirect URIs**:
   ```
   Development:
   http://localhost:5173/sso-callback
   
   Production:
   https://your-vercel-domain.com/sso-callback
   
   Clerk Callback (ALSO REQUIRED):
   https://quiet-possum-71.clerk.accounts.dev/v1/oauth_callback
   ```

5. **Save**

---

## 🔍 **How It Works**

### The Complete Flow:

```
┌─────────────────────────────────────────────────────────────┐
│  SPOTIFY OAUTH FLOW                                         │
└─────────────────────────────────────────────────────────────┘

1. User clicks "Sign in with Spotify"
   ↓
2. Frontend calls: signIn.authenticateWithRedirect()
   ↓
3. Clerk redirects to: https://accounts.spotify.com/authorize
   ↓
4. User logs into Spotify (if not already)
   ↓
5. User authorizes your app (scopes shown)
   ↓
6. Spotify redirects to: 
   https://quiet-possum-71.clerk.accounts.dev/v1/oauth_callback
   ↓
7. Clerk processes OAuth response
   ↓
8. Clerk redirects to: /sso-callback (your app)
   ↓
9. SSOCallback component:
   - Calls handleRedirectCallback()
   - Creates Clerk session
   - Redirects to /profile
   ↓
10. App.tsx useEffect triggers:
    - Detects user signed in but no appUser
    - Calls createAppUser()
    ↓
11. convex/auth.ts createAppUser:
    - Extracts Spotify ID from externalAccounts
    - Creates user in Convex with spotifyId
    ↓
12. useSpotifyAuth hook detects:
    - User has Spotify connected
    - Calls importSpotifyArtists()
    ↓
13. convex/spotifyAuth.ts imports:
    - Fetches followed artists from Spotify API
    - Fetches top artists from Spotify API
    - Creates/links artists in Convex
    - Tracks userSpotifyArtists relationships
    ↓
14. Profile page "My Artists" tab:
    - Queries getUserSpotifyArtists
    - Displays artists with upcoming shows
    - Shows top rank badges
    - Click artist → see their shows
    ↓
✅ COMPLETE!
```

---

## 📋 **Post-Setup Checklist**

After enabling Spotify in Clerk Dashboard:

### Test Development:
```bash
1. npm run dev
2. Go to http://localhost:5173/signin
3. Click "Sign in with Spotify"
4. Should redirect to Spotify login
5. Authorize the app
6. Should redirect back to /profile
7. Check browser console for:
   "🔵 Creating user: { hasSpotify: true, spotifyId: '...' }"
   "✅ Created app user: ... with Spotify ID: ..."
   "🎵 Importing your Spotify artists..."
8. Go to Profile → "My Artists" tab
9. Should see your followed/top artists with upcoming shows
```

### Test Production:
```bash
1. Deploy: npm run all
2. Visit your deployed app
3. Same flow as above
4. Should work identically
```

---

## 🐛 **Troubleshooting**

### "Spotify button doesn't redirect"
**Cause**: Spotify not enabled in Clerk Dashboard  
**Fix**: Follow Step 1 above

### "Invalid redirect URI error"
**Cause**: Redirect URLs not set in Spotify Dashboard  
**Fix**: Follow Step 2 above, add BOTH:
  - Your app's /sso-callback URL
  - Clerk's callback URL

### "User has no Spotify ID after OAuth"
**Cause**: Spotify scopes not configured  
**Fix**: Ensure `user-read-email` scope is enabled in Clerk

### "My Artists tab is empty"
**Cause**: Import hasn't run yet, or no artists with upcoming shows  
**Fix**: 
  - Wait for import to complete (check console)
  - Try "Refresh" button
  - Artists without upcoming shows are filtered out

---

## 🎨 **UI Features**

### Sign In/Up Pages Now Have:
- ✅ Email/password form
- ✅ "Or continue with" divider
- ✅ Green Spotify button (#1DB954)
- ✅ Loading states
- ✅ Error handling

### Profile Page "My Artists" Tab:
- ✅ Shows top artists with rank badges (Top 1, Top 2, etc.)
- ✅ Shows followed artists
- ✅ Displays upcoming show count for each artist
- ✅ Filters to only show artists with upcoming concerts
- ✅ Refresh button to re-import from Spotify
- ✅ Click artist → navigate to artist page

---

## 📊 **Database Schema**

### `users` table:
```typescript
{
  authId: string,           // Clerk user ID
  email: string,
  name: string,
  spotifyId: string,        // ✅ NOW PROPERLY EXTRACTED!
  username: string,
  role: "user" | "admin",
  createdAt: number,
}
```

### `userSpotifyArtists` table:
```typescript
{
  userId: Id<"users">,
  artistId: Id<"artists">,
  isFollowed: boolean,      // User follows on Spotify
  isTopArtist: boolean,     // In user's top 50
  topArtistRank: number,    // 1-50 ranking
  importedAt: number,
  lastUpdated: number,
}
```

---

## 🔑 **Environment Variables Summary**

### Convex (Backend):
```bash
CLERK_JWT_ISSUER_DOMAIN=https://quiet-possum-71.clerk.accounts.dev ✅
SPOTIFY_CLIENT_ID=2946864dc822469b9c672292ead45f43         ✅
SPOTIFY_CLIENT_SECRET=feaf0fc901124b839b11e02f97d18a8d     ✅
```

### Frontend (.env.local):
```bash
VITE_CONVEX_URL=https://necessary-mosquito-453.convex.cloud  ✅
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...                       ✅
```

### Clerk Dashboard:
```
Spotify OAuth:  ⚠️ NEEDS CONFIGURATION (see Step 1)
```

### Spotify Dashboard:
```
Redirect URLs:  ⚠️ NEEDS CONFIGURATION (see Step 2)
```

---

## ✅ **What's Deployed**

Backend:
- ✅ Enhanced user creation with Spotify ID extraction
- ✅ getUserSpotifyArtists query
- ✅ importUserSpotifyArtistsWithToken action
- ✅ trackUserArtist mutation

Frontend:
- ✅ Spotify OAuth buttons (sign in + sign up)
- ✅ SSO callback route
- ✅ Improved auth checks (loading vs not signed in)
- ✅ Better redirects after auth
- ✅ "My Artists" dashboard UI (UserProfilePage)

---

## 🎯 **Final Steps**

1. **Enable Spotify in Clerk** (5 minutes)
2. **Add redirect URLs in Spotify** (5 minutes)
3. **Test the flow** (2 minutes)
4. **Enjoy!** 🎉

**Your app now has full Spotify integration!** 🚀

Just need to flip the switches in the Clerk and Spotify dashboards.
