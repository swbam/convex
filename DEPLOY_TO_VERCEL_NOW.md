# 🚀 DEPLOY TO VERCEL - Step by Step Guide

## 🚨 **CRITICAL: You Must Deploy to Vercel!**

The 404 errors are happening because **your changes aren't deployed yet**.

---

## ✅ **Current Status**

**Local Build**: ✅ Complete (dist/ folder ready)  
**Vercel Deployment**: ❌ **NOT DEPLOYED YET**  

**Result**: Old version still running → 404 errors!

---

## 🚀 **Deploy Now (3 Options)**

### **Option 1: Full Deployment** (Recommended):
```bash
npm run all
```

This deploys:
1. Backend to Convex ✅
2. Frontend to Vercel ✅

### **Option 2: Frontend Only**:
```bash
npm run deploy:frontend
```

### **Option 3: Manual Vercel Deploy**:
```bash
vercel --prod
```

---

## 📋 **First Time Vercel Setup**

If you haven't connected to Vercel yet:

### **Step 1: Install Vercel CLI** (if not installed):
```bash
npm install -g vercel
```

### **Step 2: Login to Vercel**:
```bash
vercel login
```

This opens browser to log in.

### **Step 3: Link Project**:
```bash
vercel link
```

Answer the prompts:
```
? Set up and deploy "~/convex-app"? [Y/n] Y
? Which scope? [Your Vercel account]
? Link to existing project? [Y/n] n (if new project)
? What's your project's name? setlists-live
? In which directory is your code located? ./
```

### **Step 4: Deploy**:
```bash
vercel --prod
```

---

## 🌐 **Domain Configuration** (Vercel Dashboard)

After deploying, set up your domain:

### **Step 1: Go to Vercel Dashboard**:
```
https://vercel.com/dashboard
→ Select your project (setlists-live)
→ Settings → Domains
```

### **Step 2: Add Domains**:
```
1. Add: setlists.live
   - Primary domain
   - Set as production

2. Add: www.setlists.live  
   - Redirect to setlists.live
   - Vercel does this automatically
```

### **Step 3: Configure DNS** (At your domain registrar):

**For Vercel**:
```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

**Or use Vercel's nameservers** (easier):
- Vercel provides nameservers
- Update at your domain registrar
- Vercel handles everything automatically

---

## 🔍 **Why 404 Happens Currently**

```
https://www.setlists.live/artists/eagles
         ↓
Vercel server (OLD deployment)
         ↓
No vercel.json rewrites configured
         ↓
Looks for /artists/eagles file
         ↓
File doesn't exist
         ↓
❌ 404 ERROR
```

---

## ✅ **After Deployment**

```
https://setlists.live/artists/eagles
         ↓
Vercel server (NEW deployment)
         ↓
Checks vercel.json:
  "source": "/(.*)" matches
  "destination": "/index.html"
         ↓
Serves: index.html
         ↓
React Router loads
         ↓
Renders: ArtistDetail for "eagles"
         ↓
✅ PAGE LOADS!
```

---

## 📦 **What's in Your Build**

```
dist/
├── index.html           ✅ Main file
├── vercel.json          ✅ Vercel SPA config
├── _redirects           ✅ Generic SPA config
├── index.css            ✅ Styles
└── assets/
    ├── main-*.css       ✅ Compiled styles
    └── main-*.js        ✅ App bundle
```

**All files ready!** Just needs deployment.

---

## 🚀 **DEPLOY NOW**

```bash
# Make sure you're in the project directory
cd /Users/seth/convex-app

# Deploy everything
npm run all
```

**OR if Vercel CLI not set up**:

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project (first time only)
vercel link

# Deploy
vercel --prod
```

---

## 🧪 **Verification After Deploy**

### **1. Check Deployment URL**:
Vercel will output:
```
✅ Deployed to: https://setlists-live-xxx.vercel.app
```

### **2. Test SPA Routing**:
```
Visit: https://your-deployment.vercel.app/artists/eagles
Result: ✅ Should load artist page (not 404)
```

### **3. Test with Custom Domain** (if configured):
```
Visit: https://setlists.live/artists/eagles
Result: ✅ Should load (after DNS propagates)
```

---

## 🎯 **Quick Checklist**

- [x] vercel.json simplified (no conflicts)
- [x] _redirects file created
- [x] Build successful
- [x] dist/ folder ready
- [ ] **DEPLOY TO VERCEL** ← YOU ARE HERE
- [ ] Test direct URLs
- [ ] Configure domain (if using setlists.live)

---

## 🚨 **CRITICAL NEXT STEP**

**YOU MUST DEPLOY TO VERCEL NOW!**

```bash
npm run all
```

**The 404 error will persist until you deploy the new configuration to Vercel.**

---

## 📞 **If Deploy Fails**

### **"vercel: command not found"**:
```bash
npm install -g vercel
```

### **"No existing credentials found"**:
```bash
vercel login
```

### **"No such project"**:
```bash
vercel link
# Then: vercel --prod
```

---

## ✅ **After Successful Deploy**

You'll see:
```
✅ Deployed
✅ Production: https://your-app.vercel.app
✅ Inspecting deployment...
```

**Then test**:
- Visit the URL Vercel provides
- Paste `/artists/eagles` path
- Should work! No 404!

---

## 🎉 **Summary**

**Problem**: 404 on direct URL access  
**Cause**: Not deployed to Vercel yet  
**Fix**: Configuration ready, just needs deployment  
**Action**: Run `npm run all` NOW  

**Your app will work perfectly after deployment!** 🚀
