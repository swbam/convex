import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Production-optimized cron frequencies for scalability and API rate limits
// CRITICAL: Use Convex's built-in interval system - DO NOT use orchestrator pattern
// as it causes massive database overhead (12+ queries every 5 minutes = millions of calls)

// Trending updates: Every 4 hours (balanced between freshness and API limits)
// NOTE: syncTrendingData internally updates engagement counts before ranking
crons.interval("update-trending", { hours: 4 }, internal.maintenance.syncTrendingData, {});

// Completed shows check: Every 2 hours (sufficient for post-concert setlist availability)
crons.interval("check-completed-shows", { hours: 2 }, internal.setlistfm.checkCompletedShows, {});

// Daily cleanup: Once per day (sufficient for orphaned records)
crons.interval("daily-cleanup", { hours: 24 }, internal.maintenance.cleanupOrphanedRecords, {});

// Old jobs and error logs cleanup: Once per day to keep tables lean
crons.interval("cleanup-old-jobs-and-errors", { hours: 24 }, internal.maintenance.cleanupOldJobsAndErrors, {});

// Pending setlist scan: Every 30 minutes (queues setlist imports for processing)
crons.interval("setlistfm-scan", { minutes: 30 }, internal.setlistfm.scanPendingImports, {});

// Process setlist import queue: Every 30 minutes (processes queued jobs with retry logic)
crons.interval("process-setlist-queue", { minutes: 30 }, internal.syncJobs.processSetlistImportQueue, { maxJobs: 5 });

// Engagement counts sync: Every hour (sufficient for vote/setlist count accuracy)
crons.interval("sync-engagement-counts", { hours: 1 }, internal.trending.updateEngagementCounts, {});

// Artist show counts update: Every 2 hours (keeps artist stats current)
crons.interval("update-artist-show-counts", { hours: 2 }, internal.trending.updateArtistShowCounts, {});

// Artist trending scores: Every 4 hours (balanced between freshness and API limits)
crons.interval("update-artist-trending", { hours: 4 }, internal.trending.updateArtistTrending, {});

// Show trending scores: Every 4 hours (balanced between freshness and API limits)
crons.interval("update-show-trending", { hours: 4 }, internal.trending.updateShowTrending, {});

// Auto-transition show statuses: Every 2 hours (sufficient for status transitions)
crons.interval("auto-transition-shows", { hours: 2 }, internal.shows.autoTransitionStatuses, {});

// Missing fields population: Every hour (keeps data complete without overwhelming APIs)
crons.interval("populate-missing-fields", { hours: 1 }, internal.maintenance.populateMissingFields, {});

// Spotify token refresh: Every 12 hours (tokens valid for 1 hour, but refresh only needed twice daily)
crons.interval("spotify-refresh", { hours: 12 }, internal.spotifyAuth.refreshUserTokens, {});

// Ensure prediction setlists are always seeded for active shows (upcoming only)
// REDUCED frequency and limit to prevent usage spikes
crons.interval(
  "refresh-auto-setlists",
  { hours: 12 }, // Reduced from 6 to 12 hours
  internal.setlists.refreshMissingAutoSetlists,
  { limit: 20 } // Reduced from 60 to 20 to prevent bulk scheduling
);

// DISABLED: Weekly backfill was causing infinite loops and usage spikes
// If needed, run manually via admin dashboard with careful monitoring
// crons.interval(
//   "backfill-legacy-setlists",
//   { hours: 168 }, // Once per week (7 days * 24 hours)
//   internal.setlists.refreshMissingAutoSetlists,
//   { limit: 200, includeCompleted: true } // Scan ALL statuses for legacy fixes
// );

export default crons;
