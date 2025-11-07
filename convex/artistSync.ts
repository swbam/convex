/**
 * Artist sync status tracking helpers
 * Manages progressive import states for smooth UX
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const updateSyncStatus = internalMutation({
  args: {
    artistId: v.id("artists"),
    showsImported: v.optional(v.boolean()),
    catalogImported: v.optional(v.boolean()),
    basicsEnriched: v.optional(v.boolean()),
    showCount: v.optional(v.number()),
    songCount: v.optional(v.number()),
    phase: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const artist = await ctx.db.get(args.artistId);
    if (!artist) {
      console.warn(`Artist ${args.artistId} not found for sync status update`);
      return null;
    }

    const currentStatus = artist.syncStatus || {
      showsImported: false,
      catalogImported: false,
      basicsEnriched: false,
      lastSync: Date.now(),
    };

    const updates: any = {};
    
    // Update individual flags
    if (args.showsImported !== undefined) {
      currentStatus.showsImported = args.showsImported;
    }
    if (args.catalogImported !== undefined) {
      currentStatus.catalogImported = args.catalogImported;
    }
    if (args.basicsEnriched !== undefined) {
      currentStatus.basicsEnriched = args.basicsEnriched;
    }
    if (args.showCount !== undefined) {
      currentStatus.showCount = args.showCount;
    }
    if (args.songCount !== undefined) {
      currentStatus.songCount = args.songCount;
    }
    if (args.phase !== undefined) {
      currentStatus.phase = args.phase;
    }
    if (args.error !== undefined) {
      currentStatus.error = args.error;
    }
    
    currentStatus.lastSync = Date.now();

    await ctx.db.patch(args.artistId, {
      syncStatus: currentStatus,
    });

    console.log(`✅ Updated sync status for artist ${args.artistId}:`, currentStatus);
    return null;
  },
});

export const initializeSyncStatus = internalMutation({
  args: {
    artistId: v.id("artists"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.artistId, {
      syncStatus: {
        showsImported: false,
        catalogImported: false,
        basicsEnriched: false,
        phase: "shows",
        lastSync: Date.now(),
      },
    });
    return null;
  },
});

