import { action, mutation, query, internalAction, internalMutation, internalQuery, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  requireAdmin,
  requireAdminForAction,
  isRealConcert,
  isNonStudioSong,
  normalizeSongKey,
  isUSCountry,
  internalRef,
  apiRef,
} from "./adminHelpers";

// Re-export requireAdmin for backward compat (other files may import from admin.ts)
export { requireAdmin } from "./adminHelpers";

// Internal query to check if user is admin (for use in actions)
export const checkAdminInternal = internalQuery({
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

// Internal helper: write an admin audit log record
export const logAdminAuditInternal = internalMutation({
  args: {
    actorUserId: v.id("users"),
    action: v.string(),
    args: v.optional(v.any()),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("adminAuditLogs", {
      actorUserId: args.actorUserId,
      action: args.action,
      args: args.args,
      createdAt: Date.now(),
      success: args.success,
      error: args.error,
    });
    return null;
  },
});

export const getRecentAuditLogs = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 100;
    return await ctx.db.query("adminAuditLogs").withIndex("by_created_at").order("desc").take(limit);
  },
});

// requireAdminForAction is now imported from ./adminHelpers

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
    const actorUserId = await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    // Simplify: toggle between admin and user (no banned role in schema)
    const newRole = user.role === "admin" ? "user" : "admin";
    await ctx.db.patch(args.userId, { role: newRole });
    await ctx.db.insert("adminAuditLogs", {
      actorUserId,
      action: "toggleUserBan",
      args: { userId: args.userId, newRole },
      createdAt: Date.now(),
      success: true,
    });
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
  handler: async (ctx, args) => {
    await requireAdminForAction(ctx);
    try {
      const secret = process.env.CLERK_SECRET_KEY;
      if (!secret) {
        return { success: true, clerkUpdated: false, message: "CLERK_SECRET_KEY not configured" };
      }
      const base = "https://apiRef.clerk.com/v1";
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
      const loggedIn = await ctx.runQuery(apiRef.auth.loggedInUser, {});
      const actorUserId = loggedIn?.appUser?._id;
      if (actorUserId) {
        await ctx.runMutation(internalRef.admin.logAdminAuditInternal, {
          actorUserId,
          action: "setClerkRoleByEmail",
          args: { email: args.email, role: args.role },
          success: true,
        });
      }
      return { success: true, clerkUpdated: true, message: "Clerk role updated" };
    } catch (e: any) {
      const loggedIn = await ctx.runQuery(apiRef.auth.loggedInUser, {});
      const actorUserId = loggedIn?.appUser?._id;
      if (actorUserId) {
        await ctx.runMutation(internalRef.admin.logAdminAuditInternal, {
          actorUserId,
          action: "setClerkRoleByEmail",
          args: { email: args.email, role: args.role },
          success: false,
          error: e?.message || "Unknown error",
        });
      }
      return { success: false, clerkUpdated: false, message: e?.message || "Unknown error" };
    }
  },
});

// Test Spotify client credentials from admin dashboard
export const testSpotifyClientCredentials = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    await requireAdminForAction(ctx);
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        success: false,
        message: "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in environment",
      };
    }

    try {
      const authHeader = (() => {
        const input = `${clientId}:${clientSecret}`;
        // Prefer btoa in non-Node runtimes; fall back to Buffer if available.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const maybeBtoa = (globalThis as any).btoa as ((s: string) => string) | undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const maybeBuffer = (globalThis as any).Buffer as any;
        if (typeof maybeBtoa === "function") return maybeBtoa(input);
        if (maybeBuffer?.from) return maybeBuffer.from(input).toString("base64");
        throw new Error("No base64 encoder available for Spotify auth");
      })();
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${authHeader}`,
        },
        body: "grant_type=client_credentials",
      } as RequestInit);

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          message: `Spotify token request failed: ${response.status} ${body.slice(
            0,
            200,
          )}`,
        };
      }

      const data = (await response.json()) as any;
      const expiresIn = data?.expires_in;
      return {
        success: true,
        message: `Spotify client credentials OK (access token received, expires in ${expiresIn}s)`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Spotify client credentials test failed: ${error instanceof Error ? error.message : String(error)
          }`,
      };
    }
  },
});

// Internal: Ensure a user is admin by email (no auth required, for deploy scripts)
// IMPORTANT: This updates ALL users with the given email to handle duplicates
export const ensureAdminByEmailInternal = internalMutation({
  args: { email: v.string() },
  returns: v.object({ success: v.boolean(), updated: v.number(), userIds: v.array(v.id("users")) }),
  handler: async (ctx, args) => {
    // Find ALL users with this email (case-insensitive)
    const users = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .collect();

    if (users.length === 0) {
      console.log(`⚠️ No users found with email ${args.email}`);
      return { success: true, updated: 0, userIds: [] };
    }

    const updatedIds: Id<"users">[] = [];
    for (const user of users) {
      if (user.role !== "admin") {
        await ctx.db.patch(user._id, { role: "admin" });
        console.log(`✅ Promoted user ${user._id} (authId: ${user.authId}) to admin`);
        updatedIds.push(user._id);
      } else {
        console.log(`ℹ️ User ${user._id} (authId: ${user.authId}) is already admin`);
      }
    }

    return { success: true, updated: updatedIds.length, userIds: updatedIds };
  },
});

// Internal: Ensure a user is admin by Clerk authId (most precise method)
export const ensureAdminByAuthIdInternal = internalMutation({
  args: { authId: v.string() },
  returns: v.object({ success: v.boolean(), updated: v.boolean(), userId: v.optional(v.id("users")) }),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
      .first();

    if (!user) {
      console.log(`⚠️ No user found with authId ${args.authId}`);
      return { success: true, updated: false };
    }

    if (user.role === "admin") {
      console.log(`ℹ️ User ${user.email} (${user._id}) is already admin`);
      return { success: true, updated: false, userId: user._id };
    }

    await ctx.db.patch(user._id, { role: "admin" });
    console.log(`✅ Promoted user ${user.email} (${user._id}) to admin via authId`);
    return { success: true, updated: true, userId: user._id };
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
      lastUpdated: Date.now(),
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

// Delete flagged content (setlist/vote) and mark the flag reviewed
export const deleteFlaggedContent = mutation({
  args: {
    flagId: v.id("contentFlags"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const flag = await ctx.db.get(args.flagId);
    if (!flag) {
      throw new Error("Flag not found");
    }

    if (flag.contentType === "setlist") {
      const setlistId = flag.contentId as Id<"setlists">;
      const setlist = await ctx.db.get(setlistId);
      if (setlist?.showId) {
        const show = await ctx.db.get(setlist.showId);
        if (show) {
          await ctx.db.patch(setlist.showId, {
            setlistCount: Math.max(0, (show.setlistCount || 0) - 1),
          });
        }
      }

      // Remove votes tied to this setlist to keep counts consistent
      const relatedVotes = await ctx.db
        .query("votes")
        .withIndex("by_setlist", (q) => q.eq("setlistId", setlistId))
        .collect();
      for (const vote of relatedVotes) {
        await ctx.db.delete(vote._id);
        if (setlist?.showId) {
          const show = await ctx.db.get(setlist.showId);
          if (show) {
            await ctx.db.patch(setlist.showId, {
              voteCount: Math.max(0, (show.voteCount || 0) - 1),
            });
          }
        }
      }

      await ctx.db.delete(setlistId);
    } else if (flag.contentType === "vote") {
      const voteId = flag.contentId as Id<"votes">;
      const vote = await ctx.db.get(voteId);
      if (vote?.setlistId) {
        const setlist = await ctx.db.get(vote.setlistId);
        if (setlist?.showId) {
          const show = await ctx.db.get(setlist.showId);
          if (show) {
            await ctx.db.patch(setlist.showId, {
              voteCount: Math.max(0, (show.voteCount || 0) - 1),
            });
          }
        }
      }
      await ctx.db.delete(voteId);
    }

    await ctx.db.patch(args.flagId, {
      status: "reviewed",
      reviewedBy: adminId,
      reviewedAt: Date.now(),
    });

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
      // Helper: count rows in a table via paginated reads (avoids loading all data into memory)
      async function countTable(tableName: "users" | "artists" | "shows" | "setlists" | "votes") {
        let count = 0;
        let isDone = false;
        let cursor = null;
        while (!isDone) {
          const page: any = await ctx.db.query(tableName).paginate({ numItems: 500, cursor: cursor as any });
          count += page.page.length;
          isDone = page.isDone;
          cursor = page.continueCursor;
        }
        return count;
      }

      // Count tables with paginated reads — never loads entire table into memory
      const [totalUsers, totalArtists, totalShows, totalSetlists, totalVotes] = await Promise.all([
        countTable("users"),
        countTable("artists"),
        countTable("shows"),
        countTable("setlists"),
        countTable("votes"),
      ]);

      // Count upcoming shows (uses index if available)
      const upcomingShows = (await ctx.db.query("shows")
        .filter((q) => q.eq(q.field("status"), "upcoming"))
        .take(10000)).length;

      // Count official setlists
      const officialSetlists = (await ctx.db.query("setlists")
        .filter((q) => q.eq(q.field("isOfficial"), true))
        .take(10000)).length;

      // Recent votes (last 7 days) — paginated
      const last7Days = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const recentVotesPage = await ctx.db.query("votes")
        .withIndex("by_creation_time")
        .order("desc")
        .filter((q) => q.gte(q.field("createdAt"), last7Days))
        .take(10000);
      const recentVotes = recentVotesPage.length;

      // Top voted setlists — use recent votes only to avoid full scan
      const setlistVoteCounts = new Map<Id<"setlists">, number>();
      const recentVotesForTop = await ctx.db.query("votes")
        .order("desc")
        .take(1000); // Sample last 1000 votes for top setlists
      recentVotesForTop.forEach(vote => {
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
        totalUsers,
        activeUsers: totalUsers,
        bannedUsers: 0,
        totalArtists,
        totalShows,
        upcomingShows,
        totalSetlists,
        officialSetlists,
        totalVotes,
        recentVotes,
        topSetlists: topSetlistsResolved,
      };
    } catch (error) {
      console.error("Error in getAdminStats:", error);
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
    const user: any = await ctx.runQuery(apiRef.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      console.log("📊 Admin triggered trending sync...");

      // Use the optimized maintenance action to sync trending data
      await ctx.runAction(internalRef.maintenance.syncTrendingData, {});

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
    const user = await ctx.runQuery(apiRef.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }
    try {
      await ctx.runMutation(internalRef.trending.updateArtistShowCounts, {});
      await ctx.runMutation(internalRef.trending.updateArtistTrending, {});
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
    const user = await ctx.runQuery(apiRef.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }
    try {
      await ctx.runMutation(internalRef.trending.updateShowTrending, {});
      return { success: true, message: "Shows trending updated" };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "Unknown error" };
    }
  },
});

// ===== TEST FUNCTIONS (for development) =====

export const testSyncTrending = internalAction({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    try {
      console.log("📊 Test triggered trending sync...");
      await ctx.runAction(internalRef.maintenance.syncTrendingData, {});
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

export const testSyncTrendingArtists = internalAction({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    try {
      await ctx.runMutation(internalRef.trending.updateArtistShowCounts, {});
      await ctx.runMutation(internalRef.trending.updateArtistTrending, {});
      return { success: true, message: "Artists trending updated" };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "Unknown error" };
    }
  },
});

export const testSyncTrendingShows = internalAction({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    try {
      await ctx.runMutation(internalRef.trending.updateShowTrending, {});
      return { success: true, message: "Shows trending updated" };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "Unknown error" };
    }
  },
});

// Refresh trending cache from Ticketmaster API (fetches fresh data)
export const refreshTrendingCache = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string(), showsImported: v.number() }),
  handler: async (ctx) => {
    await requireAdminForAction(ctx);
    try {
      console.log("🔄 Refreshing trending cache from Ticketmaster...");

      // Step 1: Fetch fresh trending shows from Ticketmaster API
      const freshShows = await ctx.runAction(internalRef.ticketmaster.getTrendingShows, { limit: 100 });
      console.log(`📊 Fetched ${freshShows.length} shows from Ticketmaster`);

      // Step 2: Replace the trending cache with fresh data
      if (freshShows.length > 0) {
        await ctx.runMutation(internalRef.trending.replaceTrendingShowsCache, {
          fetchedAt: Date.now(),
          shows: freshShows.map((show: any, index: number) => ({
            ticketmasterId: show.ticketmasterId,
            artistTicketmasterId: show.artistTicketmasterId,
            artistName: show.artistName,
            venueName: show.venueName,
            venueCity: show.venueCity,
            venueState: show.venueState,
            venueCountry: show.venueCountry,
            date: show.date,
            startTime: show.startTime,
            artistImage: show.artistImage,
            ticketUrl: show.ticketUrl,
            priceRange: show.priceRange,
            status: show.status || "upcoming",
            rank: index + 1,
          })),
        });
        console.log("✅ Trending shows cache updated");
      }

      // Step 3: Fetch fresh trending artists from Ticketmaster
      const freshArtists = await ctx.runAction(internalRef.ticketmaster.getTrendingArtists, { limit: 50 });
      console.log(`📊 Fetched ${freshArtists.length} artists from Ticketmaster`);

      if (freshArtists.length > 0) {
        await ctx.runMutation(internalRef.trending.replaceTrendingArtistsCache, {
          fetchedAt: Date.now(),
          artists: freshArtists.map((artist: any, index: number) => ({
            name: artist.name,
            ticketmasterId: artist.ticketmasterId,
            genres: artist.genres || [],
            images: artist.images || [],
            upcomingEvents: artist.upcomingEvents || 0,
            rank: index + 1,
          })),
        });
        console.log("✅ Trending artists cache updated");
      }

      // Step 4: Import fresh shows into main database
      const importResult = await ctx.runMutation(internalRef.importTrendingShows.importTrendingShowsBatch, { limit: 100 });
      console.log(`✅ Imported ${importResult.imported} new shows`);

      return {
        success: true,
        message: `Refreshed cache: ${freshShows.length} shows, ${freshArtists.length} artists. Imported ${importResult.imported} new shows.`,
        showsImported: importResult.imported,
      };
    } catch (e) {
      console.error("❌ Failed to refresh trending cache:", e);
      return {
        success: false,
        message: e instanceof Error ? e.message : "Unknown error",
        showsImported: 0,
      };
    }
  },
});

// Internal version for cron job
export const refreshTrendingCacheInternal = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    try {
      console.log("🔄 [CRON] Refreshing trending cache from Ticketmaster...");

      // Step 1: Fetch fresh trending shows from Ticketmaster API
      const freshShows = await ctx.runAction(internalRef.ticketmaster.getTrendingShows, { limit: 100 });
      console.log(`📊 Fetched ${freshShows.length} shows from Ticketmaster`);

      // Step 2: Replace the trending cache with fresh data
      if (freshShows.length > 0) {
        await ctx.runMutation(internalRef.trending.replaceTrendingShowsCache, {
          fetchedAt: Date.now(),
          shows: freshShows.map((show: any, index: number) => ({
            ticketmasterId: show.ticketmasterId,
            artistTicketmasterId: show.artistTicketmasterId,
            artistName: show.artistName,
            venueName: show.venueName,
            venueCity: show.venueCity,
            venueState: show.venueState,
            venueCountry: show.venueCountry,
            date: show.date,
            startTime: show.startTime,
            artistImage: show.artistImage,
            ticketUrl: show.ticketUrl,
            priceRange: show.priceRange,
            status: show.status || "upcoming",
            rank: index + 1,
          })),
        });
        console.log("✅ Trending shows cache updated");
      }

      // Step 3: Fetch fresh trending artists and import them with full sync
      const freshArtists = await ctx.runAction(internalRef.ticketmaster.getTrendingArtists, { limit: 50 });
      console.log(`📊 Fetched ${freshArtists.length} artists from Ticketmaster`);

      if (freshArtists.length > 0) {
        // Filter out non-concert artists before caching
        await ctx.runMutation(internalRef.trending.replaceTrendingArtistsCache, {
          fetchedAt: Date.now(),
          artists: freshArtists.map((artist: any, index: number) => ({
            name: artist.name,
            ticketmasterId: artist.ticketmasterId,
            genres: artist.genres || [],
            images: artist.images || [],
            upcomingEvents: artist.upcomingEvents || 0,
            rank: index + 1,
          })),
        });
        console.log("✅ Trending artists cache updated");

        // Import top artists with full sync (only if they don't exist).
        // IMPORTANT: Do not `sleep` inside a cron action. Schedule staggered work instead so
        // the cron completes quickly and we still respect third-party API rate limits.
        let scheduled = 0;
        const IMPORT_LIMIT = 20;
        const STAGGER_MS = 2500; // ~2.5s spacing to avoid TM/Spotify rate limiting bursts

        for (const artist of freshArtists.slice(0, IMPORT_LIMIT)) {
          try {
            const existing = await ctx.runQuery(internalRef.artists.getByTicketmasterIdInternal, {
              ticketmasterId: artist.ticketmasterId,
            });

            if (!existing) {
              const delayMs = scheduled * STAGGER_MS;
              console.log(`🗓️ Scheduling trending artist import: ${artist.name} (delay: ${delayMs}ms)`);

              await ctx.scheduler.runAfter(delayMs, internalRef.ticketmaster.triggerFullArtistSyncInternal, {
                ticketmasterId: artist.ticketmasterId,
                artistName: artist.name,
                genres: artist.genres,
                images: artist.images,
                upcomingEvents: artist.upcomingEvents,
              });
              scheduled++;
            }
          } catch (e) {
            console.error(`Failed to schedule import for ${artist.name}:`, e);
          }
        }
        console.log(`✅ Scheduled ${scheduled} new trending artist imports`);
      }

      // Step 4: Import fresh shows into main database
      const importResult = await ctx.runMutation(internalRef.importTrendingShows.importTrendingShowsBatch, { limit: 100 });
      console.log(`✅ Imported ${importResult.imported} new shows`);

      console.log("🎉 [CRON] Trending cache refresh complete");
    } catch (e) {
      console.error("❌ [CRON] Failed to refresh trending cache:", e);
    }
    return null;
  },
});

// Clean up non-US shows from trending cache and main shows table
export const cleanupNonUSShows = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    cacheDeleted: v.number(),
    showsDeleted: v.number()
  }),
  handler: async (ctx) => {
    try {
      console.log("🧹 Cleaning up non-US shows...");

      const result = await ctx.runMutation(internalRef.admin.cleanupNonUSShowsInternal, {});

      return {
        success: true,
        message: `Cleaned up ${result.cacheDeleted} cache entries and ${result.showsDeleted} shows`,
        cacheDeleted: result.cacheDeleted,
        showsDeleted: result.showsDeleted,
      };
    } catch (e) {
      console.error("❌ Failed to clean up non-US shows:", e);
      return {
        success: false,
        message: e instanceof Error ? e.message : "Unknown error",
        cacheDeleted: 0,
        showsDeleted: 0,
      };
    }
  },
});

// isRealConcert is now imported from ./adminHelpers

export const cleanupNonUSShowsInternal = internalMutation({
  args: {},
  returns: v.object({ cacheDeleted: v.number(), showsDeleted: v.number() }),
  handler: async (ctx) => {
    let cacheDeleted = 0;
    let showsDeleted = 0;

    // isUS is now imported from ./adminHelpers as isUSCountry

    // Clean up trending shows cache - both non-US AND non-concert events
    const cachedShows = await ctx.db.query("trendingShows").collect();
    for (const show of cachedShows) {
      const shouldDelete = !isUSCountry(show.venueCountry) || !isRealConcert(show.artistName || '');
      if (shouldDelete) {
        await ctx.db.delete(show._id);
        cacheDeleted++;
      }
    }
    console.log(`🗑️ Deleted ${cacheDeleted} non-US/non-concert entries from trending cache`);

    // Clean up main shows table
    const allShows = await ctx.db.query("shows").collect();
    for (const show of allShows) {
      const venue = await ctx.db.get(show.venueId);
      const artist = await ctx.db.get(show.artistId);

      const isNonUS = venue && !isUSCountry(venue.country);
      const isNonConcert = artist && !isRealConcert(artist.name);

      if (isNonUS || isNonConcert) {
        // Delete associated setlists first
        const setlists = await ctx.db
          .query("setlists")
          .withIndex("by_show", (q) => q.eq("showId", show._id))
          .collect();
        for (const setlist of setlists) {
          await ctx.db.delete(setlist._id);
        }

        // Delete the show
        await ctx.db.delete(show._id);
        showsDeleted++;
      }
    }
    console.log(`🗑️ Deleted ${showsDeleted} non-US/non-concert shows from main database`);

    return { cacheDeleted, showsDeleted };
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
    const user = await ctx.runQuery(apiRef.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      const result: string | null = await ctx.runAction(internalRef.setlistfm.syncActualSetlist, args);
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
    const user = await ctx.runQuery(apiRef.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      await ctx.runAction(internalRef.setlistfm.checkCompletedShows, {});
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
export const testSyncSetlistForShow = internalAction({
  args: {
    showId: v.id("shows"),
    artistName: v.string(),
    venueCity: v.string(),
    showDate: v.string(),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    try {
      const result: string | null = await ctx.runAction(internalRef.setlistfm.syncActualSetlist, args);
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
export const testSyncSpecificSetlist = internalAction({
  args: {
    showId: v.id("shows"),
    setlistfmId: v.string(),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    try {
      const result: string | null = await ctx.runAction(internalRef.setlistfm.syncSpecificSetlist, args);
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

export const testTriggerSetlistSync = internalAction({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    try {
      await ctx.runAction(internalRef.setlistfm.checkCompletedShows, {});
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
    const result = await ctx.runMutation(internalRef.shows.normalizeSlugsInternal, { limit: args.limit });
    return result as { processed: number; updated: number };
  },
});

export const ensureAutoSetlistsBulk = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx, args): Promise<{ scheduled: number }> => {
    const result = await ctx.runMutation(internalRef.setlists.refreshMissingAutoSetlists, { limit: args.limit });
    return result as { scheduled: number };
  },
});

// Backfill setlists for festival shows that are missing them
export const backfillFestivalSetlists = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    scheduled: v.number(),
    skipped: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const errors: string[] = [];
    let processed = 0;
    let scheduled = 0;
    let skipped = 0;

    console.log(`🎪 Backfilling festival setlists (limit: ${limit})...`);

    // Get all festival shows
    const festivalShows = await ctx.runQuery(internalRef.admin.getFestivalShowsWithoutSetlists, { limit });

    for (const show of festivalShows) {
      processed++;

      try {
        // Check if artist has songs
        const songCount = await ctx.runQuery(internalRef.songs.countByArtist, { artistId: show.artistId });

        if (songCount === 0) {
          console.log(`⏭️ Skipping ${show.slug} - artist has no songs`);
          skipped++;
          continue;
        }

        // Schedule auto-generate setlist
        await ctx.scheduler.runAfter(processed * 500, internalRef.setlists.autoGenerateSetlist, {
          showId: show._id,
          artistId: show.artistId,
        });

        scheduled++;
        console.log(`✅ Scheduled setlist for ${show.slug}`);
      } catch (error) {
        const msg = `Failed for ${show.slug}: ${error instanceof Error ? error.message : "Unknown"}`;
        errors.push(msg);
        console.error(`❌ ${msg}`);
      }
    }

    console.log(`\n📊 Backfill complete: ${scheduled} scheduled, ${skipped} skipped, ${errors.length} errors`);
    return { processed, scheduled, skipped, errors };
  },
});

// Helper query to get festival shows without setlists
export const getFestivalShowsWithoutSetlists = internalQuery({
  args: { limit: v.number() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Get shows that are linked to festivals
    const shows = await ctx.db
      .query("shows")
      .filter((q) => q.neq(q.field("festivalId"), undefined))
      .take(args.limit * 2); // Get more to filter

    const result = [];

    for (const show of shows) {
      if (result.length >= args.limit) break;

      // Check if show has a setlist
      const setlist = await ctx.db
        .query("setlists")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .first();

      // Include if no setlist OR setlist has < 5 songs
      if (!setlist || !setlist.songs || setlist.songs.length < 5) {
        result.push(show);
      }
    }

    return result;
  },
});

// Add public action for manual sync:
export const triggerSetlistSyncManual = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    await ctx.runAction(internalRef.setlistfm.checkCompletedShows, {});
    return { success: true, message: "Manual setlist sync triggered" };
  },
});

// Cleanup orphaned shows (admin-only)
export const cleanupOrphanedShows = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx) => {
    const user = await ctx.runQuery(apiRef.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      await ctx.runMutation(internalRef.shows.cleanupOrphanedShows, {});
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
    const user = await ctx.runQuery(apiRef.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Execute cleanup directly instead of calling internal action
    console.log("🧹 Starting cleanup of non-studio songs...");

    let cleanedCount = 0;

    try {
      // Get songs in batches to avoid timeout
      const songs = await ctx.runQuery(internalRef.songs.getAllForCleanup, {});
      console.log(`📊 Checking ${songs.length} songs for cleanup...`);

      for (const song of songs.slice(0, 100)) { // Limit for performance
        const shouldRemove = isNonStudioSong(song.title, song.album || '');

        if (shouldRemove) {
          try {
            await ctx.runMutation(internalRef.songs.deleteSong, { songId: song._id });
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
    const user = await ctx.runQuery(apiRef.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      // Trigger maintenance to fix missing artist data with improved filtering
      await ctx.runAction(internalRef.maintenance.fixMissingArtistData, {});
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

// Test versions - execute directly to avoid type issues
export const testCleanupNonStudioSongs = internalAction({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string(), cleanedCount: v.number() }),
  handler: async (ctx): Promise<{ success: boolean; message: string; cleanedCount: number }> => {
    console.log("🧹 Test: Starting cleanup of non-studio songs...");

    let cleanedCount = 0;

    try {
      // Get songs in batches to avoid timeout
      const songs = await ctx.runQuery(internalRef.songs.getAllForCleanup, {});
      console.log(`📊 Checking ${songs.length} songs for cleanup...`);

      for (const song of songs.slice(0, 100)) { // Limit for performance
        const shouldRemove = isNonStudioSong(song.title, song.album || '');

        if (shouldRemove) {
          try {
            await ctx.runMutation(internalRef.songs.deleteSong, { songId: song._id });
            cleanedCount++;
            console.log(`🗑️ Removed: ${song.title} (${song.album || 'Unknown Album'})`);
          } catch (error) {
            console.error(`❌ Failed to delete song ${song._id}:`, error);
          }
        }
      }

      return {
        success: true,
        message: `Test cleanup completed: ${cleanedCount} non-studio songs removed`,
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

// ===== ARTIST CATALOG MANAGEMENT =====

export const resyncArtistCatalog = action({
  args: { artistId: v.id("artists") },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const user = await ctx.runQuery(apiRef.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      const artist: any = await ctx.runQuery(apiRef.artists.getById, { id: args.artistId });
      if (!artist) {
        throw new Error("Artist not found");
      }

      // Re-sync with improved filtering
      await ctx.runAction(internalRef.spotify.syncArtistCatalog, {
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

export const testResyncArtistCatalog = internalAction({
  args: { artistId: v.id("artists") },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    try {
      const artist: any = await ctx.runQuery(apiRef.artists.getById, { id: args.artistId });
      if (!artist) {
        throw new Error("Artist not found");
      }

      // Re-sync with improved filtering
      await ctx.runAction(internalRef.spotify.syncArtistCatalog, {
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

// Recompute engagement counts once after switching to on-write counters
export const recomputeEngagementCounts = action({
  args: {},
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx): Promise<{ success: boolean }> => {
    await requireAdminForAction(ctx);
    await ctx.runMutation(internalRef.trending.updateEngagementCounts, {});
    return { success: true };
  },
});

// Admin: force a catalog sync for a single artist by ID
export const forceArtistCatalogSync = action({
  args: { artistId: v.id("artists") },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    await requireAdminForAction(ctx);
    const artist: any = await ctx.runQuery(apiRef.artists.getById, { id: args.artistId });
    if (!artist) {
      return { success: false, message: "Artist not found" };
    }

    await ctx.runAction(internalRef.spotify.syncArtistCatalog, {
      artistId: args.artistId,
      artistName: artist.name,
    });

    return { success: true, message: `Triggered catalog sync for ${artist.name}` };
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
    const user = await ctx.runQuery(apiRef.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      console.log("🎤 Importing trending artists from Ticketmaster...");

      // Fetch trending artists from Ticketmaster API
      const trendingArtists = await ctx.runAction(apiRef.ticketmaster.getTrendingArtists, { limit: 50 });

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
          const existing = await ctx.runQuery(internalRef.artists.getByTicketmasterIdInternal, {
            ticketmasterId: artist.ticketmasterId
          });

          if (!existing && artist.ticketmasterId && artist.name) {
            console.log(`📥 Importing new artist: ${artist.name}`);
            await ctx.runAction(apiRef.ticketmaster.triggerFullArtistSync, {
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
        await ctx.runAction(internalRef.maintenance.syncTrendingData, {});
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
export const testImportTrendingFromTicketmaster = internalAction({
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
      const trendingArtists = await ctx.runAction(apiRef.ticketmaster.getTrendingArtists, { limit: 50 });

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
          const existing = await ctx.runQuery(internalRef.artists.getByTicketmasterIdInternal, {
            ticketmasterId: artist.ticketmasterId
          });

          if (!existing && artist.ticketmasterId && artist.name) {
            console.log(`📥 Importing new artist: ${artist.name}`);
            await ctx.runAction(apiRef.ticketmaster.triggerFullArtistSync, {
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
        await ctx.runAction(internalRef.maintenance.syncTrendingData, {});
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

// Cleanup non-concert artists (children's music, orchestras, musicals, etc.)
export const cleanupNonConcertArtists = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    deletedCount: v.number(),
  }),
  handler: async (ctx) => {
    try {
      console.log("🧹 [CLEANUP] Starting cleanup of non-concert artists...");

      // Get all artists
      const artists = await ctx.runQuery(internalRef.artists.getAllInternal, {});
      console.log(`📊 Found ${artists.length} total artists to check`);

      const excludedGenres = [
        'children\'s music', 'childrens music', 'kids', 'family',
        'classical', 'orchestra', 'symphony', 'chamber', 'opera',
        'musical', 'theatre', 'broadway', 'show tunes',
        'spoken word', 'comedy', 'podcast',
      ];

      let deletedCount = 0;

      for (const artist of artists) {
        const genres = (artist.genres || []).map((g: string) => g.toLowerCase());
        const hasExcludedGenre = genres.some((genre: string) =>
          excludedGenres.some((excluded: string) => genre.includes(excluded))
        );

        if (hasExcludedGenre) {
          console.log(`🗑️ Deleting non-concert artist: ${artist.name} (genres: ${genres.join(', ')})`);

          try {
            // Delete artist's shows first
            const shows = await ctx.runQuery(internalRef.shows.getAllByArtistInternal, {
              artistId: artist._id
            });
            for (const show of shows) {
              await ctx.runMutation(internalRef.shows.deleteShowInternal, { showId: show._id });
            }

            // Delete artist's songs
            await ctx.runMutation(internalRef.songs.deleteByArtist, { artistId: artist._id });

            // Delete the artist
            await ctx.runMutation(internalRef.artists.deleteArtistInternal, { artistId: artist._id });

            deletedCount++;
          } catch (error) {
            console.error(`❌ Failed to delete artist ${artist.name}:`, error);
          }
        }
      }

      console.log(`✅ Cleanup complete: deleted ${deletedCount} non-concert artists`);

      return {
        success: true,
        message: `Successfully deleted ${deletedCount} non-concert artists`,
        deletedCount,
      };
    } catch (error) {
      console.error("❌ Cleanup failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
        deletedCount: 0,
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
      const songs = await ctx.runQuery(internalRef.songs.getAllForCleanup, {});
      console.log(`📊 Checking ${songs.length} songs for cleanup...`);

      for (const song of songs.slice(0, 100)) { // Limit for performance
        const shouldRemove = isNonStudioSong(song.title, song.album || '');

        if (shouldRemove) {
          try {
            // Remove song
            await ctx.runMutation(internalRef.songs.deleteSong, { songId: song._id });
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

// isNonStudioSong is now imported from ./adminHelpers

export const bulkDeleteFlaggedInternal = internalMutation({
  args: { id: v.id("contentFlags") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});

export const bulkDeleteFlagged = action({
  args: { ids: v.array(v.id("contentFlags")) },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    await requireAdminForAction(ctx);
    for (const id of args.ids) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.runMutation(internalRef.admin.bulkDeleteFlaggedInternal as any, { id });
    }
    return { deleted: args.ids.length };
  },
});

export const updateUserRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("user"), v.literal("admin")) },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const actorUserId = await requireAdmin(ctx);
    await ctx.db.patch(args.userId, { role: args.role });
    console.log(`Updated role for user ${args.userId} to ${args.role}`);
    await ctx.db.insert("adminAuditLogs", {
      actorUserId,
      action: "updateUserRole",
      args: { userId: args.userId, role: args.role },
      createdAt: Date.now(),
      success: true,
    });
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
            artistId = await ctx.db.insert("artists", { slug, name: show.artistName, ticketmasterId: show.artistTicketmasterId, lowerName, genres: [], images: show.artistImage ? [show.artistImage] : [], isActive: true, popularity: 0, followers: 0, trendingScore: 0, trendingRank: 0, upcomingShowsCount: 0, lastSynced: Date.now(), lastTrendingUpdate: Date.now() });
          } else {
            artistId = artist._id;
          }
        }
        let venue = await ctx.db.query("venues").withIndex("by_name_city", (q) => q.eq("name", show.venueName).eq("city", show.venueCity)).first();
        const venueId = venue ? venue._id : await ctx.db.insert("venues", { name: show.venueName, city: show.venueCity, country: show.venueCountry });
        const artist = await ctx.db.get(artistId);
        const ven = await ctx.db.get(venueId);
        if (!artist || !ven) continue;
        const slug = `${artist.slug}-${ven.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${ven.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${show.date}`.substring(0, 200);
        const showId = await ctx.db.insert("shows", { slug, artistId, venueId, date: show.date, startTime: show.startTime, status: (show.status || '').includes('cancel') ? 'cancelled' as const : 'upcoming' as const, ticketmasterId: show.ticketmasterId, ticketUrl: show.ticketUrl, priceRange: show.priceRange, voteCount: 0, setlistCount: 0, trendingScore: 0, trendingRank: 0, lastSynced: Date.now(), lastTrendingUpdate: Date.now() });
        await ctx.db.patch(show._id, { showId, artistId });
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
    const user = await ctx.runQuery(apiRef.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      console.log("🔄 Admin triggered backfill for missing setlists...");
      const result = await ctx.runMutation(internalRef.setlists.refreshMissingAutoSetlists, {
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
export const testBackfillMissingSetlists = internalAction({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ success: v.boolean(), message: v.string(), scheduled: v.number() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string; scheduled: number }> => {
    try {
      console.log("🔄 [TEST] Backfill for missing setlists...");
      const result = await ctx.runMutation(internalRef.setlists.refreshMissingAutoSetlists, {
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

// ============================================================
// CLEANUP FUNCTIONS FOR ARTISTS WITH NO SONGS
// ============================================================

/**
 * Remove artists with 0 songs from trending cache
 * These artists break the setlist functionality when clicked
 */
export const cleanupEmptyTrendingArtists = internalMutation({
  args: {},
  returns: v.object({
    removed: v.number(),
    kept: v.number(),
    checked: v.number(),
  }),
  handler: async (ctx) => {
    const trendingArtists = await ctx.db.query("trendingArtists").collect();

    let removed = 0;
    let kept = 0;

    for (const cached of trendingArtists) {
      // Check if the artist has songs in the database
      const artistId = cached.artistId;
      if (artistId) {
        const artistSongs = await ctx.db
          .query("artistSongs")
          .withIndex("by_artist", (q) => q.eq("artistId", artistId))
          .first();

        if (!artistSongs) {
          // No songs - remove from trending cache
          await ctx.db.delete(cached._id);
          console.log(`🗑️ Removed empty artist from trending: ${cached.name}`);
          removed++;
        } else {
          kept++;
        }
      } else {
        // No artistId linked - remove stale cache entry
        await ctx.db.delete(cached._id);
        console.log(`🗑️ Removed orphan trending entry: ${cached.name}`);
        removed++;
      }
    }

    console.log(`✅ Trending cleanup complete: removed ${removed}, kept ${kept}`);
    return { removed, kept, checked: trendingArtists.length };
  },
});

/**
 * Delete artists with 0 songs that have failed catalog sync
 * These are cluttering the database and will never have setlists
 */
export const deleteEmptyArtists = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    deleted: v.number(),
    skipped: v.number(),
    checked: v.number(),
    deletedNames: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true; // Default to dry run for safety
    const limit = args.limit || 100;

    // Get artists with failed catalog sync
    const artists = await ctx.db
      .query("artists")
      .filter((q) =>
        q.or(
          q.eq(q.field("catalogSyncStatus"), "failed"),
          // Also check for "completed" with no songs (sync bug)
          q.and(
            q.eq(q.field("catalogSyncStatus"), "completed"),
            q.or(
              q.eq(q.field("syncStatus.songCount"), 0),
              q.eq(q.field("syncStatus.songCount"), undefined)
            )
          )
        )
      )
      .take(limit * 2);

    let deleted = 0;
    let skipped = 0;
    const deletedNames: string[] = [];

    for (const artist of artists) {
      if (deleted >= limit) break;

      // Verify no songs exist
      const artistSongs = await ctx.db
        .query("artistSongs")
        .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
        .first();

      if (artistSongs) {
        // Has songs - don't delete
        skipped++;
        continue;
      }

      // Check if artist has any shows (we might want to keep them for shows)
      const shows = await ctx.db
        .query("shows")
        .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
        .first();

      if (shows) {
        // Has shows - keep the artist but mark for retry
        console.log(`⏭️ Keeping ${artist.name} - has shows, will retry catalog sync`);
        skipped++;
        continue;
      }

      // No songs and no shows - safe to delete
      if (!dryRun) {
        // Remove from trending cache first
        const trendingEntry = await ctx.db
          .query("trendingArtists")
          .filter((q) => q.eq(q.field("artistId"), artist._id))
          .first();
        if (trendingEntry) {
          await ctx.db.delete(trendingEntry._id);
        }

        // Delete the artist
        await ctx.db.delete(artist._id);
        console.log(`🗑️ Deleted empty artist: ${artist.name}`);
      } else {
        console.log(`[DRY RUN] Would delete: ${artist.name}`);
      }

      deletedNames.push(artist.name);
      deleted++;
    }

    console.log(`✅ Empty artist cleanup: ${dryRun ? '[DRY RUN] ' : ''}deleted ${deleted}, skipped ${skipped}`);
    return { deleted, skipped, checked: artists.length, deletedNames };
  },
});

/**
 * Retry catalog sync for artists with shows but no songs
 * These artists should have songs but sync failed
 */
export const retryFailedCatalogSyncs = action({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    scheduled: v.number(),
    skipped: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Get artists to retry
    const artistsToRetry = await ctx.runQuery(internalRef.admin.getArtistsNeedingCatalogRetry, { limit });

    let scheduled = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const artist of artistsToRetry) {
      try {
        // Reset the circuit breaker to allow retry
        await ctx.runMutation(internalRef.artists.updateSyncStatus, {
          artistId: artist._id,
          catalogSyncStatus: "pending",
          catalogSyncAttemptedAt: undefined,
          catalogSyncBackoffUntil: undefined,
          catalogSyncFailureCount: 0,
        });

        // Schedule the catalog sync
        await ctx.scheduler.runAfter(scheduled * 2000, internalRef.spotify.syncArtistCatalog, {
          artistId: artist._id,
          artistName: artist.name,
        });

        console.log(`🔄 Scheduled catalog retry for: ${artist.name}`);
        scheduled++;
      } catch (error) {
        const msg = `Failed to schedule retry for ${artist.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(msg);
        errors.push(msg);
        skipped++;
      }
    }

    console.log(`✅ Catalog retry complete: scheduled ${scheduled}, skipped ${skipped}`);
    return { scheduled, skipped, errors };
  },
});

/**
 * Query to find artists that need catalog sync retry
 */
export const getArtistsNeedingCatalogRetry = internalQuery({
  args: { limit: v.number() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Get artists with shows but failed/no catalog
    const artists = await ctx.db
      .query("artists")
      .filter((q) =>
        q.and(
          q.gt(q.field("upcomingShowsCount"), 0), // Has shows
          q.or(
            q.eq(q.field("catalogSyncStatus"), "failed"),
            q.eq(q.field("catalogSyncStatus"), "pending"),
            q.eq(q.field("catalogSyncStatus"), undefined)
          )
        )
      )
      .take(args.limit * 2);

    // Filter to only those with no songs
    const needsRetry: any[] = [];

    for (const artist of artists) {
      if (needsRetry.length >= args.limit) break;

      // Skip if in backoff period
      if (artist.catalogSyncBackoffUntil && Date.now() < artist.catalogSyncBackoffUntil) {
        continue;
      }

      // Check if has songs
      const artistSong = await ctx.db
        .query("artistSongs")
        .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
        .first();

      if (!artistSong) {
        needsRetry.push(artist);
      }
    }

    return needsRetry;
  },
});

// Delete residency artists (those with 50+ shows - Vegas residencies, etc.)
export const deleteResidencyArtists = action({
  args: { maxShows: v.optional(v.number()) },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    deletedArtists: v.number(),
    deletedShows: v.number(),
    deletedSongs: v.number()
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    message: string;
    deletedArtists: number;
    deletedShows: number;
    deletedSongs: number;
  }> => {
    const maxShows = args.maxShows || 50; // Default: 50+ shows = residency

    console.log(`🗑️ Deleting residency artists with more than ${maxShows} shows...`);

    const result = await ctx.runMutation(internalRef.admin.deleteResidencyArtistsInternal, { maxShows });

    return {
      success: true,
      message: `Deleted ${result.deletedArtists} residency artists, ${result.deletedShows} shows, ${result.deletedSongs} songs`,
      ...result
    };
  },
});

export const deleteResidencyArtistsInternal = internalMutation({
  args: { maxShows: v.number() },
  returns: v.object({
    deletedArtists: v.number(),
    deletedShows: v.number(),
    deletedSongs: v.number()
  }),
  handler: async (ctx, args) => {
    let deletedArtists = 0;
    let deletedShows = 0;
    let deletedSongs = 0;

    // Get all artists
    const artists = await ctx.db.query("artists").collect();

    for (const artist of artists) {
      // Count their shows
      const shows = await ctx.db
        .query("shows")
        .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
        .collect();

      if (shows.length > args.maxShows) {
        console.log(`🗑️ Deleting residency artist: ${artist.name} (${shows.length} shows)`);

        // Delete all their shows and associated setlists
        for (const show of shows) {
          // Delete setlists for this show
          const setlists = await ctx.db
            .query("setlists")
            .withIndex("by_show", (q) => q.eq("showId", show._id))
            .collect();
          for (const setlist of setlists) {
            await ctx.db.delete(setlist._id);
          }

          await ctx.db.delete(show._id);
          deletedShows++;
        }

        // Delete their songs
        const artistSongs = await ctx.db
          .query("artistSongs")
          .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
          .collect();
        for (const as of artistSongs) {
          await ctx.db.delete(as._id);
          deletedSongs++;
        }

        // Delete from trending cache
        const trendingArtist = await ctx.db
          .query("trendingArtists")
          .filter((q) => q.eq(q.field("artistId"), artist._id))
          .first();
        if (trendingArtist) {
          await ctx.db.delete(trendingArtist._id);
        }

        // Delete the artist
        await ctx.db.delete(artist._id);
        deletedArtists++;
      }
    }

    console.log(`✅ Deleted ${deletedArtists} artists, ${deletedShows} shows, ${deletedSongs} song links`);

    return { deletedArtists, deletedShows, deletedSongs };
  },
});

// ============================================================================
// SHOW SONG DEMAND BACKFILL
// ============================================================================

/**
 * Backfill/reconcile showSongDemand from existing songVotes.
 * This rebuilds the aggregated demand data for artist dashboards.
 */
export const backfillShowSongDemand = action({
  args: {
    mode: v.optional(v.union(v.literal("rebuild"), v.literal("reconcile"))),
    showIds: v.optional(v.array(v.id("shows"))),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    stats: v.object({
      showsProcessed: v.number(),
      demandRecordsCreated: v.number(),
      demandRecordsUpdated: v.number(),
      demandRecordsDeleted: v.number(),
      totalVotesProcessed: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    await requireAdminForAction(ctx);

    const mode = args.mode ?? "reconcile";
    console.log(`🔄 Starting showSongDemand ${mode}...`);

    const result = await ctx.runMutation(internalRef.admin.backfillShowSongDemandInternal, {
      mode,
      showIds: args.showIds,
    });

    console.log(`✅ Backfill complete: ${result.showsProcessed} shows, ${result.totalVotesProcessed} votes processed`);

    return {
      success: true,
      message: `${mode === "rebuild" ? "Rebuilt" : "Reconciled"} demand for ${result.showsProcessed} shows (${result.demandRecordsCreated} created, ${result.demandRecordsUpdated} updated, ${result.demandRecordsDeleted} deleted)`,
      stats: result,
    };
  },
});

// normalizeSongKey is now imported from ./adminHelpers

export const backfillShowSongDemandInternal = internalMutation({
  args: {
    mode: v.union(v.literal("rebuild"), v.literal("reconcile")),
    showIds: v.optional(v.array(v.id("shows"))),
  },
  returns: v.object({
    showsProcessed: v.number(),
    demandRecordsCreated: v.number(),
    demandRecordsUpdated: v.number(),
    demandRecordsDeleted: v.number(),
    totalVotesProcessed: v.number(),
  }),
  handler: async (ctx, args) => {
    let showsProcessed = 0;
    let demandRecordsCreated = 0;
    let demandRecordsUpdated = 0;
    let demandRecordsDeleted = 0;
    let totalVotesProcessed = 0;

    // Get shows to process
    let shows;
    if (args.showIds && args.showIds.length > 0) {
      shows = await Promise.all(args.showIds.map(id => ctx.db.get(id)));
      shows = shows.filter(Boolean);
    } else {
      // Process all shows with upcoming or recent status
      shows = await ctx.db.query("shows").collect();
    }

    for (const show of shows) {
      if (!show) continue;

      // Get all setlists for this show
      const setlists = await ctx.db
        .query("setlists")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();

      if (setlists.length === 0) continue;

      const setlistIds = setlists.map(s => s._id);

      // Aggregate votes by normalized song key
      const songDemandMap = new Map<string, { songTitle: string; upvotes: number; lastVoteAt: number }>();

      for (const setlistId of setlistIds) {
        const votes = await ctx.db
          .query("songVotes")
          .withIndex("by_setlist", (q) => q.eq("setlistId", setlistId))
          .collect();

        for (const vote of votes) {
          totalVotesProcessed++;
          const songKey = normalizeSongKey(vote.songTitle);
          const existing = songDemandMap.get(songKey);

          if (existing) {
            existing.upvotes++;
            if (vote.createdAt > existing.lastVoteAt) {
              existing.lastVoteAt = vote.createdAt;
              // Keep the most recent song title formatting
              existing.songTitle = vote.songTitle;
            }
          } else {
            songDemandMap.set(songKey, {
              songTitle: vote.songTitle,
              upvotes: 1,
              lastVoteAt: vote.createdAt,
            });
          }
        }
      }

      // If rebuild mode, delete existing demand records first
      if (args.mode === "rebuild") {
        const existingDemand = await ctx.db
          .query("showSongDemand")
          .withIndex("by_show", (q) => q.eq("showId", show._id))
          .collect();

        for (const d of existingDemand) {
          await ctx.db.delete(d._id);
          demandRecordsDeleted++;
        }
      }

      // Upsert demand records
      for (const [songKey, data] of songDemandMap.entries()) {
        if (args.mode === "reconcile") {
          // Check for existing record
          const existing = await ctx.db
            .query("showSongDemand")
            .withIndex("by_show_and_songKey", (q) =>
              q.eq("showId", show._id).eq("songKey", songKey)
            )
            .first();

          if (existing) {
            // Update if counts differ
            if (existing.upvotes !== data.upvotes || existing.lastVoteAt < data.lastVoteAt) {
              await ctx.db.patch(existing._id, {
                upvotes: data.upvotes,
                lastVoteAt: data.lastVoteAt,
                songTitle: data.songTitle,
              });
              demandRecordsUpdated++;
            }
          } else {
            // Create new
            await ctx.db.insert("showSongDemand", {
              showId: show._id,
              songKey,
              songTitle: data.songTitle,
              upvotes: data.upvotes,
              lastVoteAt: data.lastVoteAt,
            });
            demandRecordsCreated++;
          }
        } else {
          // Rebuild mode - just insert
          await ctx.db.insert("showSongDemand", {
            showId: show._id,
            songKey,
            songTitle: data.songTitle,
            upvotes: data.upvotes,
            lastVoteAt: data.lastVoteAt,
          });
          demandRecordsCreated++;
        }
      }

      // In reconcile mode, remove stale demand records (songs no longer voted for)
      if (args.mode === "reconcile") {
        const existingDemand = await ctx.db
          .query("showSongDemand")
          .withIndex("by_show", (q) => q.eq("showId", show._id))
          .collect();

        for (const d of existingDemand) {
          if (!songDemandMap.has(d.songKey)) {
            await ctx.db.delete(d._id);
            demandRecordsDeleted++;
          }
        }
      }

      showsProcessed++;
    }

    return {
      showsProcessed,
      demandRecordsCreated,
      demandRecordsUpdated,
      demandRecordsDeleted,
      totalVotesProcessed,
    };
  },
});
