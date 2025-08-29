import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check for completed shows every 4 hours
crons.interval(
  "check completed shows",
  { hours: 4 },
  internal.setlistfm.checkCompletedShows,
  {}
);

// Refresh trending scores every 2 hours
crons.interval(
  "refresh trending scores",
  { hours: 2 },
  internal.artists.resetInactiveTrendingScores,
  {}
);

// Sync trending shows and artists from Ticketmaster every 3 hours
crons.interval(
  "sync trending data",
  { hours: 3 },
  internal.sync.syncTrendingData,
  {}
);

export default crons;