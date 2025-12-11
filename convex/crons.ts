import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

// ============================================================================
// OPTIMIZED CRON SCHEDULE - Minimized for cost efficiency
// ============================================================================

// DAILY JOBS (run once per day at specific times)
// -----------------------------------------------

// Setlist.fm import: Daily at midnight PST (8:00 UTC)
// Setlist.fm data often takes 1-3 days to appear, so daily is plenty
crons.cron("check-completed-shows", "0 8 * * *", internalRef.setlistfm.checkCompletedShows, {});

// Daily cleanup: Run at 3:00 AM UTC
crons.cron("daily-cleanup", "0 3 * * *", internalRef.maintenance.cleanupOrphanedRecords, {});

// Operational data cleanup: Run at 4:00 AM UTC
crons.cron("cleanup-operational-data", "0 4 * * *", internalRef.maintenance.cleanupOldOperationalData, {});

// Auto-seed prediction setlists: Daily at 6:00 AM UTC
crons.cron("refresh-auto-setlists", "0 6 * * *", internalRef.setlists.refreshMissingAutoSetlists, { limit: 50 });

// Festival status transitions: Daily at 5:00 AM UTC
crons.cron("transition-festival-status", "0 5 * * *", internalRef.festivals.transitionStatuses, {});

// PERIODIC JOBS (run multiple times per day)
// -------------------------------------------

// Trending data sync: Every 6 hours (4x daily is sufficient for discovery)
crons.interval("update-trending", { hours: 6 }, internalRef.maintenance.syncTrendingData, {});

// CRITICAL: Refresh trending cache from Ticketmaster API every 12 hours
// This fetches fresh trending artists/shows and imports them with full sync
crons.interval("refresh-trending-cache", { hours: 12 }, internalRef.admin.refreshTrendingCacheInternal, {});

// Artist trending scores: Every 6 hours
crons.interval("update-artist-trending", { hours: 6 }, internalRef.trending.updateArtistTrending, {});

// Show trending scores: Every 6 hours
crons.interval("update-show-trending", { hours: 6 }, internalRef.trending.updateShowTrending, {});

// Artist show counts: Every 6 hours
crons.interval("update-artist-show-counts", { hours: 6 }, internalRef.trending.updateArtistShowCounts, {});

// Auto-transition show statuses: Every 4 hours (marks shows as completed after date passes)
crons.interval("auto-transition-shows", { hours: 4 }, internalRef.shows.autoTransitionStatuses, {});

// Populate missing fields: Every 8 hours (not urgent, fills in gaps)
crons.interval("populate-missing-fields", { hours: 8 }, internalRef.maintenance.populateMissingFields, {});

// Spotify token refresh: Every 12 hours (tokens valid for 1 hour, but we only refresh active users)
crons.interval("spotify-refresh", { hours: 12 }, internalRef.spotifyAuth.refreshUserTokens, {});

// REMOVED - These were redundant with check-completed-shows:
// - setlistfm-scan (scanPendingImports) - duplicated work
// - process-setlist-queue (processSetlistImportQueue) - unnecessary queue layer

export default crons;
