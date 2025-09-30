import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ENHANCED: More frequent trending updates (every 2 hours instead of 4)
crons.interval("update-trending", { hours: 2 }, internal.maintenance.syncTrendingData, {});

// ENHANCED: More frequent completed shows check (every 2 hours instead of 6)
crons.interval("check-completed-shows", { hours: 2 }, internal.setlistfm.checkCompletedShows, {});

// Daily cleanup using existing function
crons.interval("daily-cleanup", { hours: 24 }, internal.maintenance.cleanupOrphanedRecords, {});

// ENHANCED: More frequent Setlist.fm scans (every 4 hours instead of 24)
crons.interval("setlistfm-scan", { hours: 4 }, internal.setlistfm.scanPendingImports, {});

// Reliable sync for vote and setlist counts (every 30 min)
crons.interval("sync-engagement-counts", { minutes: 30 }, internal.trending.updateEngagementCounts, {});

// Hourly validation cron to fix incomplete/invalid fields (temporarily disabled - will be enabled after testing)
// crons.interval("validate-db-fields", { hours: 1 }, internal.common.validateAllRecords, { limit: 100 });

// NEW: Auto-transition show statuses (every hour to catch completed shows quickly)
crons.interval("auto-transition-shows", { hours: 1 }, internal.shows.autoTransitionStatuses, {});

export default crons;

