import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Clerk webhook idempotency helpers.
// NOTE: These must live in a non-Node Convex module (queries/mutations are not allowed in `"use node"` files).

export const getProcessedClerkWebhookEventInternal = internalQuery({
  args: { eventId: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clerkWebhookEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();
  },
});

export const markClerkWebhookEventProcessedInternal = internalMutation({
  args: { eventId: v.string(), eventType: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("clerkWebhookEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      processedAt: Date.now(),
    });
    return null;
  },
});


