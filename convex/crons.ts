import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Production-optimized cron frequencies for scalability and API rate limits

// Trending updates: Every 4 hours (balanced between freshness and API limits)
crons.interval("update-trending", { hours: 4 }, internal.maintenance.syncTrendingData, {});

// Completed shows check: Every 2 hours (sufficient for post-concert setlist availability)
crons.interval("check-completed-shows", { hours: 2 }, internal.setlistfm.checkCompletedShows, {});

// Daily cleanup: Once per day (sufficient for orphaned records)
crons.interval("daily-cleanup", { hours: 24 }, internal.maintenance.cleanupOrphanedRecords, {});

// Pending setlist scan: Every 30 minutes (balanced between responsiveness and API limits)
crons.interval("setlistfm-scan", { minutes: 30 }, internal.setlistfm.scanPendingImports, {});

// Engagement counts sync: Every hour (sufficient for vote/setlist count accuracy)
crons.interval("sync-engagement-counts", { hours: 1 }, internal.trending.updateEngagementCounts, {});

// Auto-transition show statuses: Every 2 hours (sufficient for status transitions)
crons.interval("auto-transition-shows", { hours: 2 }, internal.shows.autoTransitionStatuses, {});

// Missing fields population: Every hour (keeps data complete without overwhelming APIs)
crons.interval("populate-missing-fields", { hours: 1 }, internal.maintenance.populateMissingFields, {});

// Spotify token refresh: Every 12 hours (tokens valid for 1 hour, but refresh only needed twice daily)
crons.interval("spotify-refresh", { hours: 12 }, internal.spotifyAuth.refreshUserTokens, {});

export default crons;

