import { query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

// Add missing internals at top:

// Internal: Get pending setlist import jobs
export const getPendingJobs = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    // FIXED: Use composite index for better performance
    return await ctx.db
      .query("syncJobs")
      .withIndex("by_type_and_status", (q: any) =>
        q.eq("type", "setlist_import").eq("status", "pending"))
      .order("asc")
      .take(5); // Limit for performance
  },
});

// Internal: Get show by ID
export const getShowByIdInternal = internalQuery({
  args: { id: v.id("shows") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Internal: Get artist by ID (reuse from artists if exists, or add)
export const getArtistByIdInternal = internalQuery({
  args: { id: v.id("artists") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Internal: Get venue by ID
export const getVenueByIdInternal = internalQuery({
  args: { id: v.id("venues") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get active sync jobs for progress display
export const getActive = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const activeJobs = await ctx.db
      .query("syncJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(5);

    return activeJobs;
  },
});

// Simple job status update
export const updateJobStatus = internalMutation({
  args: {
    jobId: v.id("syncJobs"),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed")),
    errorMessage: v.optional(v.string()),
    progress: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: any = { status: args.status };
    if (args.errorMessage) patch.errorMessage = args.errorMessage;
    if (args.progress !== undefined) patch.progressPercentage = args.progress;
    await ctx.db.patch(args.jobId, patch);
    return null;
  },
});

// Queue a setlist import job
export const queueSetlistImport = internalMutation({
  args: {
    showId: v.id("shows"),
    artistName: v.string(),
    venueCity: v.string(),
    showDate: v.string(),
  },
  returns: v.id("syncJobs"),
  handler: async (ctx, args) => {
    // Update show importStatus to pending
    await ctx.db.patch(args.showId, { importStatus: "pending" });

    const jobId = await ctx.db.insert("syncJobs", {
      type: "setlist_import",
      entityId: args.showId,
      priority: 5, // Medium priority
      status: "pending",
      retryCount: 0,
      maxRetries: 3,
      startedAt: undefined,
      completedAt: undefined,
      errorMessage: undefined,
      currentPhase: "queued",
      totalSteps: 3, // Queue, sync, alert
      completedSteps: 0,
      currentStep: "queued",
      itemsProcessed: 0,
      totalItems: 1,
      progressPercentage: 0,
    });

    console.log(`Queued setlist import job ${jobId} for show ${args.showId}`);
    return jobId;
  },
});

// Process setlist import jobs from queue
export const processSetlistImportQueue = internalAction({
  args: { maxJobs: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const maxJobs = args.maxJobs || 5;
    console.log(`Processing up to ${maxJobs} setlist import jobs...`);

    // Single-runner lock to prevent overlapping processors
    const lockName = "setlist_import_queue";
    const STALE_MS = 10 * 60 * 1000; // 10 minutes
    const acquired = await ctx.runMutation(internalRef.maintenance.acquireLock as any, { name: lockName, staleMs: STALE_MS });
    if (!acquired) {
      console.warn("⏳ Setlist import queue is already being processed; skipping this run");
      return null;
    }

    try {
      // Get pending jobs
      const pendingJobs = await ctx.runQuery(internalRef.syncJobs.getPendingJobs, {});

      let processed = 0;
      for (const job of pendingJobs) {
        try {
        // Mark as running
        await ctx.runMutation(internalRef.syncJobs.updateJobStatus, {
          jobId: job._id,
          status: "running",
          progress: 33, // 1/3 done
        });

        // Get show data - ensure entityId is a valid show ID
        if (!job.entityId) {
          throw new Error("No entityId for job");
        }
        const show = await ctx.runQuery(internalRef.syncJobs.getShowByIdInternal, { id: job.entityId as any });
        if (!show) {
          throw new Error("Show not found for job");
        }

        const [artist, venue] = await Promise.all([
          ctx.runQuery(internalRef.syncJobs.getArtistByIdInternal, { id: show.artistId }),
          ctx.runQuery(internalRef.syncJobs.getVenueByIdInternal, { id: show.venueId }),
        ]);

        if (!artist || !venue) {
          throw new Error("Artist or venue not found for show");
        }

        // Perform the sync
        const setlistId = await ctx.runAction(internalRef.setlistfm.syncActualSetlist, {
          showId: show._id,
          artistName: artist.name,
          venueCity: venue.city,
          showDate: show.date,
        });

        if (setlistId) {
          // Success
          await ctx.runMutation(internalRef.syncJobs.updateJobStatus, {
            jobId: job._id,
            status: "completed",
            progress: 100,
          });
          // Use mutation to update job fields (actions can't access db directly)
          await ctx.runMutation(internalRef.syncJobs.completeJob, {
            jobId: job._id,
          });

          // Alert: Update show status
          await ctx.runMutation(internalRef.shows.updateImportStatus, { showId: show._id, status: "completed" });

          console.log(`✅ Completed setlist import job ${job._id} for show ${show._id}`);
        } else {
          // Failure - increment retry
          const newRetry = job.retryCount + 1;
          if (newRetry >= job.maxRetries) {
            await ctx.runMutation(internalRef.syncJobs.updateJobStatus, {
              jobId: job._id,
              status: "failed",
              errorMessage: "Sync failed after max retries",
              progress: 100,
            });
            // Use mutation to mark as failed
            await ctx.runMutation(internalRef.syncJobs.failJob, {
              jobId: job._id,
              errorMessage: "Sync failed after max retries",
            });

            // Alert: Mark show as failed
            await ctx.runMutation(internalRef.shows.updateImportStatus, { showId: show._id, status: "failed" });
            console.log(`❌ Failed setlist import job ${job._id} after ${job.maxRetries} retries`);
          } else {
            await ctx.runMutation(internalRef.syncJobs.updateJobStatus, {
              jobId: job._id,
              status: "pending",
              progress: 0,
            });
            // Use mutation to update retry count
            await ctx.runMutation(internalRef.syncJobs.retryJob, {
              jobId: job._id,
              retryCount: newRetry,
            });
            console.log(`⏳ Retrying setlist import job ${job._id} (attempt ${newRetry})`);
          }
        }

          processed++;
        } catch (error) {
          console.error(`Error processing job ${job._id}:`, error);
          await ctx.runMutation(internalRef.syncJobs.updateJobStatus, {
            jobId: job._id,
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            progress: 0,
          });
          processed++;
        }
      }

      console.log(`Processed ${processed} setlist import jobs`);
      return null;
    } finally {
      await ctx.runMutation(internalRef.maintenance.releaseLock as any, { name: lockName });
    }
  },
});

// Get failed jobs for alerting
// Helper mutations for job state management
export const completeJob = internalMutation({
  args: { jobId: v.id("syncJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      completedAt: Date.now(),
      currentPhase: "completed",
      completedSteps: 3,
      progressPercentage: 100,
    });
    return null;
  },
});

export const failJob = internalMutation({
  args: { 
    jobId: v.id("syncJobs"),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      completedAt: Date.now(),
      errorMessage: args.errorMessage,
      progressPercentage: 100,
    });
    return null;
  },
});

export const retryJob = internalMutation({
  args: { 
    jobId: v.id("syncJobs"),
    retryCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      retryCount: args.retryCount,
      currentPhase: "retrying",
      progressPercentage: 0,
    });
    return null;
  },
});

export const getFailedImports = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query("syncJobs")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .filter((q) => q.eq(q.field("type"), "setlist_import"))
      .order("desc")
      .take(10);
  },
});