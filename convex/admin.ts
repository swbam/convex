import { action, mutation, query, internalAction, internalMutation, internalQuery, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Helper function to check if user is admin
export const requireAdmin = async (ctx: QueryCtx | MutationCtx): Promise<Id<"users">> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Must be logged in");
  }
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
    .first();
  
  if (!user) {
    throw new Error("User not found");
  }
  
  if (user.role !== "admin") {
    throw new Error("Admin access required");
  }
  
  return user._id;
};

// Check if current user is admin (for frontend)
export const isCurrentUserAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .first();
    
    return user?.role === "admin" || false;
  },
});

// ===== USER MANAGEMENT =====

export const getAllUsers = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx); // Admin access required
    const limit = args.limit || 50;
    const users = await ctx.db.query("users").order("desc").take(limit);
    return users;
  },
});

export const toggleUserBan = mutation({
  args: { userId: v.id("users") },
  returns: v.object({ success: v.boolean(), newRole: v.string() }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    // Simplify: toggle between admin and user (no banned role in schema)
    const newRole = user.role === "admin" ? "user" : "admin";
    await ctx.db.patch(args.userId, { role: newRole });
    return { success: true, newRole };
  },
});

// Promote a user to admin by email (case-insensitive)
export const promoteUserByEmail = mutation({
  args: { email: v.string() },
  returns: v.object({ success: v.boolean(), promoted: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const targetEmail = args.email.toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) {
      // Try case-insensitive scan if exact not found
      const users = await ctx.db.query("users").collect();
      const match = users.find(u => (u.email || "").toLowerCase() === targetEmail);
      if (!match) return { success: true, promoted: false };
      await ctx.db.patch(match._id, { role: "admin" });
      return { success: true, promoted: true };
    }
    if (user.role !== "admin") {
      await ctx.db.patch(user._id, { role: "admin" });
      return { success: true, promoted: true };
    }
    return { success: true, promoted: false };
  },
});

// Optionally update Clerk metadata role for a user by email (requires CLERK_SECRET_KEY)
export const setClerkRoleByEmail = action({
  args: { email: v.string(), role: v.union(v.literal("user"), v.literal("admin")) },
  returns: v.object({ success: v.boolean(), clerkUpdated: v.boolean(), message: v.string() }),
  handler: async (_ctx, args) => {
    try {
      const secret = process.env.CLERK_SECRET_KEY;
      if (!secret) {
        return { success: true, clerkUpdated: false, message: "CLERK_SECRET_KEY not configured" };
      }
      const base = "https://api.clerk.com/v1";
      const search = await fetch(`${base}/users?email_address=${encodeURIComponent(args.email)}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (!search.ok) {
        return { success: false, clerkUpdated: false, message: `Clerk search failed: ${search.status}` };
      }
      const users = await search.json() as Array<any>;
      if (!Array.isArray(users) || users.length === 0) {
        return { success: false, clerkUpdated: false, message: "No Clerk user found for email" };
      }
      const id = users[0].id;
      const patch = await fetch(`${base}/users/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ public_metadata: { role: args.role } }),
      });
      if (!patch.ok) {
        return { success: false, clerkUpdated: false, message: `Clerk update failed: ${patch.status}` };
      }
      return { success: true, clerkUpdated: true, message: "Clerk role updated" };
    } catch (e: any) {
      return { success: false, clerkUpdated: false, message: e?.message || "Unknown error" };
    }
  },
});

// Internal: Ensure a user is admin by email (no auth required, for deploy scripts)
export const ensureAdminByEmailInternal = internalMutation({
  args: { email: v.string() },
  returns: v.object({ success: v.boolean(), updated: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(internal.users.getByEmailCaseInsensitive, { email: args.email });
    if (!existing) return { success: true, updated: false };
    if (existing.role !== "admin") {
      await ctx.runMutation(internal.users.setUserRoleById, { userId: existing._id, role: "admin" });
      return { success: true, updated: true };
    }
    return { success: true, updated: false };
  },
});

// Internal: Get admin stats without auth (for testing)
export const getAdminStatsInternal = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx: QueryCtx) => {
    const users = await ctx.db.query("users").collect();
    const artists = await ctx.db.query("artists").collect();
    const shows = await ctx.db.query("shows").collect();
    const setlists = await ctx.db.query("setlists").collect();
    const votes = await ctx.db.query("votes").collect();
    
    return {
      totalUsers: users.length,
      totalArtists: artists.length,
      totalShows: shows.length,
      totalSetlists: setlists.length,
      totalVotes: votes.length,
      adminUsers: users.filter((u: any) => u.role === "admin").length,
      activeArtists: artists.filter((a: any) => a.isActive).length,
      upcomingShows: shows.filter((s: any) => s.status === "upcoming").length,
    };
  },
});

// ===== CONTENT MODERATION =====

export const flagContent = mutation({
  args: {
    contentType: v.union(v.literal("setlist"), v.literal("vote"), v.literal("comment")),
    contentId: v.string(),
    reason: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const authId = await ctx.auth.getUserIdentity();
    if (!authId) throw new Error("Must be logged in to flag content");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", authId.subject))
      .unique();
    
    if (!user) throw new Error("User not found");
    
    await ctx.db.insert("contentFlags", {
      contentType: args.contentType,
      contentId: args.contentId,
      reason: args.reason,
      reporterId: user._id,
      createdAt: Date.now(),
      status: "pending",
    });
    
    return { success: true };
  },
});

export const getFlaggedContent = query({
  args: { 
    status: v.optional(v.union(v.literal("pending"), v.literal("resolved"), v.literal("dismissed")))
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx); // Admin access required
    const query = ctx.db.query("contentFlags");
    
    if (args.status) {
      return await query.filter((q) => q.eq(q.field("status"), args.status)).collect();
    }
    
    return await query.collect();
  },
});

// ===== SETLIST MANAGEMENT =====

export const verifySetlist = mutation({
  args: {
    setlistId: v.id("setlists"),
    verified: v.boolean(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx); // ENHANCED: Require admin access
    
    await ctx.db.patch(args.setlistId, { 
      verified: args.verified,
      lastUpdated: Date.now(), // Update timestamp
    });
    
    console.log(`✅ Setlist ${args.setlistId} verification: ${args.verified}`);
    return { success: true };
  },
});

// NEW: Dismiss flagged content
export const dismissFlag = mutation({
  args: {
    flagId: v.id("contentFlags"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    
    await ctx.db.patch(args.flagId, {
      status: "dismissed",
      reviewedBy: adminId,
      reviewedAt: Date.now(),
    });
    
    console.log(`✅ Flag ${args.flagId} dismissed by admin ${adminId}`);
    return { success: true };
  },
});

// NEW: Resolve flagged content (mark as reviewed)
export const resolveFlag = mutation({
  args: {
    flagId: v.id("contentFlags"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    
    await ctx.db.patch(args.flagId, {
      status: "reviewed",
      reviewedBy: adminId,
      reviewedAt: Date.now(),
    });
    
    console.log(`✅ Flag ${args.flagId} resolved by admin ${adminId}`);
    return { success: true };
  },
});

// ===== ANALYTICS & STATISTICS =====

export const getAdminStats = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    await requireAdmin(ctx); // Admin access required
    
    try {
      const [users, artists, shows, setlists, votes] = await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("artists").collect(),
        ctx.db.query("shows").collect(),
        ctx.db.query("setlists").collect(),
        ctx.db.query("votes").collect(),
      ]);
      
      // Calculate trending metrics with safe fallbacks
      const activeUsers = users.length;
      const last7Days = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const recentVotes = votes.filter(v => v.createdAt && v.createdAt > last7Days).length;
      
      // Top voted setlists with error handling
      const setlistVoteCounts = new Map<Id<"setlists">, number>();
      votes.forEach(vote => {
        if (vote.setlistId) {
          const count = setlistVoteCounts.get(vote.setlistId) || 0;
          setlistVoteCounts.set(vote.setlistId, count + 1);
        }
      });
      
      const topSetlists = Array.from(setlistVoteCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(async ([setlistId, voteCount]) => {
          try {
            const setlist = await ctx.db.get(setlistId);
            if (!setlist) return null;
            
            const show = setlist.showId ? await ctx.db.get(setlist.showId) : null;
            const artist = show && show.artistId ? await ctx.db.get(show.artistId) : null;
            
            return {
              setlistId,
              voteCount,
              showName: show && artist ? `${artist.name} - ${show.date}` : "Unknown",
            };
          } catch (error) {
            console.error(`Error processing setlist ${setlistId}:`, error);
            return null;
          }
        });
      
      const topSetlistsResolved = (await Promise.all(topSetlists)).filter(Boolean);
      
      return {
        totalUsers: users.length,
        activeUsers,
        bannedUsers: 0,
        totalArtists: artists.length,
        totalShows: shows.length,
        upcomingShows: shows.filter(s => s.status === "upcoming").length,
        totalSetlists: setlists.length,
        officialSetlists: setlists.filter(s => s.isOfficial === true).length,
        totalVotes: votes.length,
        recentVotes,
        topSetlists: topSetlistsResolved,
      };
    } catch (error) {
      console.error("Error in getAdminStats:", error);
      // Return safe defaults if query fails
      return {
        totalUsers: 0,
        activeUsers: 0,
        bannedUsers: 0,
        totalArtists: 0,
        totalShows: 0,
        upcomingShows: 0,
        totalSetlists: 0,
        officialSetlists: 0,
        totalVotes: 0,
        recentVotes: 0,
        topSetlists: [],
      };
    }
  },
});

// ===== OPTIMIZED TRENDING SYNC =====

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
      console.log("📊 Admin triggered trending sync...");
      
      // Use the optimized maintenance action to sync trending data
      await ctx.runAction(internal.maintenance.syncTrendingData, {});
      
      return {
        success: true,
        message: "Successfully updated trending rankings for artists and shows",
      };
    } catch (error) {
      console.error("❌ Failed to sync trending data:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});

// Separate actions to sync artists vs shows trending (for admin buttons)
export const syncTrendingArtists = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }
    try {
      await ctx.runMutation(internal.trending.updateArtistShowCounts, {});
      await ctx.runMutation(internal.trending.updateArtistTrending, {});
      return { success: true, message: "Artists trending updated" };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "Unknown error" };
    }
  },
});

export const syncTrendingShows = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }
    try {
      await ctx.runMutation(internal.trending.updateShowTrending, {});
      return { success: true, message: "Shows trending updated" };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "Unknown error" };
    }
  },
});

// ===== TEST FUNCTIONS (for development) =====

export const testSyncTrending = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    try {
      console.log("📊 Test triggered trending sync...");
      await ctx.runAction(internal.maintenance.syncTrendingData, {});
      return {
        success: true,
        message: "Successfully updated trending rankings for artists and shows",
      };
    } catch (error) {
      console.error("❌ Failed to sync trending data:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});

export const testSyncTrendingArtists = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    try {
      await ctx.runMutation(internal.trending.updateArtistShowCounts, {});
      await ctx.runMutation(internal.trending.updateArtistTrending, {});
      return { success: true, message: "Artists trending updated" };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "Unknown error" };
    }
  },
});

export const testSyncTrendingShows = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    try {
      await ctx.runMutation(internal.trending.updateShowTrending, {});
      return { success: true, message: "Shows trending updated" };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "Unknown error" };
    }
  },
});

// ===== SETLIST.FM INTEGRATION =====

export const syncSetlistForShow = action({
  args: {
    showId: v.id("shows"),
    artistName: v.string(),
    venueCity: v.string(),
    showDate: v.string(),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }
    
    try {
      const result: string | null = await ctx.runAction(internal.setlistfm.syncActualSetlist, args);
      return {
        success: !!result,
        message: result ? `Setlist synced with ID: ${result}` : "No setlist found for this show"
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

export const triggerSetlistSync = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }
    
    try {
      await ctx.runAction(internal.setlistfm.checkCompletedShows, {});
      return {
        success: true,
        message: "Setlist sync for completed shows triggered successfully"
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

// Test versions for development
export const testSyncSetlistForShow = action({
  args: {
    showId: v.id("shows"),
    artistName: v.string(),
    venueCity: v.string(),
    showDate: v.string(),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    try {
      const result: string | null = await ctx.runAction(internal.setlistfm.syncActualSetlist, args);
      return {
        success: !!result,
        message: result ? `Setlist synced with ID: ${result}` : "No setlist found for this show"
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

// Test with specific setlist ID from the URL you provided
export const testSyncSpecificSetlist = action({
  args: {
    showId: v.id("shows"),
    setlistfmId: v.string(),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    try {
      const result: string | null = await ctx.runAction(internal.setlistfm.syncSpecificSetlist, args);
      return {
        success: !!result,
        message: result ? `Setlist synced with ID: ${result}` : "Failed to sync specific setlist"
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

export const testTriggerSetlistSync = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    try {
      await ctx.runAction(internal.setlistfm.checkCompletedShows, {});
      return {
        success: true,
        message: "Setlist sync for completed shows triggered successfully"
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

// Utilities: maintenance wrappers for CLI
export const normalizeShowSlugs = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ processed: v.number(), updated: v.number() }),
  handler: async (ctx, args): Promise<{ processed: number; updated: number }> => {
    const result = await ctx.runMutation(internal.shows.normalizeSlugsInternal, { limit: args.limit });
    return result as { processed: number; updated: number };
  },
});

export const ensureAutoSetlistsBulk = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx, args): Promise<{ scheduled: number }> => {
    const result = await ctx.runMutation(internal.setlists.refreshMissingAutoSetlists, { limit: args.limit });
    return result as { scheduled: number };
  },
});

// Add public action for manual sync:
export const triggerSetlistSyncManual = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    await ctx.runAction(internal.setlistfm.checkCompletedShows, {});
    return { success: true, message: "Manual setlist sync triggered" };
  },
});

// Cleanup orphaned shows (admin-only)
export const cleanupOrphanedShows = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      await ctx.runMutation(internal.shows.cleanupOrphanedShows, {});
      return { success: true, message: "Orphaned shows cleanup invoked" };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

// ===== SONG DATABASE CLEANUP =====

export const cleanupNonStudioSongs = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string(), cleanedCount: v.number() }),
  handler: async (ctx): Promise<{ success: boolean; message: string; cleanedCount: number }> => {
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Execute cleanup directly instead of calling internal action
    console.log("🧹 Starting cleanup of non-studio songs...");

    let cleanedCount = 0;

    try {
      // Get songs in batches to avoid timeout
      const songs = await ctx.runQuery(internal.songs.getAllForCleanup, {});
      console.log(`📊 Checking ${songs.length} songs for cleanup...`);

      for (const song of songs.slice(0, 100)) { // Limit for performance
        const shouldRemove = isNonStudioSong(song.title, song.album || '');

        if (shouldRemove) {
          try {
            await ctx.runMutation(internal.songs.deleteSong, { songId: song._id });
            cleanedCount++;
            console.log(`🗑️ Removed: ${song.title} (${song.album || 'Unknown Album'})`);
          } catch (error) {
            console.error(`❌ Failed to delete song ${song._id}:`, error);
          }
        }
      }

      return {
        success: true,
        message: `Cleanup completed: ${cleanedCount} non-studio songs removed`,
        cleanedCount
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        cleanedCount: 0
      };
    }
  },
});

export const resyncArtistCatalogs = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, _args): Promise<{ success: boolean; message: string }> => {
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }
    
    try {
      // Trigger maintenance to fix missing artist data with improved filtering
      await ctx.runAction(internal.maintenance.fixMissingArtistData, {});
      return {
        success: true,
        message: `Triggered catalog re-sync for artists with improved filtering`
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

// Test versions
export const testCleanupNonStudioSongs = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string(), cleanedCount: v.number() }),
  handler: async (ctx): Promise<{ success: boolean; message: string; cleanedCount: number }> => {
    try {
      const result = await ctx.runAction(api.admin.cleanupNonStudioSongs, {});
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        cleanedCount: 0
      };
    }
  },
});

// ===== ARTIST CATALOG MANAGEMENT =====

export const resyncArtistCatalog = action({
  args: { artistId: v.id("artists") },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }
    
    try {
      const artist: any = await ctx.runQuery(api.artists.getById, { id: args.artistId });
      if (!artist) {
        throw new Error("Artist not found");
      }
      
      // Re-sync with improved filtering
      await ctx.runAction(internal.spotify.syncArtistCatalog, {
        artistId: args.artistId,
        artistName: artist.name,
      });
      
      return {
        success: true,
        message: `Re-synced catalog for ${artist.name} with improved filtering`
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

export const testResyncArtistCatalog = action({
  args: { artistId: v.id("artists") },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    try {
      const artist: any = await ctx.runQuery(api.artists.getById, { id: args.artistId });
      if (!artist) {
        throw new Error("Artist not found");
      }
      
      // Re-sync with improved filtering
      await ctx.runAction(internal.spotify.syncArtistCatalog, {
        artistId: args.artistId,
        artistName: artist.name,
      });
      
      return {
        success: true,
        message: `Re-synced catalog for ${artist.name} with improved filtering`
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

// ===== SYSTEM HEALTH MONITORING =====

export const getSystemHealth = query({
  args: {},
  returns: v.object({
    database: v.object({
      totalRecords: v.number(),
      orphanedRecords: v.number(),
      lastCleanup: v.optional(v.number()),
    }),
    sync: v.object({
      activeJobs: v.number(),
      lastTrendingSync: v.optional(v.number()),
      artistsNeedingSync: v.number(),
    }),
    api: v.object({
      spotifyConfigured: v.boolean(),
      ticketmasterConfigured: v.boolean(),
      setlistfmConfigured: v.boolean(),
    }),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx); // Admin access required
    const [artists, shows, songs, votes] = await Promise.all([
      ctx.db.query("artists").collect(),
      ctx.db.query("shows").collect(),
      ctx.db.query("songs").collect(),
      ctx.db.query("votes").collect(),
    ]);
    
    // Check for orphaned records
    let orphanedCount = 0;
    for (const show of shows.slice(0, 50)) {
      const artist = await ctx.db.get(show.artistId);
      const venue = await ctx.db.get(show.venueId);
      if (!artist || !venue) orphanedCount++;
    }
    
    // Check artists needing sync
    const staleThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    const artistsNeedingSync = artists.filter(a => 
      !a.lastSynced || a.lastSynced < staleThreshold
    ).length;
    
    return {
      database: {
        totalRecords: artists.length + shows.length + songs.length + votes.length,
        orphanedRecords: orphanedCount,
        lastCleanup: undefined,
      },
      sync: {
        activeJobs: 0,
        lastTrendingSync: artists[0]?.lastTrendingUpdate,
        artistsNeedingSync,
      },
      api: {
        spotifyConfigured: !!process.env.SPOTIFY_CLIENT_ID,
        ticketmasterConfigured: !!process.env.TICKETMASTER_API_KEY,
        setlistfmConfigured: !!process.env.SETLISTFM_API_KEY,
      },
    };
  },
});

// ===== DATA IMPORT FROM TICKETMASTER =====

export const importTrendingFromTicketmaster = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    artistsImported: v.number(),
  }),
  handler: async (ctx) => {
    // Check admin permissions
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      console.log("🎤 Importing trending artists from Ticketmaster...");
      
      // Fetch trending artists from Ticketmaster API
      const trendingArtists = await ctx.runAction(api.ticketmaster.getTrendingArtists, { limit: 50 });
      
      if (!trendingArtists || trendingArtists.length === 0) {
        return {
          success: false,
          message: "No trending artists data retrieved from Ticketmaster API",
          artistsImported: 0,
        };
      }

      let imported = 0;
      
      // Import artists that don't exist yet
      for (const artist of trendingArtists) {
        try {
          const existing = await ctx.runQuery(internal.artists.getByTicketmasterIdInternal, { 
            ticketmasterId: artist.ticketmasterId 
          });
          
          if (!existing && artist.ticketmasterId && artist.name) {
            console.log(`📥 Importing new artist: ${artist.name}`);
            await ctx.runAction(api.ticketmaster.triggerFullArtistSync, {
              ticketmasterId: artist.ticketmasterId,
              artistName: artist.name,
              genres: artist.genres || [],
              images: artist.images || [],
            });
            imported++;
          }
        } catch (error) {
          console.error(`Failed to import artist ${artist.name}:`, error);
        }
      }
      
      // After importing, trigger trending sync
      if (imported > 0) {
        await ctx.runAction(internal.maintenance.syncTrendingData, {});
      }
      
      return {
        success: true,
        message: `Successfully imported ${imported} new artists and updated trending rankings`,
        artistsImported: imported,
      };
    } catch (error) {
      console.error("❌ Failed to import from Ticketmaster:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
        artistsImported: 0,
      };
    }
  },
});

// Test version of import without auth for development
export const testImportTrendingFromTicketmaster = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    artistsImported: v.number(),
  }),
  handler: async (ctx) => {
    try {
      console.log("🎤 [TEST] Importing trending artists from Ticketmaster...");
      
      // Fetch trending artists from Ticketmaster API
      const trendingArtists = await ctx.runAction(api.ticketmaster.getTrendingArtists, { limit: 50 });
      
      if (!trendingArtists || trendingArtists.length === 0) {
        return {
          success: false,
          message: "No trending artists data retrieved from Ticketmaster API",
          artistsImported: 0,
        };
      }

      let imported = 0;
      
      // Import artists that don't exist yet
      for (const artist of trendingArtists) {
        try {
          const existing = await ctx.runQuery(internal.artists.getByTicketmasterIdInternal, { 
            ticketmasterId: artist.ticketmasterId 
          });
          
          if (!existing && artist.ticketmasterId && artist.name) {
            console.log(`📥 Importing new artist: ${artist.name}`);
            await ctx.runAction(api.ticketmaster.triggerFullArtistSync, {
              ticketmasterId: artist.ticketmasterId,
              artistName: artist.name,
              genres: artist.genres || [],
              images: artist.images || [],
            });
            imported++;
          }
        } catch (error) {
          console.error(`Failed to import artist ${artist.name}:`, error);
        }
      }
      
      // After importing, trigger trending sync
      if (imported > 0) {
        await ctx.runAction(internal.maintenance.syncTrendingData, {});
      }
      
      return {
        success: true,
        message: `Successfully imported ${imported} new artists and updated trending rankings`,
        artistsImported: imported,
      };
    } catch (error) {
      console.error("❌ Failed to import from Ticketmaster:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
        artistsImported: 0,
      };
    }
  },
});

// Internal cleanup functions
export const cleanupNonStudioSongsInternal = internalAction({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string(), cleanedCount: v.number() }),
  handler: async (ctx: any) => {
    console.log("🧹 Starting cleanup of non-studio songs...");
    
    let cleanedCount = 0;
    
    try {
      // Get songs in batches to avoid timeout
      const songs = await ctx.runQuery(internal.songs.getAllForCleanup, {});
      console.log(`📊 Checking ${songs.length} songs for cleanup...`);
      
      for (const song of songs.slice(0, 100)) { // Limit for performance
        const shouldRemove = isNonStudioSong(song.title, song.album || '');
        
        if (shouldRemove) {
          try {
            // Remove song
            await ctx.runMutation(internal.songs.deleteSong, { songId: song._id });
            cleanedCount++;
            console.log(`🗑️ Removed: "${song.title}" from "${song.album}"`);
          } catch (error) {
            console.log(`⚠️ Failed to remove ${song.title}:`, error);
          }
        }
      }
      
      return {
        success: true,
        message: `Cleaned up ${cleanedCount} non-studio songs`,
        cleanedCount
      };
    } catch (error) {
      console.error("❌ Cleanup failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        cleanedCount
      };
    }
  },
});

// Helper function to detect non-studio songs for cleanup
function isNonStudioSong(songTitle: string, albumName: string): boolean {
  const songLower = songTitle.toLowerCase().trim();
  const albumLower = albumName.toLowerCase().trim();
  
  const nonStudioIndicators = [
    // Live indicators
    'live', '- live', '(live)', '[live]', 'concert', 'acoustic version',
    'unplugged', 'session', 'bootleg', 'performance',
    
    // Remix/alternate indicators  
    'remix', 'rmx', 'mix)', 'edit', 'version)', 'radio edit', 'extended',
    
    // Feature indicators
    'feat.', 'featuring', 'ft.', '(with ', 'duet',
    
    // Deluxe/reissue indicators in album
    'deluxe', 'remaster', 'anniversary', 'tour edition', 'expanded',
    'special edition', 'collector', 'édition de luxe'
  ];
  
  return nonStudioIndicators.some(indicator => 
    songLower.includes(indicator) || albumLower.includes(indicator)
  );
}

export const bulkDeleteFlagged = mutation({
  args: { ids: v.array(v.id("contentFlags")) },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.delete(id);
    }
    return { deleted: args.ids.length };
  },
});

export const updateUserRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("user"), v.literal("admin")) },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { role: args.role });
    console.log(`Updated role for user ${args.userId} to ${args.role}`);
    return { success: true };
  },
});

// ===== SYSTEM LOGS =====

export const getSystemLogs = query({
  args: { 
    limit: v.optional(v.number()),
    type: v.optional(v.string()),
  },
  returns: v.array(v.object({
    _id: v.id("userActions"),
    userId: v.union(v.id("users"), v.string()),
    action: v.string(),
    timestamp: v.number(),
    username: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const limit = args.limit || 100;
    
    // Get recent user actions
    let query = ctx.db.query("userActions").order("desc");
    
    if (args.type) {
      query = query.filter((q) => q.eq(q.field("action"), args.type));
    }
    
    const actions = await query.take(limit);
    
    // Enrich with user data
    const enriched = await Promise.all(
      actions.map(async (action) => {
        let username = "Unknown";
        
        if (typeof action.userId === "string") {
          username = "Anonymous";
        } else {
          const user = await ctx.db.get(action.userId);
          if (user && "_tableName" in user && user._tableName === "users") {
            username = (user as any).username || (user as any).email || "Unknown";
          } else {
            username = "Unknown";
          }
        }
        
        return {
          ...action,
          username,
        };
      })
    );
    
    return enriched;
  },
});

export const getRecentActivity = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    type: v.string(),
    description: v.string(),
    timestamp: v.number(),
    user: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const limit = args.limit || 50;
    
    // Get recent votes, setlists, and user actions
    const [recentVotes, recentSetlists, recentUsers] = await Promise.all([
      ctx.db.query("votes").order("desc").take(20),
      ctx.db.query("setlists").order("desc").take(20),
      ctx.db.query("users").order("desc").take(20),
    ]);
    
    const activities = [];
    
    // Process votes
    for (const vote of recentVotes) {
      const voteUser = await ctx.db.get(vote.userId);
      const setlist = await ctx.db.get(vote.setlistId);
      
      activities.push({
        type: "vote",
        description: `${voteUser?.username || "User"} voted ${vote.voteType} on a setlist`,
        timestamp: vote.createdAt,
        user: voteUser?.username || voteUser?.email,
      });
    }
    
    // Process setlists
    for (const setlist of recentSetlists) {
      if (setlist.userId) {
        const setlistUser = await ctx.db.get(setlist.userId);
        const show = await ctx.db.get(setlist.showId);
        
        activities.push({
          type: "setlist",
          description: `${setlistUser?.username || "User"} created a setlist${show ? ` for show` : ""}`,
          timestamp: setlist._creationTime,
          user: setlistUser?.username || setlistUser?.email,
        });
      }
    }
    
    // Process new users
    for (const newUser of recentUsers) {
      activities.push({
        type: "user",
        description: `New user registered: ${newUser.username || newUser.email}`,
        timestamp: newUser.createdAt,
        user: newUser.username || newUser.email,
      });
    }
    
    // Sort by timestamp and limit
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
});

// CRITICAL: Import trending shows from cache into main DB (atomic mutation)
export const importCachedShows = mutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ processed: v.number(), imported: v.number(), errors: v.number() }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const stats = { processed: 0, imported: 0, errors: 0 };
    const cached = await ctx.db.query("trendingShows").take(limit);
    
    for (const show of cached) {
      stats.processed++;
      if (show.showId) continue;
      try {
        if (!show.artistName || !show.venueName || !show.date) continue;
        let artistId = show.artistId;
        if (!artistId) {
          const lowerName = show.artistName.toLowerCase();
          let artist = await ctx.db.query("artists").withIndex("by_lower_name", (q) => q.eq("lowerName", lowerName)).first();
          if (!artist && show.artistTicketmasterId) {
            artist = await ctx.db.query("artists").withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", show.artistTicketmasterId!)).first();
          }
          if (!artist) {
            const slug = show.artistName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 100);
            artistId = await ctx.db.insert("artists", {slug, name: show.artistName, ticketmasterId: show.artistTicketmasterId, lowerName, genres: [], images: show.artistImage ? [show.artistImage] : [], isActive: true, popularity: 0, followers: 0, trendingScore: 0, trendingRank: 0, upcomingShowsCount: 0, lastSynced: Date.now(), lastTrendingUpdate: Date.now()});
          } else {
            artistId = artist._id;
          }
        }
        let venue = await ctx.db.query("venues").withIndex("by_name_city", (q) => q.eq("name", show.venueName).eq("city", show.venueCity)).first();
        const venueId = venue ? venue._id : await ctx.db.insert("venues", {name: show.venueName, city: show.venueCity, country: show.venueCountry});
        const artist = await ctx.db.get(artistId);
        const ven = await ctx.db.get(venueId);
        if (!artist || !ven) continue;
        const slug = `${artist.slug}-${ven.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${ven.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${show.date}`.substring(0, 200);
        const showId = await ctx.db.insert("shows", {slug, artistId, venueId, date: show.date, startTime: show.startTime, status: (show.status || '').includes('cancel') ? 'cancelled' as const : 'upcoming' as const, ticketmasterId: show.ticketmasterId, ticketUrl: show.ticketUrl, priceRange: show.priceRange, voteCount: 0, setlistCount: 0, trendingScore: 0, trendingRank: 0, lastSynced: Date.now(), lastTrendingUpdate: Date.now()});
        await ctx.db.patch(show._id, {showId, artistId});
        stats.imported++;
      } catch (e) {
        stats.errors++;
      }
    }
    return stats;
  },
});

// NEW: Manual backfill action for admin dashboard
export const backfillMissingSetlists = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ success: v.boolean(), message: v.string(), scheduled: v.number() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string; scheduled: number }> => {
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }
    
    try {
      console.log("🔄 Admin triggered backfill for missing setlists...");
      const result = await ctx.runMutation(internal.setlists.refreshMissingAutoSetlists, {
        limit: args.limit || 500,
        includeCompleted: true, // Scan ALL shows (including legacy/completed)
      });
      
      return {
        success: true,
        message: `Backfill scheduled: ${result.scheduled} setlist generations queued`,
        scheduled: result.scheduled,
      };
    } catch (error) {
      console.error("❌ Backfill failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        scheduled: 0,
      };
    }
  },
});

// NEW: Test version without auth for development
export const testBackfillMissingSetlists = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ success: v.boolean(), message: v.string(), scheduled: v.number() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string; scheduled: number }> => {
    try {
      console.log("🔄 [TEST] Backfill for missing setlists...");
      const result = await ctx.runMutation(internal.setlists.refreshMissingAutoSetlists, {
        limit: args.limit || 500,
        includeCompleted: true,
      });
      
      return {
        success: true,
        message: `Backfill scheduled: ${result.scheduled} setlist generations queued (will process in background)`,
        scheduled: result.scheduled,
      };
    } catch (error) {
      console.error("❌ Backfill failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        scheduled: 0,
      };
    }
  },
});
