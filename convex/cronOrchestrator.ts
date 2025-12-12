import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireAdmin } from "./admin";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

type JobKind = "mutation" | "action";

type JobDef = {
  name: string;
  kind: JobKind;
  // FunctionReference (internal.*)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: any;
  defaultIntervalMs: number;
  minIntervalMs: number;
  maxIntervalMs: number;
  lockName: string;
  lockStaleMs: number;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const JOBS: Array<JobDef> = [
  {
    name: "update-trending",
    kind: "action",
    ref: internalRef.maintenance.syncTrendingData,
    defaultIntervalMs: 6 * HOUR,
    minIntervalMs: 60 * MINUTE,
    maxIntervalMs: 24 * HOUR,
    lockName: "cron:update-trending",
    lockStaleMs: 60 * MINUTE,
  },
  {
    name: "refresh-trending-cache",
    kind: "action",
    ref: internalRef.admin.refreshTrendingCacheInternal,
    defaultIntervalMs: 12 * HOUR,
    minIntervalMs: 6 * HOUR,
    maxIntervalMs: 48 * HOUR,
    lockName: "cron:refresh-trending-cache",
    lockStaleMs: 2 * HOUR,
  },
  {
    name: "update-artist-trending",
    kind: "mutation",
    ref: internalRef.trending.updateArtistTrending,
    defaultIntervalMs: 6 * HOUR,
    minIntervalMs: 60 * MINUTE,
    maxIntervalMs: 24 * HOUR,
    lockName: "cron:update-artist-trending",
    lockStaleMs: 60 * MINUTE,
  },
  {
    name: "update-show-trending",
    kind: "mutation",
    ref: internalRef.trending.updateShowTrending,
    defaultIntervalMs: 6 * HOUR,
    minIntervalMs: 60 * MINUTE,
    maxIntervalMs: 24 * HOUR,
    lockName: "cron:update-show-trending",
    lockStaleMs: 60 * MINUTE,
  },
  {
    name: "update-artist-show-counts",
    kind: "mutation",
    ref: internalRef.trending.updateArtistShowCounts,
    defaultIntervalMs: 6 * HOUR,
    minIntervalMs: 60 * MINUTE,
    maxIntervalMs: 24 * HOUR,
    lockName: "cron:update-artist-show-counts",
    lockStaleMs: 60 * MINUTE,
  },
  {
    name: "auto-transition-shows",
    kind: "mutation",
    ref: internalRef.shows.autoTransitionStatuses,
    defaultIntervalMs: 4 * HOUR,
    minIntervalMs: 60 * MINUTE,
    maxIntervalMs: 24 * HOUR,
    lockName: "cron:auto-transition-shows",
    lockStaleMs: 60 * MINUTE,
  },
  {
    name: "populate-missing-fields",
    kind: "action",
    ref: internalRef.maintenance.populateMissingFields,
    defaultIntervalMs: 8 * HOUR,
    minIntervalMs: 2 * HOUR,
    maxIntervalMs: 48 * HOUR,
    lockName: "cron:populate-missing-fields",
    lockStaleMs: 2 * HOUR,
  },
  {
    name: "spotify-refresh",
    kind: "action",
    ref: internalRef.spotifyAuth.refreshUserTokens,
    defaultIntervalMs: 12 * HOUR,
    minIntervalMs: 2 * HOUR,
    maxIntervalMs: 48 * HOUR,
    lockName: "cron:spotify-refresh",
    lockStaleMs: 2 * HOUR,
  },
];

function clampIntervalMs(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

type CronSettingDoc = {
  _id: Id<"cronSettings">;
  name: string;
  intervalMs: number;
  enabled: boolean;
  lastRunAt?: number;
  runNowRequestedAt?: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  lastError?: string;
  lastDurationMs?: number;
};

export const ensureDefaultsInternal = internalMutation({
  args: {
    defaults: v.array(
      v.object({
        name: v.string(),
        intervalMs: v.number(),
        enabled: v.boolean(),
      }),
    ),
  },
  returns: v.object({ created: v.number(), existing: v.number() }),
  handler: async (ctx, args) => {
    let created = 0;
    let existing = 0;

    for (const def of args.defaults) {
      const row = await ctx.db
        .query("cronSettings")
        .withIndex("by_name", (q) => q.eq("name", def.name))
        .first();
      if (row) {
        existing += 1;
        continue;
      }
      await ctx.db.insert("cronSettings", {
        name: def.name,
        intervalMs: def.intervalMs,
        enabled: def.enabled,
        lastRunAt: 0,
        runNowRequestedAt: undefined,
        lastSuccessAt: undefined,
        lastFailureAt: undefined,
        lastError: undefined,
        lastDurationMs: undefined,
      });
      created += 1;
    }

    return { created, existing };
  },
});

export const listSettingsInternal = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("cronSettings").order("asc").collect();
  },
});

export const startRunInternal = internalMutation({
  args: {
    name: v.string(),
    startedAt: v.number(),
  },
  returns: v.id("cronRuns"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("cronRuns", {
      name: args.name,
      startedAt: args.startedAt,
      status: "running",
    });
  },
});

export const finishRunInternal = internalMutation({
  args: {
    runId: v.id("cronRuns"),
    finishedAt: v.number(),
    status: v.union(v.literal("success"), v.literal("failure"), v.literal("skipped")),
    error: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    stats: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      finishedAt: args.finishedAt,
      status: args.status,
      error: args.error,
      durationMs: args.durationMs,
      stats: args.stats,
    });
    return null;
  },
});

export const updateSettingAfterRunInternal = internalMutation({
  args: {
    name: v.string(),
    lastRunAt: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("cronSettings")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (!row) {
      // If we somehow ran without a settings row, create a minimal one.
      await ctx.db.insert("cronSettings", {
        name: args.name,
        intervalMs: 60_000,
        enabled: true,
        lastRunAt: args.lastRunAt,
        runNowRequestedAt: undefined,
        lastSuccessAt: args.success ? args.lastRunAt : undefined,
        lastFailureAt: args.success ? undefined : args.lastRunAt,
        lastError: args.success ? undefined : args.error,
        lastDurationMs: args.durationMs,
      });
      return null;
    }

    const patch: any = {
      lastRunAt: args.lastRunAt,
      runNowRequestedAt: undefined,
      lastDurationMs: args.durationMs,
    };
    if (args.success) {
      patch.lastSuccessAt = args.lastRunAt;
      patch.lastError = undefined;
    } else {
      patch.lastFailureAt = args.lastRunAt;
      patch.lastError = args.error ?? "Unknown error";
    }

    await ctx.db.patch(row._id, patch);
    return null;
  },
});

export const tick = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Prevent overlapping ticks.
    const tickLockName = "cron:orchestrator";
    const tickLockStaleMs = 10 * MINUTE;
    const acquired: boolean = await ctx.runMutation(internalRef.maintenance.acquireLock, {
      name: tickLockName,
      staleMs: tickLockStaleMs,
    });
    if (!acquired) {
      console.warn("⏳ Cron orchestrator already running, skipping tick");
      return null;
    }

    try {
      // Ensure the cronSettings table is never empty in a fresh environment.
      await ctx.runMutation(internalRef.cronOrchestrator.ensureDefaultsInternal, {
        defaults: JOBS.map((j) => ({
          name: j.name,
          intervalMs: j.defaultIntervalMs,
          enabled: true,
        })),
      });

      const settingsRaw: any[] = await ctx.runQuery(internalRef.cronOrchestrator.listSettingsInternal, {});
      const settings = new Map<string, CronSettingDoc>();
      for (const row of settingsRaw) {
        if (row && typeof row.name === "string") {
          settings.set(row.name, row as CronSettingDoc);
        }
      }

      const now = Date.now();

      for (const job of JOBS) {
        const cfg = settings.get(job.name);
        const enabled = cfg ? cfg.enabled !== false : true;
        if (!enabled) continue;

        const lastRunAt = cfg?.lastRunAt ?? 0;
        const requestedAt = cfg?.runNowRequestedAt;

        const intervalMs = clampIntervalMs(
          cfg?.intervalMs ?? job.defaultIntervalMs,
          job.minIntervalMs,
          job.maxIntervalMs,
        );

        const forced = typeof requestedAt === "number" && requestedAt > lastRunAt;
        const due = forced || now - lastRunAt >= intervalMs;
        if (!due) continue;

        // Per-job lock to avoid overlap.
        const gotLock: boolean = await ctx.runMutation(internalRef.maintenance.acquireLock, {
          name: job.lockName,
          staleMs: job.lockStaleMs,
        });
        if (!gotLock) {
          continue;
        }

        const startedAt = Date.now();
        const runId: Id<"cronRuns"> = await ctx.runMutation(internalRef.cronOrchestrator.startRunInternal, {
          name: job.name,
          startedAt,
        });

        let success = false;
        let errorMessage: string | undefined;
        let stats: unknown = undefined;

        try {
          if (job.kind === "mutation") {
            stats = await ctx.runMutation(job.ref, {});
          } else {
            stats = await ctx.runAction(job.ref, {});
          }
          success = true;
        } catch (e) {
          errorMessage = e instanceof Error ? e.message : String(e);
          console.error(`❌ Cron job ${job.name} failed:`, e);
        } finally {
          const finishedAt = Date.now();
          const durationMs = finishedAt - startedAt;

          await ctx.runMutation(internalRef.cronOrchestrator.finishRunInternal, {
            runId,
            finishedAt,
            status: success ? "success" : "failure",
            error: success ? undefined : (errorMessage ?? "Unknown error"),
            durationMs,
            stats: stats as any,
          });

          await ctx.runMutation(internalRef.cronOrchestrator.updateSettingAfterRunInternal, {
            name: job.name,
            lastRunAt: finishedAt,
            success,
            error: errorMessage,
            durationMs,
          });

          await ctx.runMutation(internalRef.maintenance.releaseLock, { name: job.lockName });
        }
      }
    } finally {
      await ctx.runMutation(internalRef.maintenance.releaseLock, { name: tickLockName });
    }

    return null;
  },
});

// Seed defaults (useful for deploy scripts / first-run environments)
export const seedDefaults = internalAction({
  args: {},
  returns: v.object({ created: v.number(), existing: v.number() }),
  handler: async (ctx) => {
    const result: { created: number; existing: number } = await ctx.runMutation(
      internalRef.cronOrchestrator.ensureDefaultsInternal,
      {
        defaults: JOBS.map((j) => ({
          name: j.name,
          intervalMs: j.defaultIntervalMs,
          enabled: true,
        })),
      },
    );
    return result;
  },
});

// Admin UI helper: recent cron run history
export const getRecentRuns = query({
  args: {
    name: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 50;

    if (args.name) {
      return await ctx.db
        .query("cronRuns")
        .withIndex("by_name", (q) => q.eq("name", args.name!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("cronRuns").withIndex("by_started_at").order("desc").take(limit);
  },
});

