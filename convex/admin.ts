import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ===== USER MANAGEMENT =====

export const getAllUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const users = await ctx.db.query("users").take(limit);
    return users;
  },
});

export const toggleUserBan = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    
    const newRole = user.role === "banned" ? "user" : "banned";
    await ctx.db.patch(args.userId, { role: newRole });
    
    return { success: true, newRole };
  },
});

// ===== CONTENT MODERATION =====

export const flagContent = mutation({
  args: {
    contentType: v.union(v.literal("setlist"), v.literal("vote"), v.literal("comment")),
    contentId: v.string(),
    reason: v.string(),
  },
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
  handler: async (ctx, args) => {
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
    isVerified: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.setlistId, { 
      verified: args.isVerified,
    });
    
    return { success: true };
  },
});

// ===== ANALYTICS & STATISTICS =====

export const getAdminStats = query({
  args: {},
  handler: async (ctx) => {
    const [users, artists, shows, setlists, votes] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("artists").collect(),
      ctx.db.query("shows").collect(),
      ctx.db.query("setlists").collect(),
      ctx.db.query("votes").collect(),
    ]);
    
    // Calculate trending metrics
    const activeUsers = users.filter(u => u.role !== "banned").length;
    const last7Days = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentVotes = votes.filter(v => v.createdAt > last7Days).length;
    
    // Top voted setlists
    const setlistVoteCounts = new Map<Id<"setlists">, number>();
    votes.forEach(vote => {
      const count = setlistVoteCounts.get(vote.setlistId) || 0;
      setlistVoteCounts.set(vote.setlistId, count + 1);
    });
    
    const topSetlists = Array.from(setlistVoteCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(async ([setlistId, voteCount]) => {
        const setlist = await ctx.db.get(setlistId);
        if (!setlist) return null;
        
        const show = await ctx.db.get(setlist.showId);
        const artist = show ? await ctx.db.get(show.artistId) : null;
        
        return {
          setlistId,
          voteCount,
          showName: show && artist ? `${artist.name} - ${show.date}` : "Unknown",
        };
      });
    
    const topSetlistsResolved = (await Promise.all(topSetlists)).filter(Boolean);
    
    return {
      totalUsers: users.length,
      activeUsers,
      bannedUsers: users.filter(u => u.role === "banned").length,
      totalArtists: artists.length,
      totalShows: shows.length,
      upcomingShows: shows.filter(s => s.status === "upcoming").length,
      totalSetlists: setlists.length,
      officialSetlists: setlists.filter(s => s.isOfficial).length,
      totalVotes: votes.length,
      recentVotes,
      topSetlists: topSetlistsResolved,
    };
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