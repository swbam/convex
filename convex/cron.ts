import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily trending sync at 6 AM UTC
crons.daily(
  "daily trending sync",
  { hourUTC: 6, minuteUTC: 0 },
  internal.sync.startTrendingSync
);

// Check for completed shows every 4 hours
crons.interval(
  "check completed shows",
  { hours: 4 },
  internal.setlistfm.checkCompletedShows
);

// Update trending scores every 2 hours
crons.interval(
  "update trending scores",
  { hours: 2 },
  internal.syncStatus.updateTrendingScores
);

// Weekly deep catalog sync on Sundays at 2 AM UTC
crons.weekly(
  "weekly catalog sync",
  { dayOfWeek: "sunday", hourUTC: 2, minuteUTC: 0 },
  internal.sync.deepCatalogSync
);

// Monthly cleanup of old data on the 1st at midnight UTC
crons.monthly(
  "monthly cleanup",
  { day: 1, hourUTC: 0, minuteUTC: 0 },
  internal.sync.cleanupOldData
);

export default crons;