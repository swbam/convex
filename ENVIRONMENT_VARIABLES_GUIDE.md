# 🔑 Environment Variables Guide - Where Each Key Goes

## 📋 Quick Answer

**Clerk Keys in Convex?** → **NO** (except the issuer domain)

**Why?** Convex validates JWTs using **public key cryptography**, not secret keys!

---

## 🎯 Where Each Variable Goes

### ✅ **FRONTEND ONLY** (`.env.local` or Vercel):

```bash
# Clerk Frontend
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cXVpZXQtcG9zc3VtLTcxLmNsZXJrLmFjY291bnRzLmRldiQ
# ↑ Public key - safe to expose in browser
# Used by: Frontend to initialize Clerk

# Convex Connection
VITE_CONVEX_URL=https://necessary-mosquito-453.convex.cloud
# ↑ Your Convex deployment URL
# Used by: Frontend to connect to Convex
```

**Set these in**:
- Local: `.env.local` file
- Production: Vercel dashboard → Environment Variables

---

### ✅ **BACKEND ONLY** (Convex - via `npx convex env set`):

```bash
# Clerk JWT Validation (ONLY ONE NEEDED!)
CLERK_JWT_ISSUER_DOMAIN=https://quiet-possum-71.clerk.accounts.dev
# ↑ Used to validate JWT tokens via public JWKS
# Convex fetches public keys from: <domain>/.well-known/jwks.json

# Spotify API
SPOTIFY_CLIENT_ID=2946864dc822469b9c672292ead45f43
SPOTIFY_CLIENT_SECRET=feaf0fc901124b839b11e02f97d18a8d

# Ticketmaster API
TICKETMASTER_API_KEY=k8GrSAkbFaN0w7qDxGl7ohr8LwdAQm9b

# Setlist.fm API
SETLISTFM_API_KEY=xkutflW-aRy_Df9rF4OkJyCsHBYN88V37EBL
```

**Set these in Convex**:
```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://quiet-possum-71.clerk.accounts.dev" --prod
npx convex env set SPOTIFY_CLIENT_ID "your_id" --prod
npx convex env set SPOTIFY_CLIENT_SECRET "your_secret" --prod
# etc...
```

---

### ❌ **NEVER NEEDED IN CONVEX**:

```bash
# These stay in .env.local ONLY:
CLERK_SECRET_KEY=sk_test_...           # ❌ NOT needed in Convex
CLERK_PUBLISHABLE_KEY=pk_test_...      # ❌ NOT needed in Convex
```

**Why not?**
- Convex doesn't call Clerk's API directly
- Convex only **validates JWTs** using public key cryptography
- Public keys are fetched from JWKS endpoint (no secret needed!)

---

## 🔐 How JWT Validation Works (Technical)

### **Public Key Cryptography**:

```
┌──────────────┐                    ┌──────────────┐
│    CLERK     │                    │   CONVEX     │
│              │                    │              │
│ 1. Signs JWT │                    │ 4. Validates │
│    with      │  ──JWT Token────>  │    with      │
│  PRIVATE key │                    │  PUBLIC key  │
│              │                    │              │
│ 2. Sends JWT │                    │ 5. Fetches   │
│    to client │                    │    from JWKS │
│              │                    │              │
└──────────────┘                    └──────────────┘
        │                                  │
        │                                  │
        ▼                                  ▼
  Private key                      Public keys at:
  (Clerk keeps)          https://quiet-possum-71.clerk.accounts.dev/
                                .well-known/jwks.json
```

### **The Process**:

1. **Clerk signs JWT** with its private key (you never see this)
2. **Frontend receives JWT** (contains user data)
3. **Frontend sends JWT to Convex** (with every request)
4. **Convex fetches public keys** from Clerk's JWKS endpoint
5. **Convex validates signature** using public key (no secret needed!)
6. **If valid** → `ctx.auth.getUserIdentity()` returns user data
7. **If invalid** → `ctx.auth.getUserIdentity()` returns null

---

## ✅ Current Status of Your Environment Variables

### **Already Set in Convex** (I just set these):

```bash
✅ CLERK_JWT_ISSUER_DOMAIN          # For JWT validation
✅ SPOTIFY_CLIENT_ID                # For Spotify API
✅ SPOTIFY_CLIENT_SECRET            # For Spotify API  
✅ TICKETMASTER_API_KEY             # For Ticketmaster API
✅ SETLISTFM_API_KEY                # For Setlist.fm API
```

### **Already Set in .env.local** (For Frontend):

```bash
✅ VITE_CONVEX_URL                  # Convex connection
✅ VITE_CLERK_PUBLISHABLE_KEY       # Clerk initialization
```

### **NOT Needed Anywhere**:

```bash
❌ CLERK_SECRET_KEY                 # Only if calling Clerk API directly
```

---

## 🧪 Verify It's Working

### **Test JWT Validation**:

```bash
# 1. Start dev server
npm run dev

# 2. Open browser console

# 3. Sign in to the app

# 4. Check console for:
# "✅ Created app user" or similar message

# 5. Check Convex dashboard:
# https://dashboard.convex.dev/d/necessary-mosquito-453/data/users
# Should see your user!
```

### **Quick Test Query**:

Create a test file to verify auth:

```typescript
// convex/testAuth.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const checkAuth = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return {
      isAuthenticated: !!identity,
      email: identity?.email,
      subject: identity?.subject,
      name: identity?.name,
    };
  },
});
```

Then run:
```bash
npx convex run testAuth:checkAuth
```

---

## 📊 Environment Variable Matrix

| Variable | Frontend | Convex | Why |
|----------|----------|--------|-----|
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ YES | ❌ NO | Frontend needs to init Clerk |
| `CLERK_SECRET_KEY` | ❌ NO | ❌ NO | Not needed (using JWT validation) |
| `CLERK_JWT_ISSUER_DOMAIN` | ❌ NO | ✅ YES | Convex validates JWTs |
| `VITE_CONVEX_URL` | ✅ YES | ❌ NO | Frontend connects to Convex |
| `SPOTIFY_CLIENT_ID` | ❌ NO | ✅ YES | Backend calls Spotify API |
| `TICKETMASTER_API_KEY` | ❌ NO | ✅ YES | Backend calls Ticketmaster |

---

## 🎯 Summary

**Question**: Do I need Clerk keys in Convex?  
**Answer**: **Only the issuer domain** (which I already set for you!)

**What You Need**:
- ✅ Frontend: `VITE_CLERK_PUBLISHABLE_KEY` (already in .env.local)
- ✅ Convex: `CLERK_JWT_ISSUER_DOMAIN` (already set via `npx convex env set`)
- ❌ Convex: NOT the publishable or secret keys!

**Why It Works**:
- Clerk signs JWTs with private key
- Convex validates JWTs with public keys (fetched from JWKS)
- No secrets needed in Convex!

**Your auth is now fully configured!** Just sign in and the users table will populate automatically. 🎉
