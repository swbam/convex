# 🚨 CRITICAL FIXES REQUIRED

## 1. **CLERK PUBLISHABLE KEY IS INCOMPLETE** ❌

**Current Value:**
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuc2V0bGlzdHMubGl2ZSQ
```

**Problem:** The key is truncated and ends with `$` - this is incomplete!

**Fix Required:**
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your "setlists.live" application
3. Go to **API Keys**
4. Copy the **FULL** Publishable Key (starts with `pk_live_...`)
5. Update `.env`:
   ```bash
   VITE_CLERK_PUBLISHABLE_KEY=<PASTE_COMPLETE_KEY_HERE>
   ```
6. Restart your dev server

**Why This Breaks:**
- Clerk cannot initialize with an invalid key
- All authentication fails with "Authentication not ready"
- Sign-up and sign-in are completely broken

---

## 2. **TRENDING DATA - ONLY TAYLOR SWIFT** ⚠️

**Problem:** Database has no trending data populated yet.

**Fix Required:**
Run the trending sync manually:

```typescript
// Option A: Use Convex CLI
npx convex run admin:syncTrending

// Option B: Use Admin Dashboard
1. Navigate to /admin in browser
2. Click "Update Trending Data" button
3. Wait 10-30 seconds
4. Refresh homepage
```

**Alternative Manual Fix:**
```bash
# Run this in terminal
npx convex run maintenance:syncTrendingData
```

---

## 3. **MOBILE CARD LAYOUT - TOO TALL** 📱

**Problem:** Artist/show cards on mobile are full-height and waste space.

**Fix Required:** Update card components to use horizontal layout on mobile:
- Image on left (small square)
- Details on right
- Similar to Spotify mobile UI

Files to modify:
- `src/components/ArtistCard.tsx`
- `src/components/ShowCard.tsx`
- `src/components/TrendingArtists.tsx`

**Expected Layout:**
```
┌──────────────────────┐
│ [img] Artist Name    │
│       Genre          │
│       X Shows        │
└──────────────────────┘
```

Instead of current:
```
┌──────────────────────┐
│                      │
│      [big img]       │
│                      │
│    Artist Name       │
│      Genre           │
│     X Shows          │
│                      │
└──────────────────────┘
```

---

## 4. **ADDITIONAL CHECKS NEEDED** ⚙️

### Verify Clerk JWT Configuration
Check `convex/auth.config.ts`:
```typescript
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ]
};
```

**Required:**
- `CLERK_JWT_ISSUER_DOMAIN` must match your Clerk dashboard exactly
- Format: `https://clerk.setlists.live` or `https://your-subdomain.clerk.accounts.dev`

### Verify Clerk Webhook
1. Go to Clerk Dashboard → Webhooks
2. Create webhook pointing to: `https://exuberant-weasel-22.convex.site/clerk-users-webhook`
3. Events to listen for:
   - `user.created`
   - `user.updated`  
   - `user.deleted`
4. Copy signing secret
5. Update `.env`:
   ```
   CLERK_WEBHOOK_SECRET=whsec_<your_secret>
   ```

---

## 🎯 PRIORITY ORDER

### **URGENT (Do Now):**
1. ✅ Fix Clerk publishable key (breaks all auth)
2. ✅ Restart dev server after fixing key
3. ✅ Test sign-up flow

### **HIGH (Do Today):**
4. ✅ Run trending data sync
5. ✅ Fix mobile card layout
6. ✅ Verify Clerk JWT issuer domain

### **MEDIUM (This Week):**
7. ✅ Set up Clerk webhook
8. ✅ Test OAuth flows (Google, Spotify)
9. ✅ Monitor Convex logs for errors

---

## 📝 VERIFICATION CHECKLIST

After fixes, verify:
- [ ] Sign-up with email works (no "not ready" error)
- [ ] Sign-in with email works
- [ ] Homepage shows 20+ trending artists
- [ ] Homepage shows 20+ trending shows
- [ ] Mobile cards are compact and horizontal
- [ ] Admin dashboard accessible
- [ ] Clerk webhook receiving events

---

## 🔍 HOW TO GET CORRECT CLERK KEY

1. Go to https://dashboard.clerk.com
2. Select your application ("setlists.live")
3. Navigate to **API Keys** in sidebar
4. Under "Publishable keys" section
5. Look for **"Publishable key (Recommended)"**
6. Copy the ENTIRE key (should be ~100+ characters)
7. Key format: `pk_live_` followed by long base64 string

**Example of COMPLETE key:**
```
pk_live_Y2xlcmsuc2V0bGlzdHMubGl2ZSQyNzQ5NGU2Ny1lNmUyLTQ1YjYtODNkMy0xYjJiM2Y0ZDVlNmY
```
(Note: Yours will be different and likely longer)

---

## 🚀 AFTER FIXES

Once all fixes are complete, the app should:
- ✅ Allow sign-ups without errors
- ✅ Show diverse trending artists
- ✅ Show upcoming trending shows  
- ✅ Have clean mobile UI
- ✅ Be production-ready

---

Generated: 2025-10-03 2:06 PM CT
Status: CRITICAL FIXES REQUIRED ⚠️
