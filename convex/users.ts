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
  args: { userId: v.id("users"), role: v.union(v.literal("user"), v.literal("admin")) },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { role: args.role });
    return { success: true };
  },
});

export const createFromClerk = internalMutation({
  args: { clerkUser: v.any() },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const { id, email_addresses, first_name, last_name, image_url, unsafe_metadata, external_accounts } = args.clerkUser;
    const email = email_addresses?.[0]?.email_address || "";
    const name = [first_name, last_name].filter(Boolean).join(" ") || email || "User";
    const avatar = image_url;
    
    // CRITICAL: Extract Spotify ID from external_accounts (Clerk webhook payload)
    const spotifyAccount = external_accounts?.find((acc: any) => acc.provider === 'oauth_spotify');
    const spotifyId = spotifyAccount?.provider_user_id || unsafe_metadata?.spotifyId;

    console.log('🔵 Clerk webhook: createFromClerk', {
      clerkId: id,
      email,
      hasSpotifyAccount: !!spotifyAccount,
      spotifyId: spotifyId || 'none'
    });

    // Check existing
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", id))
      .first();

    let userId;
    if (!user) {
      userId = await ctx.db.insert("users", {
        authId: id,
        email,
        name,
        username: email.split('@')[0] || name.toLowerCase().replace(/\s+/g, ''),
        avatar,
        spotifyId,
        role: "user" as const,
        createdAt: Date.now(),
      });
      console.log('✅ User created from webhook:', userId);
    } else {
      await ctx.db.patch(user._id, { email, name, avatar, spotifyId });
      userId = user._id;
      console.log('✅ User updated from webhook:', userId);
    }

    return userId;
  },
});

export const updateFromClerk = internalMutation({
  args: { clerkUser: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, email_addresses, first_name, last_name, image_url, unsafe_metadata, external_accounts } = args.clerkUser;
    const email = email_addresses?.[0]?.email_address;
    const name = [first_name, last_name].filter(Boolean).join(" ") || email;
    const avatar = image_url;

    // CRITICAL: Extract Spotify ID from external_accounts (Clerk webhook payload)
    const spotifyAccount = external_accounts?.find((acc: any) => acc.provider === 'oauth_spotify');
    const spotifyId = spotifyAccount?.provider_user_id || unsafe_metadata?.spotifyId;

    console.log('🔵 Clerk webhook: updateFromClerk', {
      clerkId: id,
      email,
      hasSpotifyAccount: !!spotifyAccount,
      spotifyId: spotifyId || 'none'
    });

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", id))
      .first();

    if (user) {
      await ctx.db.patch(user._id, { email, name, avatar, spotifyId });
      console.log('✅ User updated from webhook:', user._id);
    }
    return null;
  },
});

// FIXED: Alias for createFromClerk (which already does upsert logic)
export const upsertFromClerk = createFromClerk;

// FIXED: Add deleteFromClerk mutation for Clerk webhooks
export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.clerkUserId))
      .first();

    if (user) {
      await ctx.db.delete(user._id);
      console.log('✅ User deleted from webhook:', user._id);
    } else {
      console.warn('⚠️ User not found for deletion:', args.clerkUserId);
    }

    return null;
  },
});

// Add getRecentActions query for rate limiting
export const getRecentActions = internalQuery({
  args: { userId: v.id("users"), action: v.string(), timeWindow: v.number() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const threshold = Date.now() - args.timeWindow;
    return await ctx.db
      .query("userActions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.gt(q.field("timestamp"), threshold))
      .collect();
  },
});

export const getUsersWithSpotify = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("spotifyId"), undefined))
      .take(50);
  },
});