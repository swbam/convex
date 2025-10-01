"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import crypto from "crypto";

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
    
    // Verify webhook signature if secret is configured
    if (WEBHOOK_SECRET && args.svixId && args.svixTimestamp && args.svixSignature) {
      try {
        // Reconstruct the signed content
        const signedContent = `${args.svixId}.${args.svixTimestamp}.${JSON.stringify(args.event)}`;
        
        // Get the expected signature (Svix uses HMAC SHA256)
        const secret = WEBHOOK_SECRET.startsWith('whsec_') 
          ? Buffer.from(WEBHOOK_SECRET.slice(6), 'base64')
          : Buffer.from(WEBHOOK_SECRET);
        
        const expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(signedContent)
          .digest('base64');
        
        // Svix sends multiple signatures (v1=...), we check if any match
        const signatures = args.svixSignature.split(' ');
        const isValid = signatures.some(sig => {
          const [version, signature] = sig.split('=');
          return version === 'v1' && signature === expectedSignature;
        });
        
        if (!isValid) {
          console.error('❌ Webhook signature verification failed');
          throw new Error('Invalid webhook signature');
        }
        
        console.log('✅ Webhook signature verified');
      } catch (error) {
        console.error('❌ Webhook verification error:', error);
        throw error;
      }
    } else if (WEBHOOK_SECRET) {
      console.warn('⚠️ Webhook secret configured but headers missing');
    }
    
    const event = args.event;
    console.log('🔵 Processing Clerk webhook:', event.type);
    
    if (event.type === "user.created") {
      await ctx.runMutation(internal.users.createFromClerk, { clerkUser: event.data });
    } else if (event.type === "user.updated") {
      await ctx.runMutation(internal.users.updateFromClerk, { clerkUser: event.data });
    }
    
    return null;
  },
});

