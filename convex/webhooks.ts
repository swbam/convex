"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import crypto from "crypto";

export const handleClerkWebhook = internalAction({
  args: { event: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = args.event;
    
    // Verify signature if needed (in production)
    // const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    // ... crypto verification here
    
    if (event.type === "user.created") {
      await ctx.runMutation(internal.users.createFromClerk, { clerkUser: event.data });
    } else if (event.type === "user.updated") {
      await ctx.runMutation(internal.users.updateFromClerk, { clerkUser: event.data });
    }
    
    return null;
  },
});

