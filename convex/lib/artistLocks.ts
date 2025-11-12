import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Artist Update Locks
 * Prevents write conflicts when multiple functions try to update same artist
 * Lock is automatically released after 30 seconds (stale lock cleanup)
 */
export const artistUpdateLocks = defineTable({
  artistId: v.id("artists"),
  lockedBy: v.string(), // Operation name that acquired the lock
  lockedAt: v.number(),
  expiresAt: v.number(), // Auto-expire after 30 seconds
})
  .index("by_artist", ["artistId"])
  .index("by_expiry", ["expiresAt"]);
