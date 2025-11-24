import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

// Production-optimized cron frequencies for scalability and API rate limits
// CRITICAL: Use Convex's built-in interval system - DO NOT use orchestrator pattern
// as it causes massive database overhead (12+ queries every 5 minutes = millions of calls)

// Trending updates: Every 4 hours (balanced between freshness and API limits)
// NOTE: syncTrendingData internally updates engagement counts before ranking
crons.interval("update-trending", { hours: 4 }, internalRef.maintenance.syncTrendingData, {});

// Completed shows check: Every 2 hours (sufficient for post-concert setlist availability)
crons.interval("check-completed-shows", { hours: 2 }, internalRef.setlistfm.checkCompletedShows, {});

// Daily cleanup: Once per day (sufficient for orphaned records)
crons.interval("daily-cleanup", { hours: 24 }, internalRef.maintenance.cleanupOrphanedRecords, {});

// Old logs and webhook events cleanup: Once per day to keep tables lean
crons.interval(
  "cleanup-operational-data",
  { hours: 24 },
  internalRef.maintenance.cleanupOldOperationalData,
  {},
);

// Pending setlist scan: Every 30 minutes (queues setlist imports for processing)
crons.interval("setlistfm-scan", { minutes: 30 }, internalRef.setlistfm.scanPendingImports, {});

// Process setlist import queue: Every 30 minutes (processes queued jobs with retry logic)
crons.interval("process-setlist-queue", { minutes: 30 }, internalRef.syncJobs.processSetlistImportQueue, { maxJobs: 5 });

// Artist show counts update: Every 2 hours (keeps artist stats current)
crons.interval("update-artist-show-counts", { hours: 2 }, internalRef.trending.updateArtistShowCounts, {});

// Artist trending scores: Every 4 hours (balanced between freshness and API limits)
crons.interval("update-artist-trending", { hours: 4 }, internalRef.trending.updateArtistTrending, {});

// Show trending scores: Every 4 hours (balanced between freshness and API limits)
crons.interval("update-show-trending", { hours: 4 }, internalRef.trending.updateShowTrending, {});

// Auto-transition show statuses: Every 2 hours (sufficient for status transitions)
crons.interval("auto-transition-shows", { hours: 2 }, internalRef.shows.autoTransitionStatuses, {});

// Missing fields population: Every hour (keeps data complete without overwhelming APIs)
crons.interval("populate-missing-fields", { hours: 1 }, internalRef.maintenance.populateMissingFields, {});

// Spotify token refresh: Every 12 hours (tokens valid for 1 hour, but refresh only needed twice daily)
crons.interval("spotify-refresh", { hours: 12 }, internalRef.spotifyAuth.refreshUserTokens, {});

// Ensure prediction setlists are always seeded for active shows (upcoming only)
// Increased frequency to regenerate empty setlists after catalog sync
crons.interval(
  "refresh-auto-setlists",
  { hours: 6 }, // Run every 6 hours to catch newly synced catalogs
  internalRef.setlists.refreshMissingAutoSetlists,
  { limit: 20 } // Process 20 shows at a time with staggered delays
);

// DISABLED: Weekly backfill was causing infinite loops and usage spikes
// If needed, run manually via admin dashboard with careful monitoring
// crons.interval(
//   "backfill-legacy-setlists",
//   { hours: 168 }, // Once per week (7 days * 24 hours)
//   internalRef.setlists.refreshMissingAutoSetlists,
//   { limit: 200, includeCompleted: true } // Scan ALL statuses for legacy fixes
// );

export default crons;
