import { internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./admin";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const ORCHESTRATED_JOB_BOUNDS: Record<
  string,
  { minIntervalMs: number; maxIntervalMs: number; defaultIntervalMs: number }
> = {
  "update-trending": { minIntervalMs: 60 * MINUTE, maxIntervalMs: 24 * HOUR, defaultIntervalMs: 6 * HOUR },
  "refresh-trending-cache": { minIntervalMs: 6 * HOUR, maxIntervalMs: 48 * HOUR, defaultIntervalMs: 12 * HOUR },
  "update-artist-trending": { minIntervalMs: 60 * MINUTE, maxIntervalMs: 24 * HOUR, defaultIntervalMs: 6 * HOUR },
  "update-show-trending": { minIntervalMs: 60 * MINUTE, maxIntervalMs: 24 * HOUR, defaultIntervalMs: 6 * HOUR },
  "update-artist-show-counts": { minIntervalMs: 60 * MINUTE, maxIntervalMs: 24 * HOUR, defaultIntervalMs: 6 * HOUR },
  "auto-transition-shows": { minIntervalMs: 60 * MINUTE, maxIntervalMs: 24 * HOUR, defaultIntervalMs: 4 * HOUR },
  "populate-missing-fields": { minIntervalMs: 2 * HOUR, maxIntervalMs: 48 * HOUR, defaultIntervalMs: 8 * HOUR },
  "spotify-refresh": { minIntervalMs: 2 * HOUR, maxIntervalMs: 48 * HOUR, defaultIntervalMs: 12 * HOUR },
};

function clampIntervalMs(name: string, intervalMs: number): number {
  const bounds = ORCHESTRATED_JOB_BOUNDS[name];
  const value = Number.isFinite(intervalMs) ? Math.floor(intervalMs) : MINUTE;
  if (!bounds) {
    // Safe generic clamp for unknown jobs.
    return Math.max(MINUTE, Math.min(7 * 24 * HOUR, value));
  }
  return Math.max(bounds.minIntervalMs, Math.min(bounds.maxIntervalMs, value));
}

export const getByNameInternal = internalQuery({
  args: { name: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.query("cronSettings").withIndex("by_name", (q) => q.eq("name", args.name)).first();
  },
});

export const upsertInternal = internalMutation({
  args: {
    name: v.string(),
    intervalMs: v.number(),
    enabled: v.boolean(),
    lastRunAt: v.optional(v.number()),
    runNowRequestedAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    lastDurationMs: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("cronSettings").withIndex("by_name", (q) => q.eq("name", args.name)).first();
    if (existing) {
      const { name, ...rest } = args;
      await ctx.db.patch(existing._id, rest);
      return { ...existing, ...rest, _id: existing._id };
    }
    const id = await ctx.db.insert("cronSettings", {
      name: args.name,
      intervalMs: args.intervalMs,
      enabled: args.enabled,
      lastRunAt: args.lastRunAt,
      runNowRequestedAt: args.runNowRequestedAt,
      lastSuccessAt: args.lastSuccessAt,
      lastFailureAt: args.lastFailureAt,
      lastError: args.lastError,
      lastDurationMs: args.lastDurationMs,
    });
    return await ctx.db.get(id);
  },
});

export const list = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("cronSettings").order("asc").collect();
  },
});

export const update = mutation({
  args: {
    name: v.string(),
    intervalMs: v.number(),
    enabled: v.boolean(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const actorUserId = await requireAdmin(ctx);
    const boundedIntervalMs = clampIntervalMs(args.name, args.intervalMs);
    const existing = await ctx.db.query("cronSettings").withIndex("by_name", (q) => q.eq("name", args.name)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { intervalMs: boundedIntervalMs, enabled: args.enabled });
    } else {
      const bounds = ORCHESTRATED_JOB_BOUNDS[args.name];
      await ctx.db.insert("cronSettings", {
        name: args.name,
        intervalMs: bounds ? bounds.defaultIntervalMs : boundedIntervalMs,
        enabled: args.enabled,
        lastRunAt: 0,
        runNowRequestedAt: undefined,
        lastSuccessAt: undefined,
        lastFailureAt: undefined,
        lastError: undefined,
        lastDurationMs: undefined,
      });
    }
    await ctx.db.insert("adminAuditLogs", {
      actorUserId,
      action: "cronSettings.update",
      args: { name: args.name, intervalMs: boundedIntervalMs, enabled: args.enabled },
      createdAt: Date.now(),
      success: true,
    });
    return { success: true };
  },
});

export const requestRunNow = mutation({
  args: { name: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const actorUserId = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("cronSettings")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { runNowRequestedAt: now, enabled: true });
    } else {
      const bounds = ORCHESTRATED_JOB_BOUNDS[args.name];
      await ctx.db.insert("cronSettings", {
        name: args.name,
        intervalMs: bounds ? bounds.defaultIntervalMs : MINUTE,
        enabled: true,
        lastRunAt: 0,
        runNowRequestedAt: now,
        lastSuccessAt: undefined,
        lastFailureAt: undefined,
        lastError: undefined,
        lastDurationMs: undefined,
      });
    }
    await ctx.db.insert("adminAuditLogs", {
      actorUserId,
      action: "cronSettings.requestRunNow",
      args: { name: args.name },
      createdAt: now,
      success: true,
    });
    return { success: true };
  },
});


