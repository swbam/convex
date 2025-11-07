# 🚨 CRITICAL AUTH ERROR - IMMEDIATE FIX

## Error Message

```
Failed to authenticate: "No auth provider found matching the given token"
```

---

## 🔍 ROOT CAUSE

**CLERK_ISSUER_URL environment variable is NOT SET in Convex!**

This is required for Convex to verify Clerk JWTs. Without it:
- ✅ User can sign up in Clerk (works)
- ✅ User gets redirected to app (works)
- ❌ Convex rejects the JWT (FAILS!)
- ❌ WebSocket authentication fails (FAILS!)

---

## ✅ IMMEDIATE FIX (2 minutes)

### **Step 1: Get Your Clerk Issuer URL**

1. Go to: https://dashboard.clerk.com
2. Select your application
3. Navigate: **Configure** → **API Keys**
4. Find the field labeled: **"JWT Issuer URL"** or **"Issuer"**
5. Copy it (example: `https://genuine-seahorse-12.clerk.accounts.dev`)

### **Step 2: Set It in Convex**

```bash
npx convex env set CLERK_ISSUER_URL "https://YOUR-ISSUER.clerk.accounts.dev"
```

**Replace** `YOUR-ISSUER` with your actual issuer from Step 1!

### **Step 3: Restart Dev Server**

```bash
# Stop current server (Ctrl+C)
npm run dev
```

### **Step 4: Test**

1. Sign up again
2. You should be redirected to homepage
3. No more "No auth provider found" error!
4. WebSocket should connect successfully

---

## 🔧 Alternative: Set in Convex Dashboard

If CLI doesn't work:

1. Go to: https://dashboard.convex.dev
2. Select your deployment
3. Navigate: **Settings** → **Environment Variables**
4. Click: **Add Environment Variable**
5. Name: `CLERK_ISSUER_URL`
6. Value: Your Clerk issuer URL
7. Click: **Save**
8. Restart dev server

---

## 📋 Complete Environment Variables Checklist

### **Convex Environment** (Required)
```bash
npx convex env set CLERK_ISSUER_URL "https://YOUR-ISSUER.clerk.accounts.dev"

# Optional (for webhooks)
npx convex env set CLERK_WEBHOOK_SECRET "whsec_xxxxxxx"
```

### **Frontend Environment** (`.env.local`)
```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxx
```

---

## 🔍 Verify Configuration

### **Check auth.config.ts**

File should read:
```typescript
const clerkIssuerUrl = process.env.CLERK_ISSUER_URL!;

export default {
  providers: [
    {
      domain: clerkIssuerUrl,  // ← This needs CLERK_ISSUER_URL env var!
      applicationID: "convex",
    },
  ],
};
```

### **Check JWT Template in Clerk**

Template name must be: `convex` (matches `applicationID`)

---

## 🧪 Test After Fix

```bash
# 1. Set environment variable
npx convex env set CLERK_ISSUER_URL "https://YOUR-ISSUER.clerk.accounts.dev"

# 2. Restart
npm run dev

# 3. Sign up
# Go to /signup, create account

# 4. Verify
# Should redirect to home with no errors
# Check browser console - no "No auth provider" errors
# Check Network tab - WebSocket should connect
```

---

## 🎯 Why This Happened

**This used to work** means:
1. You had CLERK_ISSUER_URL set before
2. It got cleared/reset somehow
3. Or you're using a different Convex deployment

**Solution**: Just set it again!

---

## 💡 Common Mistakes

### ❌ Wrong issuer URL format
```bash
# WRONG:
https://clerk.com
https://dashboard.clerk.com
pk_test_xxxxx

# CORRECT:
https://your-app-name.clerk.accounts.dev
```

### ❌ Not restarting dev server
```bash
# After setting env vars, you MUST restart:
npm run dev
```

### ❌ Setting in wrong place
```bash
# DON'T set in .env.local (that's frontend only)
# DO set via: npx convex env set
```

---

## 🔧 Debug Commands

### **Check current Convex env vars**:
```bash
npx convex env list
```

You should see `CLERK_ISSUER_URL` in the output.

### **Check Convex logs**:
```bash
npx convex logs
```

Look for JWT verification errors.

---

## 📊 Expected Behavior After Fix

### **Before (Broken)**:
```
Sign up → Redirect → 
❌ "No auth provider found" → 
❌ WebSocket fails → 
❌ Stuck on welcome screen
```

### **After (Fixed)**:
```
Sign up → Redirect → 
✅ JWT verified → 
✅ WebSocket connects → 
✅ User sees dashboard!
```

---

## 🚀 Quick Fix Command

Copy-paste this (replace YOUR-ISSUER):

```bash
npx convex env set CLERK_ISSUER_URL "https://YOUR-ISSUER.clerk.accounts.dev" && npm run dev
```

---

**Priority**: 🔴 CRITICAL - Required for auth to work!  
**Time to Fix**: 2 minutes  
**Complexity**: Easy - just set one environment variable

