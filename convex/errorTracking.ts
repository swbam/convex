/**
 * Centralized error tracking for Convex backend
 * Captures errors from imports, syncs, votes, and setlist operations
 */

import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

// Export as public mutation for now (can be made internal later with proper API routing)
export const logError = internalMutation({
  args: {
    operation: v.string(),
    error: v.string(),
    context: v.optional(v.object({
      artistId: v.optional(v.id("artists")),
      showId: v.optional(v.id("shows")),
      setlistId: v.optional(v.id("setlists")),
      userId: v.optional(v.id("users")),
      artistName: v.optional(v.string()),
      showDate: v.optional(v.string()),
      additionalData: v.optional(v.any()),
    })),
    severity: v.optional(v.union(
      v.literal("error"),
      v.literal("warning"),
      v.literal("info")
    )),
  },
  returns: v.id("errorLogs"),
  handler: async (ctx, args) => {
    // Store error in database for tracking
    const errorId = await ctx.db.insert("errorLogs", {
      operation: args.operation,
      error: args.error,
      context: args.context,
      severity: args.severity || "error",
      timestamp: Date.now(),
      resolved: false,
    });

    // Log to console for immediate visibility
    const emoji = args.severity === "error" ? "❌" : 
                  args.severity === "warning" ? "⚠️" : "ℹ️";
    
    console.error(
      `${emoji} [${args.operation}] ${args.error}`,
      args.context ? JSON.stringify(args.context, null, 2) : ""
    );

    // Forward to Sentry via scheduler (mutations can't call actions directly)
    try {
      if (process.env.SENTRY_DSN) {
        void ctx.scheduler.runAfter(0, internalRef.admin.sentryForward.forward, {
          operation: args.operation,
          error: args.error,
          context: args.context,
          severity: args.severity || "error",
        });
        // Mark as sent to Sentry (scheduler will handle delivery)
        await ctx.db.patch(errorId, { sentToSentry: true });
      }
    } catch (e) {
      // Swallow Sentry forwarding errors
    }

    return errorId;
  },
});

export const getRecentErrors = internalMutation({
  args: {
    limit: v.optional(v.number()),
    operation: v.optional(v.string()),
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
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    
    let query = ctx.db
      .query("errorLogs")
      .order("desc");
    
    if (args.operation) {
      query = query.filter((q) => q.eq(q.field("operation"), args.operation));
    }
    
    return await query.take(limit);
  },
});

export const markErrorResolved = internalMutation({
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

