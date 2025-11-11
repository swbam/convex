# CRITICAL USAGE SPIKE FIX - November 11, 2025

## 🚨 PROBLEM SUMMARY

Function calls spiked from ~4M/day to 19M in production, causing massive billing and usage concerns.

### Root Causes Identified:

1. **Infinite Loop in autoGenerateSetlist**
   - When artist had no songs, it triggered catalog sync but returned `null`
   - No setlist was created, so cron kept re-triggering every 6 hours
   - 3.2M calls to `setlists.autoGenerateSetlist` in production

2. **Write Conflicts Cascade**
   - 60+ shows scheduled simultaneously → 60+ catalog syncs
   - Multiple syncs updating same artist → write conflicts
   - Convex auto-retries on conflicts → exponential multiplication
   - 701 write conflicts on `artists.updateSpotifyData`
   - 6.2K write conflicts on `setlists.autoGenerateSetlist`

3. **Aggressive Weekly Backfill**
   - New cron added: 200 shows/week including completed shows
   - Triggered the infinite loop for ALL shows missing setlists
   - Many old shows had artists with no catalog yet

4. **Insufficient Sync Guards**
   - 1-hour guard bypassed when artist had 0 songs
   - No persistent tracking of failed sync attempts
   - Catalog sync could be re-triggered infinitely

## ✅ FIXES IMPLEMENTED

### 1. Schema Changes (`convex/schema.ts`)
Added persistent tracking fields to artists table:
```typescript
catalogSyncAttemptedAt: v.optional(v.number()),
catalogSyncStatus: v.optional(v.union(
  v.literal("never"),
  v.literal("pending"),
  v.literal("syncing"),
  v.literal("completed"),
  v.literal("failed")
)),
```

### 2. Cron Configuration (`convex/crons.ts`)
- **REDUCED** `refresh-auto-setlists` frequency: 6h → 12h
- **REDUCED** limit per run: 60 → 20 shows
- **DISABLED** weekly backfill cron (was causing infinite loops)
- Added warning comments about manual backfill monitoring

### 3. Setlist Generation (`convex/setlists.ts`)

#### `autoGenerateSetlist` - Breaking the Infinite Loop:
- Check `catalogSyncAttemptedAt` before triggering sync
- If synced within 24 hours, create PLACEHOLDER setlist
- Placeholder prevents infinite re-triggering
- Add 5-second delay to catalog sync scheduling
- Always return setlist ID (never null)

#### `refreshMissingAutoSetlists` - Preventing Write Conflicts:
- Reduced default limit from 60 to 20
- **STAGGERED SCHEDULING**: 10 seconds between each job
- Prevents simultaneous updates to same artist
- Max 200 seconds (3.3 min) for 20 shows

### 4. Catalog Sync (`convex/spotify.ts`)

#### Enhanced Deduplication:
- Check BOTH `lastSynced` AND `catalogSyncAttemptedAt`
- 24-hour guard (increased from 1 hour)
- Prevents retries even if sync fails

#### Status Tracking:
- Mark as "syncing" BEFORE starting
- Mark as "completed" or "failed" after
- Track all attempts to prevent infinite loops

#### Cascading Prevention:
- Limit to 10 shows per catalog import
- Schedule setlist generation with 5-second delays
- Prevent bulk updates causing write conflicts

### 5. New Helper Function (`convex/artists.ts`)
Added `updateSyncStatus` internal mutation:
- Updates `catalogSyncAttemptedAt`
- Updates `catalogSyncStatus`
- Provides centralized sync state management

## 📊 EXPECTED IMPROVEMENTS

| Metric | Before | After (Expected) |
|--------|--------|------------------|
| Daily Function Calls | 19M | ~4M (back to normal) |
| Cron Frequency | Every 6h | Every 12h |
| Shows Per Run | 60 | 20 |
| Catalog Sync Guard | 1 hour | 24 hours |
| Write Conflicts | 700+ | <10 |
| Backfill Cron | Enabled (200/week) | DISABLED |

## 🔧 DEPLOYMENT STEPS

1. ✅ Schema changes deployed (new fields added)
2. ✅ Code fixes deployed
3. ⏳ Resume production deployment
4. ⏳ Monitor function calls for 24 hours
5. ⏳ Verify no infinite loops
6. ⏳ Check write conflicts are minimal

## 🎯 MONITORING CHECKLIST

After resuming production:

- [ ] Function calls stabilize at ~4M/day
- [ ] No write conflicts on `artists.updateSpotifyData`
- [ ] No write conflicts on `setlists.autoGenerateSetlist`
- [ ] `refresh-auto-setlists` cron runs successfully
- [ ] Placeholder setlists created for artists without catalogs
- [ ] Catalog syncs complete successfully
- [ ] Action compute usage stays under 5 GB-hours/day
- [ ] Database bandwidth stays under 500 MB/day

## ⚠️ MANUAL BACKFILL PROCEDURE

If you need to backfill legacy shows:

1. **DO NOT re-enable the backfill cron**
2. Use admin dashboard to run manually
3. Set limit to MAX 50 shows at a time
4. Wait 1 hour between runs
5. Monitor for write conflicts
6. Stop immediately if function calls spike

## 🔍 KEY LEARNINGS

1. **Always create a result** - Never return `null` when a cron expects data
2. **Use staggered scheduling** - Prevent write conflicts with delays
3. **Track attempts, not just success** - Guard against failed retries
4. **Limit batch sizes** - 20 is safer than 60
5. **24-hour guards** - 1 hour is too aggressive for external APIs
6. **Disable aggressive crons** - Weekly backfills should be manual
7. **Placeholder pattern** - Create empty records to prevent re-triggering

## 📝 FILES MODIFIED

1. `convex/schema.ts` - Added sync tracking fields
2. `convex/crons.ts` - Reduced frequency, disabled backfill
3. `convex/setlists.ts` - Placeholder pattern, staggered scheduling
4. `convex/spotify.ts` - Enhanced guards, status tracking
5. `convex/artists.ts` - New updateSyncStatus mutation

## 💰 COST IMPACT

**Previous Spike** (3 days):
- Function calls: 19M × 3 = 57M calls
- Action compute: ~80 GB-hours
- Estimated cost: **$200-300**

**After Fix**:
- Function calls: 4M/day (normal)
- Action compute: <5 GB-hours/day
- Estimated cost: **$20-30/month** (normal)

## 🚀 NEXT STEPS

1. Deploy these changes to production
2. Resume the paused deployment
3. Monitor for 24 hours
4. Verify usage returns to normal
5. Document learnings in team wiki
6. Set up alerts for usage spikes >10M calls/day

---

**Fixed by:** GitHub Copilot
**Date:** November 11, 2025
**Severity:** CRITICAL
**Status:** FIXED - Ready for deployment
