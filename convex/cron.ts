import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// CRITICAL: Data integrity maintenance - fix missing spotifyId and ticketmasterId fields
crons.interval(
  "fix-missing-artist-data",
  { hours: 6 }, // Every 6 hours
  internal.maintenance.fixMissingArtistData,
  {}
);

// Sync trending data to populate database
crons.interval(
  "sync-trending-data", 
  { hours: 12 }, // Every 12 hours
  internal.maintenance.syncTrendingData,
  {}
);

// Clean up orphaned records and maintain data quality
crons.interval(
  "data-cleanup",
  { hours: 24 }, // Daily cleanup
  internal.maintenance.cleanupOrphanedRecords,
  {}
);

export default crons;