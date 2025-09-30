import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "./auth";

// Get current user profile
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    return user;
  },
});

// Update user profile
export const updateProfile = mutation({
  args: {
    username: v.optional(v.string()),
    bio: v.optional(v.string()),
    preferences: v.optional(v.object({
      emailNotifications: v.boolean(),
      favoriteGenres: v.array(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if username is already taken (if provided and different from current)
    if (args.username && args.username !== user.username) {
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", args.username!))
        .first();
      
      if (existingUser) {
        throw new Error("Username already taken");
      }
    }

    const updateData: any = {};
    if (args.username !== undefined) {
      updateData.username = args.username;
    }
    if (args.bio !== undefined) {
      updateData.bio = args.bio;
    }
    if (args.preferences !== undefined) {
      updateData.preferences = args.preferences;
    }

    await ctx.db.patch(user._id, updateData);
    
    return await ctx.db.get(user._id);
  },
});

// Get user statistics
export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    // Count user's votes
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Note: Following removed as per user request

    // Count user's setlists
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return {
      totalVotes: votes.length,
      totalSetlists: setlists.length,
      joinedAt: user._creationTime,
    };
  },
});

// Note: getUserFollows removed as per user request

// Get user's setlists
export const getUserSetlists = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return [];
    }

    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Populate show and artist data
    const setlistsWithDetails = await Promise.all(
      setlists.map(async (setlist) => {
        const show = await ctx.db.get(setlist.showId);
        if (!show) return null;
        
        const [artist, venue] = await Promise.all([
          ctx.db.get(show.artistId),
          ctx.db.get(show.venueId),
        ]);
        
        return { ...setlist, show: { ...show, artist, venue } };
      })
    );

    return setlistsWithDetails.filter(Boolean);
  },
});

// Internal: get user by email, case-insensitive
export const getByEmailCaseInsensitive = internalQuery({
  args: { email: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const exact = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (exact) return exact;
    const target = args.email.toLowerCase();
    for await (const u of ctx.db.query("users")) {
      if ((u.email || "").toLowerCase() === target) return u;
    }
    return null;
  },
});

// Internal: set user role by id
export const setUserRoleById = internalMutation({
  args: { userId: v.id("users"), role: v.union(v.literal("user"), v.literal("admin"), v.literal("banned")) },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { role: args.role });
    return { success: true };
  },
});

export const createFromClerk = mutation({
  args: { clerkUser: v.any() },
  handler: async (ctx, args) => {
    const { id, email_addresses, full_name, image_url, public_metadata } = args.clerkUser;
    const email = email_addresses[0]?.email_address;
    const name = full_name || email;
    const avatar = image_url;
    const spotifyId = public_metadata.spotifyId;

    // Check existing
    let user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", { fields: ["authId"] })
      .filter((q) => q.eq("authId", id))
      .first();

    if (!user) {
      userId = await ctx.db.insert("users", {
        authId: id,
        email,
        name,
        avatar,
        spotifyId,
        role: "user", // Default
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.patch(user._id, { email, name, avatar, spotifyId });
      userId = user._id;
    }

    return userId;
  },
});

export const updateFromClerk = mutation({
  args: { clerkUser: v.any() },
  handler: async (ctx, args) => {
    const { id, email_addresses, full_name, image_url, public_metadata } = args.clerkUser;
    const email = email_addresses[0]?.email_address;
    const name = full_name || email;
    const avatar = image_url;
    const spotifyId = public_metadata.spotifyId;

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", { fields: ["authId"] })
      .filter((q) => q.eq("authId", id))
      .first();

    if (user) {
      await ctx.db.patch(user._id, { email, name, avatar, spotifyId });
    }
  },
});

// For rate-limit in followArtist, fix to use runQuery
export const followArtist = mutation({
  args: { artistId: v.id("artists") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const recentFollows = await ctx.runQuery(internal.users.getRecentActions, { userId, action: "follow", timeWindow: 60000 });

    if (recentFollows.length >= 10) throw new Error("Rate limit exceeded");

    await ctx.db.insert("userActions", { userId, action: "follow", timestamp: Date.now() });

    // Existing follow logic...
  },
});

// Add getRecentActions query
export const getRecentActions = query({
  args: { userId: v.id("users"), action: v.string(), timeWindow: v.number() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userActions")
      .withIndex("by_user_time", { fields: ["userId", "timestamp"] })
      .filter((q) => q.eq("userId", args.userId) && q.eq("action", args.action) && q.gt("timestamp", Date.now() - args.timeWindow))
      .collect();
  },
});