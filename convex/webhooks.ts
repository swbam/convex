"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/backend";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

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
          await ctx.runMutation(internalRef.errorTracking.logError, {
            operation: "clerk_webhook_verification",
            error: msg,
            context: { additionalData: { reason: "missing_secret" } },
            severity: "error",
          });
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
            await ctx.runMutation(internalRef.errorTracking.logError, {
              operation: "clerk_webhook_verification",
              error: msg,
              context: { additionalData: { reason: "missing_headers" } },
              severity: "error",
            });
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
              await ctx.runMutation(internalRef.errorTracking.logError, {
                operation: "clerk_webhook_verification",
                error: "signature_verification_failed",
                context: { additionalData: { reason: "bad_signature" } },
                severity: "error",
              });
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

    // Idempotency: skip if we've already processed this Clerk event id
    const eventId = (event as any).id as string | undefined;
    if (eventId) {
      const existing = await ctx.runQuery(
        internalRef.clerkWebhookEvents.getProcessedClerkWebhookEventInternal,
        { eventId },
      );
      if (existing) {
        console.log(
          `⏭️ Duplicate Clerk webhook ${event.type} (${eventId}) – already processed`,
        );
        return null;
      }
    }

    switch (event.type) {
      case "user.created":
      case "user.updated":
        await ctx.runMutation(internalRef.users.upsertFromClerk, {
          clerkUser: event.data,
        });
        break;

      case "user.deleted": {
        const clerkUserId = event.data.id;
        if (clerkUserId) {
          await ctx.runMutation(internalRef.users.deleteFromClerk, { clerkUserId });
        }
        break;
      }

      default:
        console.log(`Ignored Clerk webhook event: ${event.type}`);
    }

    if (eventId) {
      await ctx.runMutation(internalRef.clerkWebhookEvents.markClerkWebhookEventProcessedInternal, {
        eventId,
        eventType: event.type,
      });
    }

    return null;
  },
});
