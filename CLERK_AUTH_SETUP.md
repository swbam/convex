# 🔐 Clerk Authentication Setup Guide

## ✅ Code Changes Complete

All necessary code changes have been implemented. Follow the steps below to complete the Clerk Dashboard configuration.

---

## 📋 Clerk Dashboard Configuration (Required)

### 1. Create JWT Template Named "convex"

**Why:** Convex requires a specific JWT template to validate auth tokens.

**Steps:**
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **Configure** → **JWT Templates**
4. Click **New template**
5. Name it exactly: `convex`
6. Set the following:
   - **Token Lifetime**: `60 seconds` (default)
   - **Audience**: `convex`
   - **Include standard claims**: ✅ (checked)
   - **Include user metadata**: ✅ (checked, optional but recommended)
7. Copy the **Issuer URL** (you'll need this for env vars)
8. Click **Save**

---

### 2. Enable OAuth Providers (Google + Spotify)

**Why:** Allows users to sign in with Google or Spotify. Spotify also enables music library import.

#### Enable Google OAuth:

**Steps:**
1. In Clerk Dashboard, go to **User & Authentication** → **Social Connections**
2. Find **Google** in the list
3. Click **Enable**
4. Clerk auto-configures Google OAuth (no manual credentials needed)
5. Click **Save**

#### Enable Spotify OAuth:

**Steps:**
1. In Clerk Dashboard, go to **User & Authentication** → **Social Connections**
2. Find **Spotify** in the list
3. Click **Enable**
4. You'll need Spotify API credentials:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create an app (or use existing)
   - Copy **Client ID** and **Client Secret**
5. Back in Clerk, paste:
   - **Client ID**: `<your_spotify_client_id>`
   - **Client Secret**: `<your_spotify_client_secret>`
6. **Redirect URIs** (add both):
   - `https://setlists.live/sso-callback`
   - `https://<your-clerk-domain>.clerk.accounts.dev/v1/oauth_callback`
   - Also add preview URLs if using Vercel previews
7. **Scopes** (recommended):
   - `user-read-email`
   - `user-top-read`
   - `user-follow-read`
8. Click **Save**

---

### 3. Configure Clerk Webhooks

**Why:** Automatically creates/updates users in Convex when they sign up or change their profile.

**Steps:**
1. In Clerk Dashboard, go to **Webhooks**
2. Click **Add Endpoint**
3. **Endpoint URL**:
   ```
   https://exuberant-weasel-22.convex.site/http/webhooks/clerk
   ```
   (Replace `exuberant-weasel-22` with your actual Convex deployment slug)
4. **Subscribe to events**:
   - ✅ `user.created`
   - ✅ `user.updated`
5. Click **Create**
6. **Copy the Signing Secret** (starts with `whsec_...`)
7. Save this for the next step

---

## 🔧 Environment Variables

### Convex Dashboard (Production Deployment)

Set these at: [Convex Dashboard](https://dashboard.convex.dev) → Your Project → Settings → Environment Variables

```bash
CLERK_JWT_ISSUER_DOMAIN=https://<your-clerk-subdomain>.clerk.accounts.com
CLERK_WEBHOOK_SECRET=whsec_<your_webhook_secret>
TICKETMASTER_API_KEY=<your_ticketmaster_key>
SPOTIFY_CLIENT_ID=<your_spotify_client_id>
SPOTIFY_CLIENT_SECRET=<your_spotify_client_secret>
```

**Get CLERK_JWT_ISSUER_DOMAIN from:**
1. Clerk Dashboard → JWT Templates → "convex" template
2. Copy the **Issuer** URL (e.g., `https://quiet-possum-71.clerk.accounts.com`)

**For dev deployment, use:**
```bash
CLERK_JWT_ISSUER_DOMAIN=https://<your-clerk-subdomain>.clerk.accounts.dev
```

---

### Vercel (Production + Preview)

Set these at: [Vercel Dashboard](https://vercel.com) → Your Project → Settings → Environment Variables

```bash
# Frontend (VITE_ prefix required for client-side access)
VITE_CONVEX_URL=https://exuberant-weasel-22.convex.site
VITE_CLERK_PUBLISHABLE_KEY=pk_live_<your_production_key>

# For preview deployments, also set:
# VITE_CLERK_PUBLISHABLE_KEY=pk_test_<your_test_key> (preview only)
```

**Get VITE_CLERK_PUBLISHABLE_KEY from:**
- Clerk Dashboard → API Keys → Publishable Key
- Use `pk_live_...` for production
- Use `pk_test_...` for development/preview

---

### Local Development (.env.local)

Create/update `.env.local` in project root:

```bash
# Frontend
VITE_CONVEX_URL=https://<your-dev-slug>.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_<your_test_key>

# CLI (for npx convex dev)
CONVEX_DEPLOYMENT=dev:<your-dev-slug>
```

---

## 🚀 Deployment & Testing

### 1. Deploy Convex Backend

```bash
cd /Users/seth/convex-app
npx convex deploy --prod
```

This will:
- Push all backend functions to production
- Apply the new `auth.config.ts` with `CLERK_JWT_ISSUER_DOMAIN`
- Enable webhook handlers

### 2. Deploy Frontend to Vercel

```bash
npm run deploy:frontend
# or via Vercel Dashboard: Deployments → Redeploy
```

### 3. Test Authentication Flow

#### Email Sign-Up:
1. Go to `https://setlists.live/signup`
2. Enter email + password
3. Verify email (Clerk sends code)
4. Should redirect to homepage
5. **Check Convex Dashboard** → Data → `users` table → New user should appear

#### Google OAuth:
1. Go to `https://setlists.live/signin`
2. Click "Sign in with Google"
3. Choose Google account
4. Should redirect to homepage
5. **Check Convex Dashboard** → Data → `users` table → New user should appear

#### Spotify OAuth:
1. Go to `https://setlists.live/signin`
2. Click "Sign in with Spotify"
3. Authorize on Spotify
4. Should redirect to homepage
5. **Check Convex Dashboard** → Data → `users` table → User should have `spotifyId` populated

#### Verify Webhook:
1. Sign up a new user via Clerk
2. **Check Convex logs** (Dashboard → Logs):
   - Should see: `🔵 Clerk webhook: createFromClerk`
   - Should see: `✅ User created from webhook`
3. **Check `users` table** → User should exist even without visiting the site

---

## 🐛 Troubleshooting

### "Unauthorized" or `ctx.auth.getUserIdentity()` returns null

**Cause:** JWT template not configured or wrong issuer domain.

**Fix:**
1. Verify JWT template named `convex` exists in Clerk
2. Check `CLERK_JWT_ISSUER_DOMAIN` matches the Issuer URL from the template
3. Redeploy Convex: `npx convex deploy --prod`
4. Clear browser cookies and sign in again

---

### Spotify sign-in fails

**Cause:** Redirect URI mismatch or missing scopes.

**Fix:**
1. In Spotify Developer Dashboard, verify **Redirect URIs** include:
   - `https://setlists.live/sso-callback`
   - `https://<your-clerk>.clerk.accounts.dev/v1/oauth_callback`
2. In Clerk, verify Spotify OAuth is **Enabled** and scopes are set
3. Try incognito/private browsing to clear cached auth state

---

### Users table empty after sign-up

**Cause:** `createAppUser` not being called or Convex not seeing identity.

**Fix:**
1. Open browser console on homepage after sign-in
2. Look for logs: `🔍 User state:`, `🔵 Calling createAppUser...`
3. If no logs, check:
   - Clerk publishable key is correct in Vercel env vars
   - JWT template exists and is named `convex`
   - `CLERK_JWT_ISSUER_DOMAIN` is set in Convex dashboard
4. If logs show error, check Convex function logs for details

---

### Webhook not firing

**Cause:** Webhook URL incorrect or signing secret mismatch.

**Fix:**
1. Verify webhook URL in Clerk Dashboard:
   - Should be: `https://<your-slug>.convex.site/http/webhooks/clerk`
   - Not: `.convex.cloud` (wrong TLD)
2. Copy **Signing Secret** from Clerk webhook settings
3. Set `CLERK_WEBHOOK_SECRET` in Convex Dashboard env vars
4. Redeploy Convex
5. Test: Create a new user in Clerk Dashboard → Users → Add User
6. Check Convex logs for webhook processing

---

## ✅ Success Checklist

- [ ] JWT template "convex" created in Clerk
- [ ] Google OAuth enabled in Clerk
- [ ] Spotify OAuth enabled and configured
- [ ] Clerk webhook created and pointing to Convex
- [ ] `CLERK_JWT_ISSUER_DOMAIN` set in Convex (prod + dev)
- [ ] `CLERK_WEBHOOK_SECRET` set in Convex
- [ ] `VITE_CLERK_PUBLISHABLE_KEY` set in Vercel
- [ ] `VITE_CONVEX_URL` set in Vercel
- [ ] Convex backend deployed: `npx convex deploy --prod`
- [ ] Frontend deployed to Vercel
- [ ] Email sign-up creates user in Convex `users` table
- [ ] Google OAuth creates user in Convex `users` table
- [ ] Spotify OAuth populates `spotifyId` in user record
- [ ] Clerk webhook creates users automatically
- [ ] No "Unauthorized" errors in browser console

---

## 📚 Additional Resources

- [Convex + Clerk Integration Docs](https://docs.convex.dev/auth/clerk)
- [Clerk JWT Templates](https://clerk.com/docs/backend-requests/making/jwt-templates)
- [Clerk Webhooks](https://clerk.com/docs/integrations/webhooks)
- [Spotify OAuth Scopes](https://developer.spotify.com/documentation/web-api/concepts/scopes)

---

**Need help?** Check Convex logs and browser console for detailed error messages.

