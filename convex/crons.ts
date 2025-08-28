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

// Sync setlists from Setlist.fm every 2 hours
crons.cron(
  "sync-setlistfm",
  "0 */2 * * *", // Every 2 hours
  api.sync.syncSetlistFm,
  {}
);

// Sync trending data from Ticketmaster every 3 hours
crons.cron(
  "sync-trending-data",
  "0 */3 * * *", // Every 3 hours
  api.sync.syncTrendingData,
  {}
);

export default crons;
