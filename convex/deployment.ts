"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// This function runs on every deployment
export const onDeploy = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🚀 Running deployment tasks...");
    
    try {
      // Trigger trending data sync to populate homepage
      console.log("📊 Syncing trending data...");
      await ctx.runAction(internal.maintenance.syncTrendingData, {});
      
      console.log("✅ Deployment tasks completed successfully");
    } catch (error) {
      console.error("❌ Deployment tasks failed:", error);
    }
    
    return null;
  },
});