/**
 * Admin functions for monitoring backend errors
 */

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";

export const getRecentErrors = query({
  args: {
    limit: v.optional(v.number()),
    operation: v.optional(v.string()),
    severity: v.optional(v.union(v.literal("error"), v.literal("warning"), v.literal("info"))),
    onlyUnresolved: v.optional(v.boolean()),
  },
  returns: v.array(v.object({
    _id: v.id("errorLogs"),
    _creationTime: v.number(),
    operation: v.string(),
    error: v.string(),
    context: v.optional(v.any()),
    severity: v.string(),
    timestamp: v.number(),
    resolved: v.boolean(),
    sentToSentry: v.optional(v.boolean()),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    
    let query = ctx.db
      .query("errorLogs")
      .withIndex("by_timestamp")
      .order("desc");
    
    let errors = await query.take(limit * 2); // Get more to filter
    
    // Apply filters
    if (args.operation) {
      errors = errors.filter(e => e.operation === args.operation);
    }
    
    if (args.severity) {
      errors = errors.filter(e => e.severity === args.severity);
    }
    
    if (args.onlyUnresolved) {
      errors = errors.filter(e => !e.resolved);
    }
    
    return errors.slice(0, limit);
  },
});

export const getErrorStats = query({
  args: {},
  returns: v.object({
    total: v.number(),
    byOperation: v.any(),
    bySeverity: v.object({
      error: v.number(),
      warning: v.number(),
      info: v.number(),
    }),
    unresolved: v.number(),
    last24Hours: v.number(),
  }),
  handler: async (ctx) => {
    const allErrors = await ctx.db
      .query("errorLogs")
      .collect();
    
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    
    const stats = {
      total: allErrors.length,
      byOperation: {} as Record<string, number>,
      bySeverity: {
        error: 0,
        warning: 0,
        info: 0,
      },
      unresolved: 0,
      last24Hours: 0,
    };
    
    for (const error of allErrors) {
      // Count by operation
      stats.byOperation[error.operation] = (stats.byOperation[error.operation] || 0) + 1;
      
      // Count by severity
      if (error.severity === "error") stats.bySeverity.error++;
      if (error.severity === "warning") stats.bySeverity.warning++;
      if (error.severity === "info") stats.bySeverity.info++;
      
      // Count unresolved
      if (!error.resolved) stats.unresolved++;
      
      // Count last 24h
      if (error.timestamp >= last24h) stats.last24Hours++;
    }
    
    return stats;
  },
});

export const markResolved = mutation({
  args: {
    errorId: v.id("errorLogs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.errorId, {
      resolved: true,
    });
    return null;
  },
});

export const markSentToSentry = mutation({
  args: {
    errorId: v.id("errorLogs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.errorId, {
      sentToSentry: true,
    });
    return null;
  },
});

export const deleteError = mutation({
  args: {
    errorId: v.id("errorLogs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.errorId);
    return null;
  },
});

