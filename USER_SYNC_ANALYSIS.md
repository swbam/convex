# 🔍 User Sync Analysis - Clerk ↔ Convex Mismatch

## Problem Identified

There are **THREE different ways** users get created in Convex, and they don't all create the same fields!

---

## 🔴 Current User Creation Paths

### **Path 1: Webhook (`upsertFromClerk`)** 
**File**: `convex/users.ts:175`
**Trigger**: When Clerk sends webhook after sign-up

**Fields Created**:
```typescript
{
  authId: id,                    // ✅ Clerk user ID
  email,                         // ✅ Email
  name,                          // ✅ Full name
  username,                      // ✅ Generated username
  avatar,                        // ✅ Image URL
  spotifyId,                     // ✅ Spotify ID (if OAuth)
  role,                          // ✅ user/admin
  createdAt: Date.now(),         // ✅ Timestamp
  // ❌ MISSING: preferences
}
```

### **Path 2: AuthGuard (`ensureUserExists`)**
**File**: `convex/auth.ts:134`
**Trigger**: When user logs in but doesn't exist in Convex

**Fields Created**:
```typescript
{
  authId: identity.subject,      // ✅ Clerk user ID
  email,                         // ✅ Email
  name,                          // ✅ Full name
  username,                      // ✅ Generated username
  role,                          // ✅ user/admin
  preferences: {                 // ✅ Preferences object
    emailNotifications: true,
    favoriteGenres: [],
  },
  createdAt: Date.now(),         // ✅ Timestamp
  // ❌ MISSING: avatar, spotifyId
}
```

### **Path 3: Manual (`createManualUser`)**
**File**: `convex/users.ts:325`
**Trigger**: Admin creates user manually

**Fields Created**:
```typescript
{
  authId: `manual_${...}`,       // ✅ Fake auth ID
  email,                         // ✅ Email
  name,                          // ✅ Full name  
  username,                      // ✅ From email
  role,                          // ✅ user/admin
  preferences: {                 // ✅ Preferences object
    emailNotifications: true,
    favoriteGenres: [],
  },
  createdAt: Date.now(),         // ✅ Timestamp
  // ❌ MISSING: avatar, spotifyId
}
```

---

## 🔴 THE MISMATCH

### **Inconsistency Issues**:

1. ❌ **Webhook doesn't create `preferences`** → Breaks queries expecting it
2. ❌ **AuthGuard doesn't save `avatar`** → Users lose profile pics
3. ❌ **AuthGuard doesn't save `spotifyId`** → Spotify connection lost
4. ❌ **Different field combinations** → Schema inconsistency

---

## 🎯 The Race Condition

```
User Signs Up with Spotify OAuth
         ↓
    (2 things happen simultaneously)
         ↓
    ┌────────────────┐          ┌──────────────────┐
    │ Clerk Webhook  │          │   AuthGuard      │
    │ (async)        │          │   (immediate)    │
    └────────────────┘          └──────────────────┘
         ↓                              ↓
    Creates user                   Creates user
    WITH spotifyId                 WITHOUT spotifyId
    WITHOUT preferences            WITH preferences
         ↓                              ↓
         └──────────────┬───────────────┘
                        ↓
              ❌ DATA CONFLICT!
              
    Which one wins? It's random!
```

---

## ✅ THE FIX

All user creation paths must create the **same complete user object**.

### **Standard User Schema** (What EVERY path should create):

```typescript
{
  authId: string,              // Clerk user ID or manual ID
  email: string,               // Email address
  name: string,                // Full name
  username: string,            // Unique username
  avatar?: string,             // Profile picture URL
  spotifyId?: string,          // Spotify user ID (if connected)
  role: "user" | "admin",      // User role
  preferences: {               // User preferences
    emailNotifications: boolean,
    favoriteGenres: string[],
  },
  createdAt: number,           // Creation timestamp
}
```

---

## 🔧 Fields to Add

### **To Webhook (`upsertFromClerk`)**:
```typescript
// ADD THIS:
preferences: user?.preferences || {
  emailNotifications: true,
  favoriteGenres: [],
}
```

### **To AuthGuard (`ensureUserExists`)**:
```typescript
// ADD THIS:
avatar: identity.pictureUrl || identity.imageUrl,
spotifyId: extractSpotifyId(identity),
```

### **To Manual Creation**:
```typescript
// Already has preferences ✅
// ADD THIS:
avatar: undefined,
spotifyId: undefined,
```

---

## 🎯 Priority Fix

The **webhook path** is most critical because:
1. It's the primary user creation method
2. It handles OAuth (Spotify/Google)
3. It runs first (before AuthGuard)

**Missing `preferences` field breaks existing code that expects it!**

---

## 📊 Schema Validation

Check `convex/schema.ts` for the users table:

```typescript
users: defineTable({
  authId: v.string(),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  username: v.string(),
  avatar: v.optional(v.string()),         // ← Optional
  spotifyId: v.optional(v.string()),      // ← Optional
  role: v.union(v.literal("user"), v.literal("admin")),
  preferences: v.optional(v.object({      // ← Optional but...
    emailNotifications: v.boolean(),
    favoriteGenres: v.array(v.string()),
  })),
  createdAt: v.number(),
})
```

**Issue**: `preferences` is marked optional but code assumes it exists!

---

## 🚨 Potential Bugs From Mismatch

1. **Spotify Connection Lost**: 
   - User signs up with Spotify OAuth
   - AuthGuard runs first (no spotifyId)
   - Webhook updates later (has spotifyId)
   - Race condition!

2. **Missing Preferences**:
   - Webhook creates user (no preferences)
   - Code tries to access `user.preferences.emailNotifications`
   - ❌ Error: Cannot read property of undefined

3. **Avatar Not Saved**:
   - User has profile pic in Clerk
   - AuthGuard creates without avatar
   - UI shows no profile pic

---

## ✅ Solution Status

I'll fix all three user creation paths to be consistent!

