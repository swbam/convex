import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync trending data every 30 minutes
crons.interval(
  "sync trending data",
  { minutes: 30 },
  internal.sync.startTrendingSync,
  {}
);

// Check for completed shows and sync setlists every hour
crons.interval(
  "check completed shows",
  { hours: 1 },
  internal.setlistfm.checkCompletedShows,
  {}
);

export default crons;
