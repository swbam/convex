import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// NO SAMPLE DATA - REMOVED COMPLETELY
export const seedSampleData = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("Sample data seeding disabled - using real data only");
    return;
  },
});
