import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Update trending scores and rankings
crons.interval(
  "update-trending",
  { hours: 4 }, // Every 4 hours for fresh trending data
  internal.maintenance_v2.syncTrendingData,
  {}
);

// Fix missing artist data (Spotify sync)
crons.interval(
  "fix-missing-artist-data",
  { hours: 6 }, // Every 6 hours
  internal.maintenance_v2.fixMissingArtistData,
  {}
);

// Clean up orphaned records
crons.interval(
  "data-cleanup",
  { hours: 24 }, // Daily cleanup
  internal.maintenance_v2.cleanupOrphanedRecords,
  {}
);

// Check for completed shows and import setlists
crons.interval(
  "check-completed-shows",
  { hours: 6 }, // Every 6 hours
  internal.setlistfm.checkCompletedShows,
  {}
);

export default crons;