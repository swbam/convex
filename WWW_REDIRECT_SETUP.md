# 🌐 WWW Redirect - Canonical Domain Setup

## ✅ **Already Configured!**

I've set up an automatic redirect: `www.setlists.live` → `setlists.live`

---

## 🎯 **Best Practice**

Modern apps use the **non-www version** as canonical:
- ✅ Cleaner: `setlists.live` (not `www.setlists.live`)
- ✅ Shorter URLs
- ✅ Better for sharing
- ✅ Industry standard (like spotify.com, netflix.com, etc.)

---

## 🔧 **What I Configured**

### **In `vercel.json`**:

```json
"redirects": [
  {
    "source": "https://www.setlists.live/:path*",
    "destination": "https://setlists.live/:path*",
    "permanent": true
  }
]
```

**What this does**:
```
User visits: https://www.setlists.live/artists/taylor-swift
              ↓
Vercel redirects (301 permanent):
              ↓
User lands at: https://setlists.live/artists/taylor-swift
```

**Benefits**:
- ✅ **SEO**: Search engines know the canonical URL
- ✅ **Analytics**: All traffic counted under one domain
- ✅ **Branding**: Consistent domain everywhere
- ✅ **Automatic**: Users don't need to remember which version to use

---

## 📊 **How It Works**

```
┌──────────────────────────────────────────┐
│  User visits www.setlists.live           │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  Vercel receives request                 │
│  Checks redirects in vercel.json         │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  Matches: www.setlists.live/:path*       │
│  301 Redirect to: setlists.live/:path*   │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  Browser navigates to setlists.live      │
│  URL bar updates automatically           │
└──────────────────────────────────────────┘
```

---

## 🔍 **Code References**

I checked the entire codebase - **NO hardcoded `www` references found!**

All URLs in code use:
- ✅ `setlists.live` (without www)
- ✅ Relative URLs (`/artists/...`)
- ✅ Dynamic URLs (`window.location.href`)

Perfect! ✅

---

## 🌐 **DNS Configuration** (Vercel Dashboard)

To make both work, configure DNS in Vercel:

### **Custom Domain Setup**:

1. **Go to Vercel Dashboard** → Your Project → Settings → Domains

2. **Add BOTH domains**:
   ```
   setlists.live       ← Primary (canonical)
   www.setlists.live   ← Alias (redirects to primary)
   ```

3. **Vercel will automatically**:
   - Set up SSL certificates for both
   - Apply the redirect from www → non-www
   - Handle DNS configuration

### **DNS Records** (At your domain registrar):

```
Type    Name    Value
A       @       76.76.21.21        (Vercel's IP)
CNAME   www     cname.vercel-dns.com
```

---

## 📋 **What Users Experience**

### **Scenario 1**: User types `www.setlists.live`
```
1. Browser loads: www.setlists.live
2. Vercel returns: 301 redirect to setlists.live
3. Browser navigates to: setlists.live
4. URL bar shows: setlists.live ✅
```

### **Scenario 2**: User shares link
```
User copies: https://setlists.live/artists/taylor-swift
Friend pastes: (same URL)
Result: Works perfectly ✅
```

### **Scenario 3**: Old bookmark with www
```
User's old bookmark: https://www.setlists.live/shows/some-show
Clicks bookmark
Redirects to: https://setlists.live/shows/some-show ✅
```

---

## ✅ **Status**

| Aspect | Status |
|--------|--------|
| Redirect configured in vercel.json | ✅ YES |
| Non-www as canonical | ✅ YES |
| Hardcoded www references | ✅ NONE (checked all files) |
| SEO canonical tags | ✅ YES (in SEOHead component) |
| 301 permanent redirect | ✅ YES |

---

## 🎯 **Summary**

**Question**: Should www be removed?  
**Answer**: ✅ **Already handled!**

**How**:
- Automatic 301 redirect: `www.setlists.live` → `setlists.live`
- Configured in `vercel.json`
- No code changes needed
- Works for all paths

**Users will see**: `setlists.live` (clean, no www) ✅

**Next step**: Deploy with `npm run all` and the redirect will be live!

---

## 🚀 **Deploy**

```bash
npm run all
```

After deployment:
- ✅ `setlists.live` - Primary domain (works)
- ✅ `www.setlists.live` - Auto-redirects to primary
- ✅ All URLs clean and consistent
- ✅ SEO-friendly canonical URLs

**Your domain is perfectly configured!** 🎉
