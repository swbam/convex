import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// One-time fix: Delete all empty setlists and regenerate
export const deleteEmptySetlistsAndRegenerate = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ 
    deleted: v.number(), 
    scheduled: v.number() 
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    console.log(`🔍 Finding empty setlists (limit: ${limit})...`);
    
    // Get all setlists
    const allSetlists = await ctx.db.query("setlists").take(limit * 2);
    
    // Filter for empty non-official setlists
    const emptySetlists = allSetlists.filter(s => 
      !s.isOfficial && 
      (!s.songs || s.songs.length === 0)
    );
    
    console.log(`📊 Found ${emptySetlists.length} empty setlists`);
    
    let deleted = 0;
    const showsToRegenerate = new Set<string>();
    
    // Delete empty setlists
    for (const setlist of emptySetlists.slice(0, limit)) {
      try {
        await ctx.db.delete(setlist._id);
        deleted++;
        showsToRegenerate.add(setlist.showId);
        console.log(`🗑️ Deleted empty setlist ${setlist._id}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${setlist._id}:`, error);
      }
    }
    
    // Schedule regeneration with staggered delays
    let scheduled = 0;
    const showIds = Array.from(showsToRegenerate);
    
    for (let i = 0; i < showIds.length; i++) {
      const showIdStr = showIds[i];
      
      try {
        // Query shows table to find the show
        const shows = await ctx.db.query("shows").collect();
        const show = shows.find(s => s._id === showIdStr);
        
        if (!show || !show.artistId) {
          console.log(`⚠️ Show ${showIdStr} not found or missing artistId`);
          continue;
        }
        
        // Schedule with 10 second delays
        const delayMs = i * 10000;
        void ctx.scheduler.runAfter(delayMs, internal.setlists.autoGenerateSetlist, {
          showId: show._id,
          artistId: show.artistId,
        });
        scheduled++;
        console.log(`📅 Scheduled regeneration for show ${showIdStr}`);
      } catch (error) {
        console.error(`❌ Failed to schedule ${showIdStr}:`, error);
      }
    }
    
    console.log(`✅ Deleted ${deleted} empty setlists, scheduled ${scheduled} regenerations`);
    
    return { deleted, scheduled };
  },
});
