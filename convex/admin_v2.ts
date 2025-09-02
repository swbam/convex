import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// Simplified trending sync for admin dashboard
export const syncTrending = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    // Check admin permissions
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      // Run the trending sync
      await ctx.runAction(internal.maintenance_v2.syncTrendingData, {});
      
      return {
        success: true,
        message: "Trending data updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to sync trending data",
      };
    }
  },
});