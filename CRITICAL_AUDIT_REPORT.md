# 🚨 CRITICAL AUDIT REPORT: Concert Setlist Voting App
**Date:** 2025-11-11  
**Deployment:** prod:exuberant-weasel-22  
**Status:** CRITICAL USAGE SPIKE - 19M Function Calls

---

## 📊 EXECUTIVE SUMMARY

**Incident:** Function call spike from normal levels to 19M calls over 3 days (Nov 8-11)
- **Function Calls:** 19M (normal: <100K/day)
- **Action Compute:** 80 GB-hours (massive spike from Nov 8)
- **Database Storage:** 103.35 MB (stable)
- **Cost Impact:** HIGH - deployment was paused to prevent runaway costs

**Root Cause:** Infinite loop cascade in Spotify catalog sync → auto-setlist generation system

---

## 🔴 CRITICAL ISSUES IDENTIFIED

### 1. INFINITE LOOP CASCADE (PRIMARY ROOT CAUSE)

**Evidence from Function Breakdown:**
```
spotify:syncArtistCatalog     → 2.8M calls (PROD)
setlists:autoGenerateSetlist  → 3.2M calls (PROD)  
artists:getByIdInternal       → 2.8M calls (PROD)
songs:getByArtistInternal     → 2.8M calls (PROD)
setlists:getByShow            → 2.8M calls (PROD)
```

**The Infinite Loop Pattern:**
```
1. Cron: refreshMissingAutoSetlists (every 12hrs, limit 20 shows)
   ↓
2. For each show → autoGenerateSetlist
   ↓
3. No songs found → schedules syncArtistCatalog
   ↓
4. syncArtistCatalog completes → auto-generates setlists for artist's other shows (lines 401-425)
   ↓
5. Those setlists ALSO have no songs → schedule MORE catalog syncs
   ↓
6. CASCADE EXPLOSION (exponential growth)
```

**Code Locations:**
- [`convex/setlists.ts:414-527`](convex/setlists.ts:414) - `autoGenerateSetlist` schedules catalog sync
- [`convex/spotify.ts:401-436`](convex/spotify.ts:401) - Post-sync auto-setlist generation (THE TRIGGER)
- [`convex/setlists.ts:819-886`](convex/setlists.ts:819) - Cron batch processor

**Partial Fixes Already Applied (BUT INCOMPLETE):**
- ✅ 24-hour guard on `catalogSyncAttemptedAt` (line 446)
- ✅ Staggered delays (10s between jobs, line 867)
- ✅ Reduced batch size from 60 to 20 (line 828)
- ❌ **STILL BROKEN:** Post-sync setlist generation triggers new syncs (line 401-425)

---

### 2. WRITE CONFLICTS (SECONDARY ISSUE)

**Evidence from Health Tab:**
```
artists:updateSpotifyData     → 701 write conflicts in table 'artists'
setlists:autoGenerateSetlist  → 6.2K write conflicts in table 'artists'
```

**Cause:**
- Multiple simultaneous updates to same artist record
- Catalog sync updates artist metadata
- Setlist generation checks/updates artist sync status
- Insufficient serialization of artist updates

**Location:** 
- [`convex/artists.ts:418-452`](convex/artists.ts:418) - `updateSpotifyData`
- [`convex/setlists.ts:476-481`](convex/setlists.ts:476) - Concurrent artist patches

---

### 3. EMPTY CRITICAL TABLES

**Tables with 0 records (should have data):**

| Table | Expected | Actual | Impact |
|-------|----------|--------|--------|
| `activity` | User actions logged | EMPTY | Activity feed not working |
| `syncStatus` | Global sync state | EMPTY | No sync coordination |
| `syncJobs` | Queued sync operations | EMPTY | Queue system not in use |

**Code References:**
- [`convex/schema.ts:291-297`](convex/schema.ts:291) - Activity table defined
- [`convex/schema.ts:310-314`](convex/schema.ts:310) - SyncStatus table defined  
- [`convex/schema.ts:316-350`](convex/schema.ts:316) - SyncJobs table defined

**Issues:**
1. Activity logging not implemented (no insertions found)
2. SyncStatus should have at least 1 global record
3. SyncJobs queue system appears unused despite being in schema

---

### 4. CRON JOB ANALYSIS

**Current Configuration ([`convex/crons.ts`](convex/crons.ts)):**

| Job | Frequency | Limit | Status |
|-----|-----------|-------|--------|
| `update-trending` | 4 hours | - | ✅ OPTIMAL |
| `check-completed-shows` | 2 hours | - | ✅ OPTIMAL |
| `daily-cleanup` | 24 hours | - | ✅ OPTIMAL |
| `setlistfm-scan` | 30 minutes | - | ✅ OPTIMAL |
| `sync-engagement-counts` | 1 hour | - | ✅ OPTIMAL |
| `update-artist-show-counts` | 2 hours | - | ✅ OPTIMAL |
| `update-artist-trending` | 4 hours | - | ✅ OPTIMAL |
| `update-show-trending` | 4 hours | - | ✅ OPTIMAL |
| `auto-transition-shows` | 2 hours | - | ✅ OPTIMAL |
| `populate-missing-fields` | 1 hour | - | ✅ OPTIMAL |
| `spotify-refresh` | 12 hours | - | ✅ OPTIMAL |
| `refresh-auto-setlists` | 12 hours | 20 | ⚠️ REDUCED (was 60) |

**Assessment:** Cron frequencies are well-optimized. The issue is in the cascade triggered by individual cron executions, not the frequency itself.

---

## 🔐 AUTHENTICATION STATUS

### Clerk Auth (Primary)
**Configuration:** [`convex/auth.config.ts`](convex/auth.config.ts)
```typescript
domain: clerk.setlists.live
applicationID: "convex"
```
**Status:** ✅ CONFIGURED CORRECTLY
**Environment Variables Required:**
- `CLERK_JWT_ISSUER_DOMAIN` or `CLERK_ISSUER_URL`

### Spotify OAuth
**Configuration:** [`convex/spotifyAuth.ts`](convex/spotifyAuth.ts)
- ✅ Token encryption implemented (AES-256-GCM)
- ✅ Token refresh cron (12 hours)
- ✅ User artist import working
**Environment Variables Required:**
- `SPOTIFY_CLIENT_ID` ✅ (referenced in code)
- `SPOTIFY_CLIENT_SECRET` ✅ (referenced in code)
- `SPOTIFY_TOKEN_ENC_KEY` ✅ (for encryption)

**Status:** ✅ FULLY IMPLEMENTED

### Google OAuth
**Configuration:** ❌ NOT FOUND
- No Google provider in [`auth.config.ts`](convex/auth.config.ts)
- No Google OAuth implementation files
- User schema has `googleId` field ([`schema.ts:19`](convex/schema.ts:19))

**Status:** ⚠️ INCOMPLETE
**Action Required:** 
1. Verify if Google SSO is enabled in Clerk dashboard
2. If yes, it works through Clerk (no additional config needed)
3. If no, add Google provider to Clerk settings

---

## 📋 DETAILED FINDINGS BY COMPONENT

### Setlists System ([`convex/setlists.ts`](convex/setlists.ts))

**Function: `autoGenerateSetlist` (lines 414-613)**
❌ **CRITICAL BUG:**
```typescript
// Lines 484-505: Schedules catalog sync without proper loop prevention
void ctx.scheduler.runAfter(5000, internal.spotify.syncArtistCatalog, {
  artistId: args.artistId,
  artistName: artist.name,
});
```
**Issue:** Creates placeholder setlist but catalog sync can re-trigger more setlists

**Function: `refreshMissingAutoSetlists` (lines 819-886)**
✅ **PARTIALLY FIXED:**
- Reduced batch size to 20
- Added staggered delays (10s each)
- But cascade still happens downstream

---

### Spotify Sync ([`convex/spotify.ts`](convex/spotify.ts))

**Function: `syncArtistCatalog` (lines 161-461)**
❌ **CRITICAL BUGS:**

1. **Post-sync auto-setlist generation (lines 401-425):**
```typescript
// After successful catalog import, auto-generate setlists
const artistShows = await ctx.runQuery(internal.shows.getAllByArtistInternal, { artistId });

for (let i = 0; i < showsNeedingSetlists.length; i++) {
  await ctx.scheduler.runAfter(i * 5000, internal.setlists.autoGenerateSetlist, {
    showId: show._id,
    artistId: args.artistId,
  });
}
```
**This triggers the cascade loop!**

2. **Deduplication relies on timestamps:**
```typescript
// Line 190: Check is good but timing-dependent
const recentlySynced = artist.lastSynced && (now - artist.lastSynced) < TWENTY_FOUR_HOURS;
const recentlyAttempted = artist.catalogSyncAttemptedAt && (now - artist.catalogSyncAttemptedAt) < TWENTY_FOUR_HOURS;
```
**Risk:** Race conditions if multiple syncs scheduled simultaneously

---

### Artists System ([`convex/artists.ts`](convex/artists.ts))

**Function: `updateSpotifyData` (lines 418-452)**
⚠️ **WRITE CONFLICT HOTSPOT:**
```typescript
await ctx.db.patch(args.artistId, updates);
```
**Issue:** High concurrency on same artist records

**Function: `createFromTicketmaster` (lines 265-371)**
✅ **PROPERLY FILTERS:**
```typescript
// Lines 276-298: Filters out festivals, theatrical shows, orchestras
const skipKeywords = ['festival', 'coachella', 'broadway', 'wicked', 'hamilton', ...];
```

---

## 🎯 REQUIRED FIXES (PRIORITY ORDER)

### PRIORITY 1: STOP THE CASCADE (IMMEDIATE)

**Fix 1.1:** Remove post-sync setlist generation from `spotify.ts`
```typescript
// DELETE OR COMMENT OUT lines 401-425 in convex/spotify.ts
// Let the cron job handle setlist generation separately
```

**Fix 1.2:** Add global catalog sync rate limiter
```typescript
// In convex/spotify.ts:syncArtistCatalog (before line 161)
// Add hard limit: 1 sync per artist per 24 hours, tracked in database
```

**Fix 1.3:** Add circuit breaker pattern
```typescript
// Track consecutive failures per artist
// If >3 failed attempts, backoff for 72 hours
```

---

### PRIORITY 2: FIX WRITE CONFLICTS

**Fix 2.1:** Serialize artist updates
```typescript
// In convex/artists.ts:updateSpotifyData
// Use transaction-like pattern or mutex
```

**Fix 2.2:** Batch artist updates
```typescript
// Collect multiple updates and apply once
// Reduce patch operations from 701 to <50
```

---

### PRIORITY 3: INITIALIZE EMPTY TABLES

**Fix 3.1:** Create global sync status record
```typescript
// Add migration to initialize syncStatus table
await ctx.db.insert("syncStatus", {
  isActive: false,
  currentPhase: "idle",
  lastSync: Date.now(),
});
```

**Fix 3.2:** Implement activity logging OR remove table
```typescript
// Either implement in relevant mutations
// Or remove from schema if not needed
```

**Fix 3.3:** Document syncJobs usage
```typescript
// If queue system is not in use, document why
// Or implement proper job queue
```

---

### PRIORITY 4: AUTH VERIFICATION

**Fix 4.1:** Verify Google OAuth in Clerk
- Check Clerk dashboard → Social Connections → Google
- If enabled, should work automatically
- If not enabled, enable it

**Fix 4.2:** Document OAuth providers
```typescript
// Add to README or .env.example
CLERK_JWT_ISSUER_DOMAIN=https://clerk.setlists.live
SPOTIFY_CLIENT_ID=<your-spotify-client-id>
SPOTIFY_CLIENT_SECRET=<your-spotify-client-secret>
SPOTIFY_TOKEN_ENC_KEY=<secure-random-key>
```

---

## 🔧 IMPLEMENTATION PLAN

### Phase 1: Emergency Stop (TODAY)
1. ✅ Deployment is paused (already done)
2. Apply Priority 1 fixes
3. Deploy and monitor for 24 hours
4. Verify function calls drop to <100K/day

### Phase 2: Stability (WEEK 1)
1. Apply Priority 2 fixes (write conflicts)
2. Apply Priority 3 fixes (empty tables)
3. Add comprehensive logging
4. Set up alerting for usage spikes

### Phase 3: Verification (WEEK 2)
1. Apply Priority 4 fixes (auth verification)  
2. Review all cron jobs
3. Load testing
4. Documentation updates

---

## 📈 SUCCESS METRICS

**Before Fix:**
- Function Calls: 19M over 3 days
- Action Compute: 80 GB-hours
- Write Conflicts: 7K+ errors
- Cost: Deployment paused

**After Fix (Target):**
- Function Calls: <100K/day
- Action Compute: <2 GB-hours/day
- Write Conflicts: <10/day
- Cost: Within budget limits

---

## 🔍 MONITORING CHECKLIST

Post-deployment, monitor these metrics hourly for 48 hours:

- [ ] `spotify:syncArtistCatalog` calls <100/hour
- [ ] `setlists:autoGenerateSetlist` calls <200/hour
- [ ] `artists:updateSpotifyData` write conflicts <5/hour
- [ ] Total function calls <5K/hour
- [ ] Action compute <0.1 GB-hours/hour
- [ ] Error logs for "infinite loop" patterns
- [ ] Artist catalog sync success rate >95%
- [ ] Setlist generation success rate >95%

---

## 📚 CODE REFERENCES

### Critical Files to Modify:
1. [`convex/spotify.ts`](convex/spotify.ts) - Remove lines 401-425, add rate limiting
2. [`convex/setlists.ts`](convex/setlists.ts) - Strengthen loop prevention
3. [`convex/artists.ts`](convex/artists.ts) - Serialize updates
4. [`convex/schema.ts`](convex/schema.ts) - Initialize empty tables

### Files Already Fixed (Partial):
1. [`convex/crons.ts`](convex/crons.ts) - Frequencies optimized
2. [`convex/setlists.ts:867`](convex/setlists.ts:867) - Staggered delays added

### Files to Review:
1. [`convex/auth.config.ts`](convex/auth.config.ts) - Verify Google OAuth
2. [`convex/http.ts`](convex/http.ts) - Check webhook handlers
3. [`convex/webhooks.ts`](convex/webhooks.ts) - Verify Clerk webhooks

---

## ⚠️ DEPLOYMENT WARNINGS

Before resuming deployment:
1. ✅ All Priority 1 fixes MUST be applied
2. ⚠️ Monitor closely for first 24 hours
3. 🚨 Set up cost alerts at $50, $100, $200 thresholds
4. 📊 Have rollback plan ready
5. 🔔 Enable function call spike alerts (>1K/minute)

---

## 🎓 LESSONS LEARNED

1. **Catalog sync should be fully decoupled from setlist generation**
2. **All scheduled operations need circuit breakers**
3. **24-hour guards are good but not sufficient for high-concurrency scenarios**
4. **Write conflicts indicate need for better serialization**
5. **Empty tables should be documented or removed**
6. **Real-time monitoring is critical for serverless applications**

---

## 📞 NEXT STEPS

**IMMEDIATE (TODAY):**
1. Review this audit with team
2. Prioritize fixes
3. Create fix branches
4. Test in development
5. Deploy Priority 1 fixes

**THIS WEEK:**
1. Implement Priority 2-3 fixes
2. Set up monitoring dashboard
3. Create runbook for similar incidents
4. Update documentation

**THIS MONTH:**
1. Complete auth verification
2. Load testing
3. Cost optimization review
4. Consider migration to dedicated queue system

---

**Report Generated:** 2025-11-11T22:55:00Z  
**Next Review:** After Priority 1 fixes deployed  
**Audit Status:** 🔴 CRITICAL - Deployment paused pending fixes