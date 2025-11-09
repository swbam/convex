# Setlist Generation Fixes - Complete Implementation

## Problem Summary
Some show pages were not loading the initial 5-song random setlist. Root cause analysis revealed:
1. **Legacy shows** created before auto-generation was implemented
2. **Catalog sync failures** that left artists without songs
3. **One-hour sync guard** blocking retries for failed catalog imports
4. **Cron job** only scanning upcoming shows, missing completed/legacy shows

## Fixes Implemented

### Fix 1: Expand Cron Coverage for ALL Shows
**File**: `convex/setlists.ts`
- Added `includeCompleted` flag to `refreshMissingAutoSetlists`
- When true, scans ALL shows regardless of status (for legacy backfill)
- When false (default), only scans upcoming shows (normal behavior)

### Fix 2: Remove One-Hour Guard for Artists Without Songs
**File**: `convex/spotify.ts`
- Modified sync guard to check if artist has ANY songs before blocking
- Artists with zero songs can now re-sync immediately (bypasses 1-hour limit)
- Prevents permanent failures when catalog sync fails initially

**New Helper Added**: `convex/songs.ts`
- Added `getByArtistInternal` query to check artist song count

### Fix 3: Extended Retry Delays
**File**: `convex/shows.ts` (two locations)
- Extended retry schedule from 3 attempts to 5 attempts
- New delays: 10s, 1min, 5min, **15min (NEW)**, **30min (NEW)**
- Gives catalog sync more time to complete for large artist catalogs

### Fix 4: Diagnostic Tools
**New File**: `convex/diagnostics.ts`
- `findShowsWithoutSetlists`: Lists all shows missing setlists (with artist song counts)
- `findArtistsWithoutSongs`: Lists artists needing catalog re-sync
- `backfillMissingSetlists`: Public action to manually trigger backfill

**Admin Actions Added**: `convex/admin.ts`
- `backfillMissingSetlists`: Admin-authenticated backfill trigger
- `testBackfillMissingSetlists`: Test version without auth

### Fix 5: Weekly Backfill Cron
**File**: `convex/crons.ts`
- Added weekly cron job `backfill-legacy-setlists`
- Runs every 7 days with `includeCompleted: true`
- Scans 200 shows per run to catch legacy/completed shows

### Fix 6: Test Coverage
**New File**: `tests/setlistGeneration.spec.ts`
- Tests for diagnostic queries
- Tests for backfill functionality
- Validates setlist refresh operations

## How to Fix Existing Data

### Option 1: Surgical Fix (RECOMMENDED)
Run the backfill action to fix only missing setlists without clearing data:

```bash
# In Convex dashboard or via CLI:
npx convex run admin:testBackfillMissingSetlists '{"limit": 500}'
```

This will:
- Scan up to 500 shows (all statuses)
- Generate setlists for shows missing them
- Trigger catalog imports for artists without songs
- Preserve all existing user data (votes, setlists, activity)

### Option 2: Full DB Clear (DEV ONLY - DESTRUCTIVE)
Only use if you're in development and want a fresh start:

1. Export data from Convex dashboard (backup)
2. Run the nuke function (if added to admin.ts)
3. Re-import artists via Ticketmaster sync
4. Wait for automatic catalog/show syncs

## Prevention Mechanisms

### Automatic Recovery
1. **Immediate retries**: 5 attempts at 10s, 1min, 5min, 15min, 30min
2. **6-hour cron**: Scans upcoming shows for missing setlists
3. **Weekly backfill**: Scans ALL shows (including legacy/completed)
4. **Catalog auto-trigger**: If no songs found, schedules catalog import

### Monitoring
- Check `diagnostics:findShowsWithoutSetlists` periodically
- Review `diagnostics:findArtistsWithoutSongs` for sync failures
- Admin dashboard shows system health

## Testing

### Unit Tests
```bash
npm run test:run
```
All tests pass ✅

### Manual Testing
1. Create a new artist (via Ticketmaster search)
2. Verify show is created with initial setlist
3. Check logs for retry messages
4. Verify cron jobs are scheduled in Convex dashboard

### Integration Tests
Run with `ENABLE_CONVEX_RUN=true`:
```bash
ENABLE_CONVEX_RUN=true npm test
```

## Verification Checklist

- [x] Code compiles without errors (`npx convex deploy --dry-run`)
- [x] Unit tests pass (`npm run test:run`)
- [x] New diagnostic tools added (`diagnostics.ts`)
- [x] Backfill action available for admin (`admin.ts`)
- [x] Cron job scheduled for weekly backfill (`crons.ts`)
- [x] One-hour guard bypassed for empty catalogs (`spotify.ts`)
- [x] Extended retry delays (15min, 30min) added (`shows.ts`)
- [x] All changes preserve user data (no breaking changes)

## Next Steps

1. **Deploy changes**: `npm run deploy:backend`
2. **Run backfill once**: `npx convex run admin:testBackfillMissingSetlists '{"limit": 500}'`
3. **Monitor logs**: Check Convex dashboard for success/failure messages
4. **Verify show pages**: Visit shows that previously had no setlists

## Impact

- **No data loss**: All existing setlists, votes, users preserved
- **Backward compatible**: Legacy shows will be fixed by weekly cron
- **Forward compatible**: New shows auto-generate with extended retries
- **Performance**: Minimal overhead (cron runs weekly, retries are throttled)

## Success Metrics

After deploying and running backfill:
- 95%+ of upcoming shows should have prediction setlists
- Artists with catalog sync failures will auto-retry
- Weekly cron ensures no shows are left behind
- Extended retries handle slow catalog imports (large artists)

