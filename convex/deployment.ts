"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

// This function runs on every deployment
export const onDeploy = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🚀 Running deployment tasks...");
    
    try {
      // Update trending rankings on deployment
      console.log("📊 Updating trending rankings...");
      await ctx.runAction(internalRef.maintenance.syncTrendingData, {});
      
      console.log("✅ Deployment tasks completed successfully");
    } catch (error) {
      console.error("❌ Deployment tasks failed:", error);
    }
    
    return null;
  },
});
