import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Ensure existing crons are present:
crons.interval("update-trending", { hours: 4 }, internal.maintenance.syncTrendingData, {});

crons.interval("check-completed-shows", { hours: 6 }, internal.setlistfm.checkCompletedShows, {});

// Daily cleanup using existing function
crons.interval("daily-cleanup", { hours: 24 }, internal.maintenance.cleanupOrphanedRecords, {});

// Daily Setlist.fm scan for pending imports
crons.interval("daily-setlistfm-scan", { hours: 24 }, internal.setlistfm.scanPendingImports, {});

// Reliable sync for vote and setlist counts (every 30 min)
crons.interval("sync-engagement-counts", { minutes: 30 }, internal.trending.updateEngagementCounts, {});

// Enhanced trending update with logging (every 2 hours for reliability)
crons.interval("update-trending-enhanced", { hours: 2 }, internal.maintenance.syncTrendingDataWithLogging, {});

