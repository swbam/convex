import { query, action } from "./_generated/server";
import { v } from "convex/values";

// Health check query for production monitoring
export const healthCheck = query({
  args: {},
  returns: v.object({
    status: v.string(),
    timestamp: v.number(),
    version: v.string(),
    database: v.boolean(),
    environment: v.object({
      hasSpotifyCredentials: v.boolean(),
      hasTicketmasterKey: v.boolean(),
      hasSetlistfmKey: v.boolean(),
    }),
  }),
  handler: async (ctx) => {
    // Test database connectivity by querying a simple record
    let databaseHealthy = true;
    try {
      await ctx.db.query("users").take(1);
    } catch (error) {
      databaseHealthy = false;
    }

    return {
      status: databaseHealthy ? "healthy" : "unhealthy",
      timestamp: Date.now(),
      version: "1.0.0",
      database: databaseHealthy,
      environment: {
        hasSpotifyCredentials: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
        hasTicketmasterKey: !!process.env.TICKETMASTER_API_KEY,
        hasSetlistfmKey: !!process.env.SETLISTFM_API_KEY,
      },
    };
  },
});

// Validate environment variables at startup
export const validateEnvironment = action({
  args: {},
  returns: v.object({
    valid: v.boolean(),
    missing: v.array(v.string()),
    warnings: v.array(v.string()),
  }),
  handler: async () => {
    const alwaysRequired = [
      "SPOTIFY_CLIENT_ID",
      "SPOTIFY_CLIENT_SECRET",
      "TICKETMASTER_API_KEY",
      "SETLISTFM_API_KEY",
      "SITE_URL",
    ];
    const productionRequired = [
      "RESEND_API_KEY",
      "OWNER_NOTIFICATION_EMAIL",
      "SPOTIFY_TOKEN_ENC_KEY",
    ];

    const required = [
      ...alwaysRequired,
      ...(process.env.NODE_ENV === "production" ? productionRequired : []),
    ];

    const missing: string[] = [];
    const warnings: string[] = [];

    for (const envVar of required) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    }

    // Check for common misconfigurations
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_ID.startsWith('pk_')) {
      warnings.push('SPOTIFY_CLIENT_ID appears to be a Clerk key, not a Spotify client ID');
    }

    if (process.env.TICKETMASTER_API_KEY && process.env.TICKETMASTER_API_KEY.length < 20) {
      warnings.push('TICKETMASTER_API_KEY appears to be too short');
    }

    if (!process.env.SPOTIFY_TOKEN_ENC_KEY) {
      warnings.push('SPOTIFY_TOKEN_ENC_KEY is missing; Spotify OAuth tokens will not be launch-safe.');
    }

    if (!process.env.SENTRY_DSN) {
      warnings.push('SENTRY_DSN is not configured; production error visibility will be limited.');
    }

    if (process.env.NODE_ENV === "production" && !process.env.CLERK_SECRET_KEY) {
      warnings.push('CLERK_SECRET_KEY is not configured; Clerk admin role sync will be skipped.');
    }

    if (process.env.NODE_ENV === "production" && !process.env.CLERK_WEBHOOK_SECRET) {
      warnings.push('CLERK_WEBHOOK_SECRET is not configured; Clerk webhook ingestion will reject requests.');
    }

    return {
      valid: missing.length === 0,
      missing,
      warnings,
    };
  },
});

// Get system stats for monitoring
export const getSystemStats = query({
  args: {},
  returns: v.object({
    totalArtists: v.number(),
    totalShows: v.number(),
    totalSetlists: v.number(),
    totalVotes: v.number(),
    activeSyncJobs: v.number(),
    lastSyncTimestamp: v.optional(v.number()),
  }),
  handler: async (ctx) => {
    // Bounded reads: full-table .collect() here blew Convex's 16MB byte-read
    // limit in production (shows/setlists/votes are large). Counts are capped
    // at COUNT_CAP — read "5000" as "5000+".
    const COUNT_CAP = 5000;
    const [artists, shows, setlists, votes, syncJobs] = await Promise.all([
      ctx.db.query("artists").take(COUNT_CAP),
      ctx.db.query("shows").take(COUNT_CAP),
      ctx.db.query("setlists").take(COUNT_CAP),
      ctx.db.query("votes").take(COUNT_CAP),
      ctx.db
        .query("syncJobs")
        .withIndex("by_status", (q) => q.eq("status", "running"))
        .take(500),
    ]);

    // Find most recent sync timestamp
    const recentArtist = artists
      .filter(a => a.lastSynced)
      .sort((a, b) => (b.lastSynced || 0) - (a.lastSynced || 0))[0];

    return {
      totalArtists: artists.length,
      totalShows: shows.length,
      totalSetlists: setlists.length,
      totalVotes: votes.length,
      activeSyncJobs: syncJobs.length,
      lastSyncTimestamp: recentArtist?.lastSynced,
    };
  },
});
