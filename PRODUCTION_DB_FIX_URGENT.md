# 🚨 URGENT: Production Database Configuration Fix

## ❌ **CRITICAL ISSUE FOUND**

**Your website https://setlists.live is using the DEVELOPMENT database instead of PRODUCTION!**

```
Current Setup (WRONG):
├── Domain: https://setlists.live
├── Frontend: Deployed on Vercel
└── Database: https://necessary-mosquito-453.convex.cloud ❌ DEV DATABASE!

Should Be:
├── Domain: https://setlists.live  
├── Frontend: Deployed on Vercel
└── Database: https://exuberant-weasel-22.convex.cloud ✅ PROD DATABASE!
```

---

## ✅ **IMMEDIATE FIX - Vercel Environment Variables**

### **Step 1: Go to Vercel Dashboard**

```
https://vercel.com/dashboard
→ Click on your project (setlists-live or similar)
→ Settings → Environment Variables
```

### **Step 2: Add/Update Production Environment Variable**

**Delete** any existing `VITE_CONVEX_URL` and create new:

```
Variable Name:  VITE_CONVEX_URL
Value:          https://exuberant-weasel-22.convex.cloud
Environment:    ✅ Production (CHECK THIS BOX!)
```

**CRITICAL**: Make sure "Production" is checked, NOT "Preview" or "Development"!

### **Step 3: Redeploy**

In Vercel dashboard:
```
Deployments → Latest deployment → ... menu → Redeploy
```

Or from command line:
```bash
vercel --prod
```

---

## 📊 **Database Schema Comparison**

### **Production Has ALL Essential Tables** ✅:
```
✅ artists          (3 artists currently)
✅ shows            (49 shows currently)  
✅ venues           (9 venues currently)
✅ songs            (219 songs currently)
✅ users            (0 - but table exists!)
✅ setlists
✅ votes
✅ songVotes
✅ artistSongs
✅ trendingArtists
✅ trendingShows
✅ syncJobs
✅ syncStatus
✅ userFollows
✅ userSpotifyArtists
✅ contentFlags
✅ userAchievements
```

**Production database is COMPLETE and WORKING!** ✅

### **Development Has Extra Tables** (Old/Unused):
```
⚠️ authAccounts        (Convex Auth - not used, you use Clerk)
⚠️ authSessions        (Convex Auth - not used)
⚠️ authRateLimits      (Convex Auth - not used)
⚠️ authRefreshTokens   (Convex Auth - not used)
⚠️ authVerificationCodes (Convex Auth - not used)
⚠️ authVerifiers       (Convex Auth - not used)
⚠️ follows             (Old table, replaced by userFollows)
⚠️ jobs                (Old table, replaced by syncJobs)
⚠️ setlistSongs        (Old table, not in schema)
⚠️ setlistVotes        (Old table, replaced by votes)
⚠️ syncProgress        (Old table, not in schema)
⚠️ trending            (Old table, replaced by trendingArtists/Shows)
```

**These are OLD tables from previous versions - can be ignored!**

---

## 🎯 **The Real Problem**

### **Why Users See Empty Data**:

```
User visits: https://setlists.live
  ↓
Vercel serves frontend
  ↓
Frontend loads: VITE_CONVEX_URL from Vercel env vars
  ↓
Currently points to: necessary-mosquito-453 (DEV) ❌
  ↓
Queries development database
  ↓
Dev DB has DIFFERENT data than prod!
  ↓
Users see dev data, not production data!
```

---

## ✅ **After Fix**:

```
User visits: https://setlists.live
  ↓
Vercel serves frontend
  ↓
Frontend loads: VITE_CONVEX_URL = exuberant-weasel-22 ✅
  ↓
Queries PRODUCTION database
  ↓
Production has 3 artists, 49 shows, 219 songs
  ↓
✅ Users see correct production data!
```

---

## 🔧 **Verification Steps**

### **Step 1: Check Current Vercel Env Vars**

```
Vercel Dashboard → Settings → Environment Variables

Look for: VITE_CONVEX_URL
Current value: ???

If it's NOT "https://exuberant-weasel-22.convex.cloud"
→ UPDATE IT NOW!
```

### **Step 2: After Updating**

```bash
# Trigger redeploy in Vercel dashboard
# OR
vercel --prod

# Wait 1-2 minutes for deployment
```

### **Step 3: Verify It Works**

```bash
# Visit your site
https://setlists.live

# Open browser console
# Check Convex connection
console.log(window.__CONVEX_CLIENT__?.url);

# Should show:
"https://exuberant-weasel-22.convex.cloud" ✅

# If it shows:
"https://necessary-mosquito-453.convex.cloud" ❌
→ Vercel env var not updated or deployment not complete
```

---

## 📋 **Complete Vercel Environment Variables**

### **Production Environment**:
```
VITE_CONVEX_URL=https://exuberant-weasel-22.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cXVpZXQtcG9zc3VtLTcxLmNsZXJrLmFjY291bnRzLmRldiQ
```

### **Preview/Development** (Optional):
```
VITE_CONVEX_URL=https://necessary-mosquito-453.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cXVpZXQtcG9zc3VtLTcxLmNsZXJrLmFjY291bnRzLmRldiQ
```

---

## 🎯 **Summary**

**Issue**: Frontend using dev DB instead of prod DB  
**Cause**: Vercel environment variable points to dev  
**Fix**: Update `VITE_CONVEX_URL` in Vercel to production URL  
**Impact**: CRITICAL - affects all users on setlists.live  

**Fix this NOW in Vercel dashboard!** 🚨

---

## 🚀 **Quick Fix Steps**

1. **Vercel Dashboard** → Your Project → Settings → Environment Variables
2. **Update `VITE_CONVEX_URL`** to `https://exuberant-weasel-22.convex.cloud`
3. **Check "Production" environment**
4. **Save**
5. **Redeploy** (Deployments → Redeploy)
6. **Done!** ✅

**This fixes the database mismatch issue!** 🎉
