import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Get active sync jobs for progress display
export const getActive = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const activeJobs = await ctx.db
      .query("syncJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(5);

    return activeJobs;
  },
});

// Simple job status update
export const updateJobStatus = internalMutation({
  args: {
    jobId: v.id("syncJobs"),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.status,
    });
    return null;
  },
});