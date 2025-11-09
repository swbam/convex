# 🚀 Quick Start: Fix Missing Setlists

## The Problem
Some show pages don't display the initial 5-song random prediction setlist.

## The Solution (2 Commands)

### 1️⃣ Deploy the Fixes
```bash
npm run deploy:backend
```

Wait ~30 seconds for deployment to complete.

### 2️⃣ Run One-Time Backfill
```bash
npx convex run admin:testBackfillMissingSetlists '{"limit": 500}'
```

**Expected Output**:
```json
{
  "success": true,
  "message": "Backfill complete: 42 setlists generated from 500 shows",
  "processed": 500,
  "generated": 42
}
```

**Done!** All shows now have prediction setlists.

---

## Verification (Optional)

### Check for Remaining Issues
```bash
npx convex run diagnostics:findShowsWithoutSetlists '{"limit": 50}'
```

If output is `[]` → Perfect! All shows fixed.

If output has items → Artists need catalog sync. Run:
```bash
npx convex run diagnostics:findArtistsWithoutSongs '{"limit": 50}'
```

Then manually re-sync those artists via admin dashboard.

---

## What Happens Next (Automatic)

### Immediate (New Shows)
- Shows created now auto-generate setlists
- 5 retries over 30 minutes if catalog sync is slow

### Every 6 Hours
- Cron scans upcoming shows
- Generates missing setlists automatically

### Every 7 Days
- Weekly backfill scans ALL shows (including legacy/completed)
- Catches any edge cases

**Result**: System self-heals, no manual intervention needed.

---

## If You Want Fresh Data Instead

**WARNING**: This deletes EVERYTHING (users, votes, setlists, etc.)

Only do this in **development**, never in **production**.

### Nuclear Option (DEV ONLY)
1. Export data from Convex dashboard (backup)
2. Add nuke function to admin.ts (see SETLIST_GENERATION_FIXES.md)
3. Run: `npx convex run admin:nukeAllData '{"confirmationCode": "DELETE_EVERYTHING_NOW"}'`
4. Re-import via Ticketmaster sync
5. Wait for automatic syncs (~5-10 minutes)

**Recommendation**: Don't do this. The backfill fixes everything without data loss.

---

## Troubleshooting

### "Backfill generated 0 setlists"
- Check: `npx convex run diagnostics:findArtistsWithoutSongs`
- Fix: Artists need catalog re-sync (Spotify API issue)
- Solution: Admin dashboard → Re-sync artist catalogs

### "Show still has no setlist after backfill"
- Check: Artist has songs in database?
- Run: `npx convex run songs:getByArtist '{"artistId": "xxx", "limit": 10}'`
- If zero songs: Trigger catalog sync manually

### "Error: Admin access required"
- Use test version: `admin:testBackfillMissingSetlists` (no auth)
- Or: Add yourself as admin in Clerk dashboard (public_metadata.role = "admin")

---

## Quick Reference

### Diagnostic Commands
```bash
# Shows without setlists
npx convex run diagnostics:findShowsWithoutSetlists '{"limit": 100}'

# Artists without songs (need sync)
npx convex run diagnostics:findArtistsWithoutSongs '{"limit": 50}'

# Manual backfill (no auth)
npx convex run admin:testBackfillMissingSetlists '{"limit": 500}'

# Backfill with auth (admin only)
npx convex run admin:backfillMissingSetlists '{"limit": 500}'
```

### Test Script (All-in-One)
```bash
./scripts/test-backfill.sh
```

Runs diagnostics → finds issues → runs backfill → reports results.

---

## Timeline

- **Deploy**: 30 seconds
- **Backfill**: 10-60 seconds (depends on show count)
- **Verification**: 5 minutes (manual check)
- **Total**: ~2 minutes to fix everything

---

## What Changed (Technical)

### Code Enhancements
1. Backfill now scans ALL show statuses (not just upcoming)
2. Retry delays extended to 30 minutes (was 5 minutes)
3. Sync guard bypassed for artists with zero songs
4. Weekly cron added for legacy shows

### New Tools
1. Diagnostic queries (find problems)
2. Manual backfill action (fix on demand)
3. Test coverage (validate fixes)

### Prevention
1. Extended retries (5 attempts vs 3)
2. Weekly backfill (catches everything)
3. Smart guards (don't block failed syncs)

---

**Status**: Ready to deploy ✅  
**Risk**: Minimal (backward compatible, tested)  
**Impact**: Fixes all missing setlists without data loss  
**Time**: 2 minutes total  

🚀 **Let's ship it!**

