# 🚀 Quick Start: Testing Auth Fixes

## Immediate Steps to Test (5 minutes)

### 1. Set Environment Variables

**Edit `.env.local` file** (already created):

```bash
# Replace with YOUR actual values:
VITE_CONVEX_URL=https://your-actual-convex-url.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_clerk_key_here
```

**Where to find these:**
- **Convex URL**: [Convex Dashboard](https://dashboard.convex.dev) → Your Project → Settings
- **Clerk Key**: [Clerk Dashboard](https://dashboard.clerk.com) → API Keys → Copy Publishable Key

### 2. Start the Development Server

```bash
npm install  # If you haven't already
npm run dev
```

The app should open at `http://localhost:5173`

### 3. Test Authentication

#### Test 1: Check Environment Variables
1. Open browser to `http://localhost:5173`
2. **If env vars are missing**, you'll see a diagnostic screen
3. **If env vars are set**, you'll see the home page ✅

#### Test 2: Email Sign-Up
1. Go to `/signup`
2. Enter email and password
3. **Open browser console** (F12 or Cmd+Option+I)
4. Look for logs:
   - `📧 Starting email sign up...`
   - `Sign up result status: ...`
5. Check your email for verification code
6. Enter code
7. Should redirect to home page

#### Test 3: Google OAuth
1. Go to `/signin`
2. **Open browser console first**
3. Click "Sign in with Google"
4. Look for log: `🔍 Starting Google OAuth flow...`
5. If you see errors in console, read them carefully
6. If OAuth is NOT enabled in Clerk, you'll see an error message

#### Test 4: Spotify OAuth
1. Go to `/signin`
2. **Open browser console first**
3. Click "Sign in with Spotify"
4. Look for log: `🎵 Starting Spotify OAuth flow...`
5. If you see errors in console, read them carefully
6. If OAuth is NOT enabled in Clerk, you'll see an error message

---

## Expected Console Output

### ✅ Successful OAuth Flow:
```
🔍 Starting Google OAuth flow...
(redirects to Google)
(comes back)
✅ Sign in successful, redirecting...
```

### ❌ OAuth Not Enabled Error:
```
🔍 Starting Google OAuth flow...
❌ Google sign in error: [ClerkAPIResponseError]
Error details: {
  message: "The authentication provider 'oauth_google' is not enabled.",
  errors: [...]
}
```

**Fix**: Enable Google in Clerk Dashboard → Social Connections

### ❌ Missing Env Vars:
```
Missing environment variables: { 
  convexUrl: false, 
  publishableKey: false 
}
```

**Fix**: Set `VITE_CONVEX_URL` and `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local`

---

## Minimum Required Clerk Configuration

**To test email auth only** (no OAuth):
1. ✅ Get Clerk publishable key
2. ✅ Set `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local`
3. ✅ Email/Password should work immediately

**To test Google OAuth**:
1. ✅ All email auth requirements above
2. ✅ Enable Google in Clerk Dashboard → Social Connections
3. ✅ Click "Sign in with Google" button

**To test Spotify OAuth**:
1. ✅ All email auth requirements above
2. ✅ Create Spotify Developer App
3. ✅ Enable Spotify in Clerk Dashboard with credentials
4. ✅ Add redirect URIs
5. ✅ Click "Sign in with Spotify" button

---

## Quick Troubleshooting

### Button clicks but nothing happens:
1. ✅ Open browser console (you should ALWAYS have it open)
2. ✅ Click button again
3. ✅ Read the error message in console
4. ✅ Most common: OAuth provider not enabled in Clerk

### "Authentication not ready" error:
1. ✅ Check `.env.local` has correct `VITE_CLERK_PUBLISHABLE_KEY`
2. ✅ Restart dev server: `npm run dev`
3. ✅ Hard refresh browser: Cmd/Ctrl + Shift + R

### OAuth redirects but fails:
1. ✅ Check Clerk Dashboard → Social Connections → Provider is enabled
2. ✅ Check redirect URIs match in OAuth provider settings
3. ✅ For local dev, ensure `http://localhost:5173/sso-callback` is added

### Email verification not working:
1. ✅ Check spam folder
2. ✅ Check Clerk Dashboard → Email settings
3. ✅ Look for detailed error in browser console

---

## What Should Work RIGHT NOW

After setting `.env.local`:

- ✅ **Home page loads** (if env vars are set)
- ✅ **Email sign-up** (with verification)
- ✅ **Email sign-in** (for existing users)
- ✅ **Detailed error messages** in console
- ✅ **User-friendly error toasts**

What requires Clerk configuration:

- ⏳ **Google OAuth** (needs Google enabled in Clerk)
- ⏳ **Spotify OAuth** (needs Spotify app + Clerk config)
- ⏳ **Webhook user creation** (needs webhook endpoint)

---

## The #1 Rule for Testing Auth

**🔍 ALWAYS HAVE THE BROWSER CONSOLE OPEN**

Every authentication action now logs detailed information:
- What's happening
- What succeeded
- What failed and why

If something doesn't work, the console will tell you exactly what's wrong.

---

## Next Steps After Basic Testing

Once email auth is working:

1. **Enable Google OAuth** (if needed)
   - See `AUTH_FIX_SUMMARY.md` → Step 2 → Google OAuth

2. **Enable Spotify OAuth** (if needed)
   - See `AUTH_FIX_SUMMARY.md` → Step 2 → Spotify OAuth

3. **Set up JWT template** (for Convex integration)
   - See `AUTH_FIX_SUMMARY.md` → Step 2 → Configure JWT Template

4. **Configure Convex env vars**
   - See `AUTH_FIX_SUMMARY.md` → Step 2 → Configure Convex Environment Variables

5. **Deploy to production**
   - See `AUTH_FIX_SUMMARY.md` → Step 3

---

## Files Changed (For Reference)

1. ✅ `src/main.tsx` - ClerkProvider config
2. ✅ `src/pages/SignInPage.tsx` - Better errors & logging
3. ✅ `src/pages/SignUpPage.tsx` - Better errors & logging
4. ✅ `.env.local` - Template created (YOU MUST EDIT THIS)

No backend changes were needed. All fixes were frontend configuration and error handling.

---

**Ready to test?** 

1. Edit `.env.local` with your keys
2. Run `npm run dev`
3. Open browser console
4. Try signing up with email

If you see errors, read them carefully - they now tell you exactly what's wrong! 🎯
