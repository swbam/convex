# 🔑 Clerk JWT Template - Step-by-Step Guide

## ⚠️ Issue: "You can't use the reserved claim: sub"

**Solution**: `sub` is a **reserved claim** that Clerk adds automatically. Don't add it manually!

---

## ✅ Correct JWT Template Setup

### **Step 1: Access JWT Templates**
```
1. Go to: https://dashboard.clerk.com
2. Select your application
3. Navigate to: Configure → JWT Templates
4. Click "New template" or edit existing "convex" template
```

### **Step 2: Basic Configuration**
```
Field: Name
Value: convex
Note: MUST be exactly "convex" (lowercase, no spaces)
```

```
Field: Lifetime
Value: 3600
Note: This is in seconds (3600 = 1 hour)
```

### **Step 3: Claims Configuration**
```
Field: Claims
Value: {} 

⚠️ LEAVE EMPTY or use empty braces!

DO NOT ADD:
❌ "sub": "{{user.id}}"           ← Reserved claim
❌ "aud": "convex"                ← Use Audience field instead
❌ "iat": "{{timestamp}}"         ← Automatically added
❌ "exp": "{{expiration}}"        ← Automatically added
❌ "iss": "{{issuer}}"            ← Automatically added

YOU CAN ADD (examples):
✅ "role": "{{user.public_metadata.role}}"
✅ "email": "{{user.primary_email_address}}"
✅ Custom metadata from your Clerk user object
```

### **Step 4: Audience (Optional)**
```
Field: Audience
Value: Leave blank OR "convex"

Note: This sets the "aud" claim automatically
```

### **Step 5: Save**
```
Click "Apply changes" or "Save"
```

---

## 📋 What Clerk Includes Automatically

These claims are **always** included in every JWT:

| Claim | Description | Example Value |
|-------|-------------|---------------|
| `sub` | Subject (User ID) | `user_2a1b3c4d5e6f` |
| `iat` | Issued At (timestamp) | `1699564800` |
| `exp` | Expiration (timestamp) | `1699568400` |
| `iss` | Issuer URL | `https://your-app.clerk.accounts.dev` |
| `nbf` | Not Before (timestamp) | `1699564800` |
| `azp` | Authorized Party | Your app's client ID |
| `sid` | Session ID | `sess_2a1b3c4d5e6f` |

**You cannot override these!**

---

## ✅ Minimal Working JWT Template

```json
{
  "name": "convex",
  "lifetime": 3600,
  "claims": {},
  "audience": ""
}
```

That's it! Leave claims empty.

---

## 🎯 YOUR JWT Template Configuration (With All Custom Claims)

### **What to Put in Clerk Dashboard → JWT Templates → "convex"**:

**Name**: `convex`  
**Lifetime**: `3600`  
**Claims** (paste ONLY this into the Claims field):
```json
{
  "role": "{{user.public_metadata.role}}",
  "username": "{{user.username}}",
  "email": "{{user.primary_email_address}}",
  "plan": "{{user.public_metadata.subscription_plan}}"
}
```
**Audience**: Leave blank or type `convex`

### **⚠️ Important**: 
- Do NOT include `name`, `lifetime`, or `audience` in the Claims field!
- Those are separate fields in the form
- Only put the custom claims object in the "Claims" field

### **What You'll Get in Your JWT**:

```json
{
  "sub": "user_2a1b3c4d5e6f",        // ← Clerk adds (User ID)
  "iat": 1699564800,                  // ← Clerk adds (Issued at)
  "exp": 1699568400,                  // ← Clerk adds (Expires)
  "iss": "https://your-app.clerk...", // ← Clerk adds (Issuer)
  "role": "user",                     // ← Your custom claim
  "username": "john_doe",             // ← Your custom claim
  "email": "john@example.com",        // ← Your custom claim
  "plan": "pro"                       // ← Your custom claim (if set)
}
```

### **How to Access in Convex**:

```typescript
const identity = await ctx.auth.getUserIdentity();

// Standard Clerk claims
const userId = identity?.subject;        // User ID

// Your custom claims (now available!)
const role = identity?.role;             // "user", "admin", etc.
const username = identity?.username;     // "john_doe"
const email = identity?.email;           // "john@example.com"
const plan = identity?.plan;             // "pro", "free", etc.
```

---

## 🔍 Verify Your Template Works

### **Test 1: Sign In and Check Token**

1. Sign in to your app
2. Open browser DevTools → Console
3. Run:
   ```javascript
   // Get Clerk client
   window.Clerk.session.getToken({template: 'convex'})
     .then(token => {
       // Decode JWT (don't do this in production!)
       const payload = JSON.parse(atob(token.split('.')[1]));
       console.log('JWT Payload:', payload);
     });
   ```

4. **You should see**:
   ```json
   {
     "sub": "user_xxxxx",      ← User ID
     "iat": 1699564800,         ← Issued at
     "exp": 1699568400,         ← Expires at  
     "iss": "https://...",      ← Issuer
     "azp": "...",              ← Client ID
     "sid": "sess_..."          ← Session ID
   }
   ```

### **Test 2: Verify in Convex**

1. Go to Convex Dashboard → Logs
2. Sign in to your app
3. Look for logs showing JWT validation
4. Should see: `✅ JWT verified successfully`

---

## 🐛 Troubleshooting

### ❌ "Invalid JWT" error
**Causes**:
1. Template name is not "convex" (case-sensitive!)
2. CLERK_ISSUER_URL doesn't match Clerk domain
3. Template was created but not saved

**Solution**:
1. Double-check template name is `convex`
2. Verify `CLERK_ISSUER_URL` in convex/.env
3. Click "Apply changes" after editing template

### ❌ "Template not found" error
**Cause**: Template doesn't exist or wrong name

**Solution**:
1. Create new template named `convex`
2. Make sure you clicked "Save"
3. Redeploy Convex: `npx convex deploy`

### ❌ "Audience mismatch" error
**Cause**: JWT audience doesn't match auth.config.ts

**Solution**:
1. Check `auth.config.ts` has `applicationID: "convex"`
2. Leave audience blank in JWT template
3. Or set audience to `convex` in JWT template

---

## 📸 Visual Guide

### What Your JWT Template Should Look Like:

```
┌─────────────────────────────────────────────────┐
│ JWT Template: convex                           │
├─────────────────────────────────────────────────┤
│                                                 │
│ Name: convex                                    │
│                                                 │
│ Lifetime: 3600                                  │
│                                                 │
│ Claims:                                         │
│ ┌─────────────────────────────────────────┐    │
│ │ {}                                      │    │
│ │                                         │    │
│ │ (leave empty or add custom claims only) │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ Audience: [blank] or convex                    │
│                                                 │
│ [Apply Changes]                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Quick Fix Checklist

- [ ] Go to Clerk Dashboard → JWT Templates
- [ ] Find or create template named `convex`
- [ ] Set Lifetime to `3600`
- [ ] **Leave Claims EMPTY** or use `{}`
- [ ] Leave Audience blank (or set to `convex`)
- [ ] Click "Apply changes"
- [ ] Try signing in/up again

---

## 💡 Understanding Reserved vs Custom Claims

### **Reserved Claims** (Clerk adds automatically)
```
❌ NEVER add these manually:
   - sub (subject/user ID)
   - iat (issued at)
   - exp (expiration)
   - iss (issuer)
   - nbf (not before)
   - azp (authorized party)
   - sid (session ID)
```

### **Custom Claims** (You can add these)
```
✅ Safe to add:
   - role
   - username
   - email
   - plan
   - Any user.public_metadata fields
   - Any user.unsafe_metadata fields
```

---

## 🔗 How It All Connects

```
┌────────────────────────────────────────┐
│   Clerk JWT Template: "convex"        │
│   Claims: {} (empty)                   │
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│   src/main.tsx                         │
│   getToken({ template: "convex" })     │
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│   convex/auth.config.ts                │
│   applicationID: "convex"              │
└────────────────────────────────────────┘
              ↓
        ✅ AUTH WORKS!
```

---

## 📚 Official Clerk Documentation

- JWT Templates: https://clerk.com/docs/backend-requests/making/jwt-templates
- Reserved Claims: https://clerk.com/docs/backend-requests/making/jwt-templates#default-claims
- Convex Integration: https://docs.convex.dev/auth/clerk

---

**Updated**: November 7, 2025  
**Status**: ✅ Ready to use - Just leave JWT claims empty!
