# 🔐 Clerk Authentication Setup Guide

## Current Issue: "Error loading CAPTCHA"

### **ROOT CAUSE**
Clerk's bot protection (CAPTCHA) is **not properly configured** in your Clerk Dashboard.

### **IMMEDIATE FIX** ✅

1. **Go to Clerk Dashboard** → [https://dashboard.clerk.com](https://dashboard.clerk.com)

2. **Navigate to**: Your Application → **User & Authentication** → **Attack Protection**

3. **Configure Bot Sign-up Protection**:
   - **Option A (Recommended)**: **Disable CAPTCHA** for development
     - Turn OFF "Bot sign-up protection"
     - Click "Save"
   
   - **Option B**: **Enable CAPTCHA Properly**
     - Enable "Bot sign-up protection"
     - Choose CAPTCHA provider (Cloudflare Turnstile recommended - it's free)
     - Add your domain to allowed domains
     - Click "Save"

4. **Test**: Try signing up again - CAPTCHA error should be gone!

---

## Complete Auth Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER SIGNS UP                             │
├─────────────────────────────────────────────────────────────┤
│  1. Email/Password OR OAuth (Google/Spotify)                │
│  2. Clerk creates user in their system                       │
│  3. Clerk sends webhook → /webhooks/clerk                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              WEBHOOK HANDLER (convex/http.ts)                │
├─────────────────────────────────────────────────────────────┤
│  1. Receives webhook from Clerk                              │
│  2. Extracts Svix headers (id, timestamp, signature)        │
│  3. Calls internal.webhooks.handleClerkWebhook              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│        WEBHOOK PROCESSOR (convex/webhooks.ts)                │
├─────────────────────────────────────────────────────────────┤
│  1. Verifies webhook signature (if WEBHOOK_SECRET exists)   │
│  2. Processes event type:                                   │
│     - user.created → internal.users.upsertFromClerk         │
│     - user.updated → internal.users.upsertFromClerk         │
│     - user.deleted → internal.users.deleteFromClerk         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│         USER CREATION (convex/users.ts)                      │
├─────────────────────────────────────────────────────────────┤
│  Function: createFromClerk / upsertFromClerk                │
│  Creates/updates user in Convex database:                   │
│    - authId: Clerk user ID                                  │
│    - email, name, avatar                                    │
│    - spotifyId (if OAuth)                                   │
│    - role: "user"                                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              USER ACCESSES APP                               │
├─────────────────────────────────────────────────────────────┤
│  1. AuthGuard checks if user exists in Convex               │
│  2. If not, calls auth.ensureUserExists                     │
│  3. User can now use app features                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Variables Required

### **Convex** (`convex/.env`)
```bash
# Clerk
CLERK_ISSUER_URL=https://your-clerk-issuer.clerk.accounts.dev
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Optional - for backend API calls to Clerk
CLERK_SECRET_KEY=sk_test_xxxxx
```

### **Frontend** (`.env.local`)
```bash
# Convex
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
```

---

## How to Get Environment Variables

### 1. **CLERK_ISSUER_URL**
```
Dashboard → API Keys → "Issuer URL" or "JWT Issuer URL"
Example: https://genuine-seahorse-12.clerk.accounts.dev
```

### 2. **VITE_CLERK_PUBLISHABLE_KEY** 
```
Dashboard → API Keys → "Publishable Key"
Starts with: pk_test_ or pk_live_
```

### 3. **CLERK_WEBHOOK_SECRET**
```
Dashboard → Webhooks → Create endpoint
URL: https://YOUR-CONVEX-SITE.convex.site/webhooks/clerk
Events to subscribe:
  - user.created
  - user.updated
  - user.deleted

After creating, copy the "Signing Secret"
Starts with: whsec_
```

### 4. **CLERK_SECRET_KEY** (Optional)
```
Dashboard → API Keys → "Secret Key"
Starts with: sk_test_ or sk_live_
⚠️ NEVER commit this to git!
```

---

## Webhook Setup Checklist

- [ ] **Create webhook endpoint** in Clerk Dashboard
- [ ] **URL**: `https://YOUR-DEPLOYMENT.convex.site/webhooks/clerk`
- [ ] **Subscribe to events**:
  - `user.created`
  - `user.updated`
  - `user.deleted`
- [ ] **Copy signing secret** → Add to `convex/.env` as `CLERK_WEBHOOK_SECRET`
- [ ] **Deploy Convex**: `npx convex deploy`
- [ ] **Test**: Sign up with a new email, check Convex dashboard for user creation

---

## JWT Template Configuration

### **Required for Convex + Clerk Integration**

1. **Go to**: Clerk Dashboard → **JWT Templates**

2. **Create template named**: `convex` (EXACT name required)

3. **Configure**:
   - **Name**: `convex`
   - **Lifetime**: `3600` seconds (1 hour)
   - **Claims**: **LEAVE EMPTY** or add only custom claims like:
     ```json
     {}
     ```
   
   **⚠️ IMPORTANT**: 
   - Do NOT add `sub` claim - Clerk includes it automatically!
   - Do NOT add `aud` claim - Set via "Audience" field instead
   
4. **Audience (Optional)**:
   - Leave blank OR set to `convex`
   - Clerk will handle this automatically

5. **Default claims** Clerk includes automatically:
   - `sub` - User ID (Clerk subject)
   - `iat` - Issued at timestamp
   - `exp` - Expiration timestamp
   - `iss` - Issuer URL
   - Plus any custom claims you add

6. **Why "convex"?**
   - Your `src/main.tsx` requests JWT with template: `"convex"`
   - Your `convex/auth.config.ts` expects: `applicationID: "convex"`
   - **They must match!**

---

## Files That Handle Authentication

### **Frontend**
| File | Purpose |
|------|---------|
| `src/main.tsx` | Initializes ClerkProvider, custom useAuth hook |
| `src/pages/SignUpPage.tsx` | Sign up UI + CAPTCHA container |
| `src/pages/SignInPage.tsx` | Sign in UI |
| `src/pages/SSOCallback.tsx` | OAuth callback handler |
| `src/components/AuthGuard.tsx` | Ensures Convex user exists |

### **Backend (Convex)**
| File | Purpose |
|------|---------|
| `convex/auth.config.ts` | JWT verification config |
| `convex/auth.ts` | Auth helper functions |
| `convex/http.ts` | Webhook endpoint |
| `convex/webhooks.ts` | Webhook processing logic |
| `convex/users.ts` | User CRUD operations |

---

## Common Issues & Solutions

### ❌ "Error loading CAPTCHA"
**Solution**: Disable bot protection or configure CAPTCHA properly in Clerk Dashboard

### ❌ "User not found in Convex"
**Solution**: 
1. Check webhook is configured correctly
2. Check `CLERK_WEBHOOK_SECRET` is set
3. Manually call `auth.ensureUserExists` from frontend

### ❌ "Invalid JWT"
**Solution**:
1. Ensure JWT template name is "convex" (not "setlistslive" or anything else)
2. Check `CLERK_ISSUER_URL` matches your Clerk domain
3. Verify `auth.config.ts` has `applicationID: "convex"`

### ❌ "Webhook not receiving events"
**Solution**:
1. Deploy Convex first: `npx convex deploy`
2. Get deployment URL from dashboard
3. Add webhook in Clerk with correct URL
4. Test with a new user sign-up

---

## Testing the Complete Flow

### **1. Test Email Sign-Up**
```bash
1. Go to /signup
2. Enter email + password
3. Check for CAPTCHA widget (if enabled)
4. Submit
5. Verify email
6. Should redirect to /
7. Check Convex dashboard → users table → user should exist
```

### **2. Test OAuth Sign-Up (Google)**
```bash
1. Go to /signup
2. Click "Sign up with Google"
3. Complete OAuth flow
4. Should redirect to /
5. Check Convex dashboard → user should exist with email from Google
```

### **3. Test OAuth Sign-Up (Spotify)**
```bash
1. Go to /signup  
2. Click "Sign up with Spotify"
3. Complete OAuth flow
4. Should redirect to /activity
5. Check Convex dashboard → user should exist with spotifyId
```

### **4. Verify Webhook**
```bash
# In Clerk Dashboard → Webhooks → View your endpoint
# You should see:
# - Recent deliveries (200 OK responses)
# - Payloads for user.created events

# In Convex Dashboard → Logs
# You should see:
# "🔵 Processing Clerk webhook: user.created"
# "✅ User created from webhook: [userId]"
```

---

## Security Best Practices

1. ✅ **Always verify webhooks** in production (enable signature verification)
2. ✅ **Never commit secrets** to git (use `.env.local` and `convex/.env`)
3. ✅ **Use environment-specific keys** (test vs production)
4. ✅ **Enable MFA** for admin accounts
5. ✅ **Monitor webhook failures** in Clerk dashboard
6. ✅ **Rotate secrets** periodically

---

## Next Steps

1. **Fix CAPTCHA**: Disable or configure properly in Clerk Dashboard
2. **Test sign-up**: Create a new account
3. **Verify webhook**: Check Convex logs for user creation
4. **Test sign-in**: Sign in with the new account
5. **Check user data**: Verify user exists in Convex `users` table

---

## Support & Resources

- **Clerk Docs**: https://clerk.com/docs
- **Convex + Clerk Guide**: https://docs.convex.dev/auth/clerk
- **Webhook Debugging**: https://clerk.com/docs/webhooks/debugging
- **JWT Template Guide**: https://clerk.com/docs/jwt-templates

---

**Status**: ✅ Implementation complete, needs CAPTCHA configuration in Clerk Dashboard
**Last Updated**: November 7, 2025

