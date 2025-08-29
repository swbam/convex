import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Sync artists from Spotify every 6 hours
crons.cron(
  "sync-spotify-artists",
  "0 */6 * * *", // Every 6 hours
  api.sync.syncSpotifyArtists,
  {}
);

// Sync shows from Ticketmaster daily at 2 AM UTC
crons.daily(
  "sync-ticketmaster-shows",
  { hourUTC: 2, minuteUTC: 0 }, // 2 AM UTC daily
  api.sync.syncTicketmasterShows,
  {}
);

// Sync setlists from Setlist.fm every 6 hours (respect API limits)
crons.cron(
  "sync-setlistfm",
  "0 */6 * * *", // Every 6 hours
  api.sync.syncSetlistFm,
  {}
);

// Sync trending data from Ticketmaster daily at 02:00 UTC per PRD
crons.daily(
  "sync-trending-data",
  { hourUTC: 2, minuteUTC: 0 },
  api.sync.syncTrendingData,
  {}
);

export default crons;
