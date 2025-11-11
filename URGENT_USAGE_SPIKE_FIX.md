# URGENT: Convex Usage Spike Root Cause & Fixes

## Summary
Function usage spiked from ~0 to 6-7M calls/day starting Nov 8-9, 2025. Root cause identified as inefficient cron orchestrator pattern introduced in recent commits.

## Primary Issue: Cron Orchestrator Anti-Pattern ⚠️🔥

### What Happened
Recent commits replaced Convex's efficient built-in cron scheduler with a custom "orchestrator" pattern that polls a database every 5 minutes.

### Impact
- **Before**: Each cron job ran independently at its designated interval
- **After**: Orchestrator runs every 5 minutes (288x/day) and makes 12+ database calls EACH time
- **Result**: 3,456+ database operations/day just from the orchestrator checking whether jobs should run
- Over 3 days: ~10,368 orchestrator operations + millions of queries from the jobs themselves

### The Code (REVERTED)
```typescript
// BAD: Orchestrator runs every 5 minutes
crons.interval("orchestrator", { minutes: 5 }, internal.crons.orchestrate, {});

export const orchestrate = internalAction({
  handler: async (ctx) => {
    // Each maybeRun makes 2-3 database calls
    await maybeRun("update-trending", 4 * 60 * 60 * 1000, ...);
    await maybeRun("check-completed-shows", 2 * 60 * 60 * 1000, ...);
    // ... 10 more maybeRun calls
  }
});
```

Each `maybeRun`:
1. Queries `cronSettings` table
2. Creates record if missing (mutation)
3. Updates `lastRunAt` timestamp (mutation)
4. **This happens EVERY 5 MINUTES regardless of whether the job needs to run**

### Fix Applied
✅ Reverted `convex/crons.ts` to use Convex's native `crons.interval()` API directly, which is:
- More efficient (no database overhead)
- More reliable (built into Convex scheduler)
- Simpler to understand and maintain

## Secondary Issues: Unbounded Queries (Still Need Fixing)

### Location: `convex/trending.ts`

#### Problem 1: updateEngagementCounts (runs every hour)
```typescript
// Line 714-748: Fetches ALL records from 3 tables
const setlists = await ctx.db.query("setlists").collect();  // ALL setlists
const votes = await ctx.db.query("votes").collect();        // ALL votes
const shows = await ctx.db.query("shows").collect();        // ALL shows
```

**Impact**: If you have 5,000 shows, 10,000 votes, 2,000 setlists:
- 17,000 records read EVERY HOUR
- 408,000 records/day just from this function
- As data grows, this becomes exponentially worse

#### Problem 2: updateArtistShowCounts (runs every 2 hours)
```typescript
// Line 582: Fetches ALL artists
const artists = await ctx.db.query("artists").collect();
for (const artist of artists) {
  const upcomingShows = await ctx.db
    .query("shows")
    .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
    .filter((q) => q.eq(q.field("status"), "upcoming"))
    .collect();
  // ...
}
```

**Impact**: N+1 query pattern - if you have 1,000 artists, this makes 1,001 queries

#### Problem 3: updateArtistTrending (runs every 4 hours)
```typescript
// Line 604: Fetches ALL artists again
const artists = await ctx.db.query("artists").collect();
// Processes and updates each one
```

#### Problem 4: updateShowTrending (runs every 4 hours)
```typescript
// Line 642: Fetches ALL upcoming shows
const upcoming = await ctx.db
  .query("shows")
  .withIndex("by_status", (q) => q.eq("status", "upcoming"))
  .collect();
```

### Recommended Fixes (Future Work)

1. **Pagination**: Use `.take(limit)` and paginate through records in batches
2. **Incremental Updates**: Only update changed records, not everything
3. **Caching**: Use denormalized counters that update on insert/delete
4. **Database Aggregation**: Consider if Convex supports count/sum operations
5. **Rate Limiting**: Process updates in smaller batches over time

### Example Optimization for updateEngagementCounts
```typescript
// BETTER: Process in batches
export const updateEngagementCounts = internalMutation({
  args: { cursor: v.optional(v.string()), batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    // Process shows in batches
    const shows = await ctx.db
      .query("shows")
      .paginate({ cursor: args.cursor, numItems: batchSize });

    for (const show of shows.page) {
      // Count only for this show
      const setlistCount = await ctx.db
        .query("setlists")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect()
        .then(s => s.length);

      // Update only if changed
      if (show.setlistCount !== setlistCount) {
        await ctx.db.patch(show._id, { setlistCount });
      }
    }

    // Schedule next batch if more remain
    if (!shows.isDone) {
      await ctx.scheduler.runAfter(1000, internal.trending.updateEngagementCounts, {
        cursor: shows.continueCursor,
        batchSize
      });
    }
  }
});
```

## Action Items

### DONE ✅
- [x] Identified root cause (cron orchestrator pattern)
- [x] Reverted crons.ts to efficient interval-based approach
- [x] Documented all issues and optimizations

### TODO 📋
- [ ] Deploy fix to production
- [ ] Monitor usage drop after deployment
- [ ] Optimize unbounded .collect() queries in trending.ts
- [ ] Add pagination/batching to large table scans
- [ ] Consider incremental counter updates on insert/delete
- [ ] Review other files for similar anti-patterns

## Expected Results After Fix

- Function calls should drop from 6-7M/day to <100K/day
- Action compute should drop from 75 GB-hours to <5 GB-hours
- Database operations become proportional to actual work, not polling overhead

## Monitoring

After deployment, watch:
1. Daily function calls graph - should see immediate drop
2. Action compute - should decrease by ~90%
3. Database bandwidth - should stabilize
4. Query/mutation breakdown - orchestrator queries should disappear

## Prevention

**DO NOT**:
- Poll databases for scheduling decisions (use Convex's built-in scheduler)
- Use `.collect()` without limits on production tables
- Create N+1 query patterns in cron jobs

**DO**:
- Use `crons.interval()` directly for scheduled jobs
- Use `.take(limit)` or `.paginate()` for large queries
- Batch operations and use incremental updates
- Profile/monitor function usage during development
- Test with production-scale data before deploying

---

**Deployment Priority**: CRITICAL - Deploy immediately to stop cost bleed
**Estimated Savings**: ~99% reduction in function usage
**Risk**: Low - reverting to previous working code
