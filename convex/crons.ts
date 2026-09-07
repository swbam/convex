import { cronJobs } from "convex/server";
import { internalRef } from "./adminHelpers";

const crons = cronJobs();

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any


// ============================================================================
// OPTIMIZED CRON SCHEDULE - Minimized for cost efficiency
// ============================================================================

// DAILY JOBS (run once per day at specific times)
// -----------------------------------------------

// Drain bounded, leased batches every two hours. No overlapping pollers.
// Each run admits at most 20 first attempts + 10 retries; provider backoff remains.
// Actual API quotas depend on the project's provider agreement.
crons.cron("check-completed-shows", "0 */2 * * *", internalRef.setlistfm.checkCompletedShows, {});

// Daily cleanup: Run at 3:00 AM UTC
crons.cron("daily-cleanup", "0 3 * * *", internalRef.maintenance.cleanupOrphanedRecords, {});

// Operational data cleanup: Run at 4:00 AM UTC
crons.cron("cleanup-operational-data", "0 4 * * *", internalRef.maintenance.cleanupOldOperationalData, {});

// Auto-seed prediction setlists: Daily at 6:00 AM UTC
crons.cron("refresh-auto-setlists", "0 6 * * *", internalRef.setlists.refreshMissingAutoSetlists, { limit: 50 });

// Festival status transitions: Daily at 5:00 AM UTC
crons.cron("transition-festival-status", "0 5 * * *", internalRef.festivals.transitionStatuses, {});

// Festival lineup refresh: Weekly on Sundays at 7:00 AM UTC
// Finds festivals with partial lineups (<20 artists) and schedules imports
crons.cron("refresh-partial-lineups", "0 7 * * 0", internalRef.festivals.refreshPartialLineups, {});

// PERIODIC JOBS (run multiple times per day)
// -------------------------------------------

// Cron Orchestrator: checks cronSettings and runs due jobs
// This enables runtime interval edits + enable/disable + run-now via the admin dashboard.
crons.interval("cron-orchestrator", { minutes: 10 }, internalRef.cronOrchestrator.tick, {});

// One-time, self-retiring migration in practice: it processes a small indexed
// batch each run and becomes a no-op once all legacy venues have canonical URLs.
crons.interval("backfill-venue-slugs", { minutes: 30 }, internalRef.venues.backfillMissingSlugs, { limit: 250 });

// REMOVED - These were redundant with check-completed-shows:
// - setlistfm-scan (scanPendingImports) - duplicated work
// - process-setlist-queue (processSetlistImportQueue) - unnecessary queue layer

export default crons;
