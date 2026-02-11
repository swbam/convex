"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internalRef } from "./adminHelpers";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any


// This function runs on every deployment
export const onDeploy = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🚀 Running deployment tasks...");

    try {
      // Ensure cron settings are seeded so the admin dashboard is immediately usable.
      console.log("⏱️ Seeding cron settings defaults...");
      await ctx.runAction(internalRef.cronOrchestrator.seedDefaults, {});

      // CRITICAL: Ensure admin user exists on deployment
      // Method 1: By exact Clerk authId (most reliable - this is the real user's Clerk ID)
      console.log("🔑 Promoting admin by authId...");
      const authIdResult = await ctx.runMutation(internalRef.admin.ensureAdminByAuthIdInternal, {
        authId: "user_33qVgVzns9yEH5HdXnl9chwTvAO"  // sethbamb@gmail.com's Clerk ID
      });
      if (authIdResult.updated) {
        console.log("✅ Admin user promoted via authId");
      } else if (authIdResult.userId) {
        console.log("ℹ️ Admin user already exists (via authId)");
      } else {
        console.log("⚠️ User not found by authId, trying email...");
      }

      // Method 2: By email (fallback - promotes ALL users with this email)
      console.log("🔑 Ensuring admin by email (fallback)...");
      const emailResult = await ctx.runMutation(internalRef.admin.ensureAdminByEmailInternal, {
        email: "sethbamb@gmail.com"
      });
      if (emailResult.updated > 0) {
        console.log(`✅ Promoted ${emailResult.updated} user(s) via email`);
      } else {
        console.log("ℹ️ All users with this email are already admin");
      }

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
