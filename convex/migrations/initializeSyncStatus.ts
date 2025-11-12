import { internalMutation } from "../_generated/server";

/**
 * Migration: Initialize syncStatus table with global coordinator record
 * This table should always have exactly 1 record for global sync coordination
 */
export const initializeSyncStatus = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if syncStatus already has a record
    const existing = await ctx.db.query("syncStatus").first();
    
    if (existing) {
      console.log("✅ syncStatus table already initialized");
      return { created: false, recordId: existing._id };
    }
    
    // Create initial global sync status record
    const id = await ctx.db.insert("syncStatus", {
      isActive: false,
      currentPhase: "idle",
      lastSync: Date.now(),
    });
    
    console.log("✅ Created initial syncStatus record:", id);
    return { created: true, recordId: id };
  },
});
