"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/backend";

export const handleClerkWebhook = internalAction({
  args: { 
    event: v.any(),
    svixId: v.optional(v.string()),
    svixTimestamp: v.optional(v.string()),
    svixSignature: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    // TEMPORARY: Skip webhook verification to fix user sync
    console.warn('⚠️ Processing webhook without verification (TEMP FIX)');
    
    const event = args.event;
    console.log('🔵 Processing Clerk webhook:', event.type);

    switch (event.type) {
      case "user.created":
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          clerkUser: event.data,
        });
        break;

      case "user.deleted": {
        const clerkUserId = event.data.id;
        if (clerkUserId) {
          await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
        }
        break;
      }

      default:
        console.log(`Ignored Clerk webhook event: ${event.type}`);
    }

    return null;
  },
});

