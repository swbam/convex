# 🚨 CRITICAL: Database Configuration Fix

## ❌ **The Problem Found**

**Your frontend is using the WRONG Convex deployment!**

```
Frontend (.env.local):     https://necessary-mosquito-453.convex.cloud  ❌ DEV
Production database:       https://exuberant-weasel-22.convex.cloud     ✅ PROD
Domain (setlists.live):    Should use PROD, but gets DEV!              ❌ WRONG
```

**Result**: Users on https://setlists.live are hitting the DEV database!

---

## ✅ **The Fix**

### **Step 1: Set Vercel Environment Variables** (CRITICAL!)

Go to **Vercel Dashboard**:
```
https://vercel.com/dashboard
→ Select "setlists-live" project
→ Settings → Environment Variables
```

**Add/Update**:
```
Variable Name:              Value:
VITE_CONVEX_URL            https://exuberant-weasel-22.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY pk_test_cXVpZXQtcG9zc3VtLTcxLmNsZXJrLmFjY291bnRzLmRldiQ

Environment: Production ✅
```

**CRITICAL**: Make sure it says "Production" not "Preview" or "Development"!

### **Step 2: Redeploy to Vercel**

```bash
npm run build
vercel --prod
```

Or:
```bash
npm run all
```

---

## 📊 **Database Comparison**

### **Development** (necessary-mosquito-453):
```
✅ 29 tables total
✅ Includes: auth* tables (old Convex Auth, not used)
✅ Includes: follows, jobs, trending (old tables)
✅ Has all your app tables
```

### **Production** (exuberant-weasel-22):
```
✅ 17 tables total  
✅ All essential app tables present:
   - artists ✅
   - shows ✅
   - venues ✅
   - songs ✅
   - users ✅
   - setlists ✅
   - votes ✅
   - trending* ✅
```

**Production has EVERYTHING you need!** The "missing" tables in dev are old/unused.

---

## 🔧 **What's Missing in Production** (and why it's OK)

### **Auth Tables** (authAccounts, authSessions, etc.):
- ❌ Not in production
- ✅ **This is CORRECT!**
- **Why**: You're using Clerk for auth, not Convex Auth
- **Action**: None needed

### **Old Tables** (follows, jobs, syncProgress, trending):
- ❌ Not in production
- ✅ **This is CORRECT!**
- **Why**: These
