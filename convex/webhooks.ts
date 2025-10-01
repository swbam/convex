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

    // Verify webhook signature using official Svix library
    if (WEBHOOK_SECRET && args.svixId && args.svixTimestamp && args.svixSignature) {
      try {
        const payloadString = JSON.stringify(args.event);
        const svixHeaders = {
          "svix-id": args.svixId,
          "svix-timestamp": args.svixTimestamp,
          "svix-signature": args.svixSignature,
        };

        const wh = new Webhook(WEBHOOK_SECRET);

        // This will throw an error if verification fails
        const evt = wh.verify(payloadString, svixHeaders) as WebhookEvent;

        console.log('✅ Webhook signature verified');

        // Process the verified event
        console.log('🔵 Processing Clerk webhook:', evt.type);

        switch (evt.type) {
          case "user.created":
          case "user.updated":
            await ctx.runMutation(internal.users.upsertFromClerk, {
              clerkUser: evt.data,
            });
            break;

          case "user.deleted": {
            const clerkUserId = evt.data.id;
            if (clerkUserId) {
              await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
            }
            break;
          }

          default:
            console.log(`Ignored Clerk webhook event: ${evt.type}`);
        }

      } catch (error) {
        console.error('❌ Webhook verification error:', error);
        throw new Error('Invalid webhook signature');
      }
    } else if (WEBHOOK_SECRET) {
      console.warn('⚠️ Webhook secret configured but headers missing');
    } else {
      console.warn('⚠️ No webhook secret configured - processing webhook without verification (DEV ONLY)');

      // Dev mode - process without verification
      const event = args.event;
      console.log('🔵 Processing Clerk webhook (UNVERIFIED):', event.type);

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
    }

    return null;
  },
});

