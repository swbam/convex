import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Update trending scores and rankings
crons.interval(
  "update-trending",
  { hours: 4 },
  internal.maintenance.syncTrendingData,
  {}
);

// Fix missing artist data (Spotify sync)
crons.interval(
  "fix-missing-artist-data",
  { hours: 6 },
  internal.maintenance.fixMissingArtistData,
  {}
);

// Clean up orphaned records
crons.interval(
  "data-cleanup",
  { hours: 24 },
  internal.maintenance.cleanupOrphanedRecords,
  {}
);

// Check for completed shows and import setlists
crons.interval(
  "check-completed-shows",
  { hours: 6 },
  internal.setlistfm.checkCompletedShows,
  {}
);

export default crons;

