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
    rawBody: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    // Enforce Svix verification in production; allow best-effort in dev
    const isProd = process.env.NODE_ENV === 'production';
    try {
      if (!WEBHOOK_SECRET) {
        const msg = 'CLERK_WEBHOOK_SECRET not configured';
        if (isProd) {
          console.error(`❌ ${msg}`);
          throw new Error('UNAUTHORIZED');
        } else {
          console.warn(`⚠️ ${msg} - skipping verification in development`);
        }
      } else {
        // Require headers and raw body for verification
        const { svixId, svixTimestamp, svixSignature, rawBody } = args;
        if (!svixId || !svixTimestamp || !svixSignature || !rawBody) {
          const msg = 'Missing Svix headers or raw body for verification';
          if (isProd) {
            console.error(`❌ ${msg}`);
            throw new Error('UNAUTHORIZED');
          } else {
            console.warn(`⚠️ ${msg} - skipping verification in development`);
          }
        } else {
          const wh = new Webhook(WEBHOOK_SECRET);
          try {
            wh.verify(rawBody, {
              'svix-id': svixId,
              'svix-timestamp': svixTimestamp,
              'svix-signature': svixSignature,
            } as Record<string, string>);
            console.log('✅ Webhook signature verified');
          } catch (e) {
            if (isProd) {
              console.error('❌ Webhook signature verification failed');
              throw new Error('UNAUTHORIZED');
            } else {
              console.warn('⚠️ Webhook signature verification failed - continuing in development', e);
            }
          }
        }
      }
    } catch (verificationError) {
      // Surface as UNAUTHORIZED to HTTP layer
      throw verificationError;
    }
    
    const event = args.event as WebhookEvent;
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

