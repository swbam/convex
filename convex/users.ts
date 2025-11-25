import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
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

// ONE-TIME BOOTSTRAP: Promote the initial admin user
// Remove this after first successful run
export const bootstrapAdminUser = mutation({
  args: { email: v.string(), secretKey: v.string() },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    // Hardcoded secret to prevent unauthorized access
    if (args.secretKey !== "setlists2024bootstrap") {
      return { success: false, message: "Invalid secret key" };
    }
    
    const lowerEmail = args.email.toLowerCase();
    const users = await ctx.db.query("users").collect();
    
    // Find the REAL user (one with Clerk authId starting with "user_")
    const realUser = users.find(u => 
      u.email?.toLowerCase() === lowerEmail && 
      u.authId?.startsWith("user_") &&
      !u.authId?.includes("abc") &&
      !u.authId?.includes("test")
    );
    
    if (!realUser) {
      return { success: false, message: `No real user found with email ${args.email}` };
    }
    
    if (realUser.role === "admin") {
      return { success: true, message: `User ${args.email} is already admin` };
    }
    
    await ctx.db.patch(realUser._id, { role: "admin" });
    return { success: true, message: `Promoted ${args.email} (ID: ${realUser._id}) to admin` };
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

// UNIFIED function for Clerk webhook - handles both create and update
export const upsertFromClerk = internalMutation({
  args: { clerkUser: v.any() },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const { id, email_addresses, first_name, last_name, image_url, unsafe_metadata, public_metadata, external_accounts } = args.clerkUser;
    const email = email_addresses?.[0]?.email_address || "";
    const name = [first_name, last_name].filter(Boolean).join(" ") || email || "User";
    const avatar = image_url;
    
    // CRITICAL: Extract Spotify ID from external_accounts (Clerk webhook payload)
    const spotifyAccount = external_accounts?.find((acc: any) => acc.provider === 'oauth_spotify');
    const spotifyId = spotifyAccount?.provider_user_id || unsafe_metadata?.spotifyId;
    const role = (public_metadata?.role || unsafe_metadata?.role) === "admin" ? "admin" : "user";

    console.log('🔵 Clerk webhook: upsertFromClerk', {
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
        role,
        preferences: {
          emailNotifications: true,
          favoriteGenres: [],
        },
        createdAt: Date.now(),
      });
      console.log('✅ User created from webhook:', userId);
    } else {
      // CRITICAL: Preserve preferences when updating, only update if they don't exist
      const updateData: any = { email, name, avatar, spotifyId, role };
      if (!user.preferences) {
        updateData.preferences = {
          emailNotifications: true,
          favoriteGenres: [],
        };
      }
      await ctx.db.patch(user._id, updateData);
      userId = user._id;
      console.log('✅ User updated from webhook:', userId);
    }

    return userId;
  },
});

// Legacy function - redirects to upsertFromClerk
export const createFromClerk = internalMutation({
  args: { clerkUser: v.any() },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Break circular type inference by casting `internal` for same-file reference
    const upsertRef = (internal as any).users.upsertFromClerk as any;
    const id = await ctx.runMutation(upsertRef, { clerkUser: args.clerkUser });
    return id;
  },
});

export const updateFromClerk = internalMutation({
  args: { clerkUser: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, email_addresses, first_name, last_name, image_url, unsafe_metadata, public_metadata, external_accounts } = args.clerkUser;
    const email = email_addresses?.[0]?.email_address;
    const name = [first_name, last_name].filter(Boolean).join(" ") || email;
    const avatar = image_url;

    // CRITICAL: Extract Spotify ID from external_accounts (Clerk webhook payload)
    const spotifyAccount = external_accounts?.find((acc: any) => acc.provider === 'oauth_spotify');
    const spotifyId = spotifyAccount?.provider_user_id || unsafe_metadata?.spotifyId;
    const role = (public_metadata?.role || unsafe_metadata?.role) === "admin" ? "admin" : "user";

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
      await ctx.db.patch(user._id, { email, name, avatar, spotifyId, role });
      console.log('✅ User updated from webhook:', user._id);
    }
    return null;
  },
});

// (Duplicate upsertFromClerk removed to avoid redeclaration)

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
    const tokenRecords = await ctx.db.query("spotifyTokens").collect();
    if (tokenRecords.length === 0) {
      return [];
    }

    const uniqueUserIds = Array.from(new Set(tokenRecords.map((token) => token.userId)));
    const users = await Promise.all(uniqueUserIds.map((id) => ctx.db.get(id)));

    return users.filter((user): user is NonNullable<(typeof users)[number]> => user !== null);
  },
});

// Manual user creation for bootstrap/admin setup
export const createManualUser = internalMutation({
  args: { 
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("user"), v.literal("admin"))
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Generate a fake authId for manual users
    const authId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return await ctx.db.insert("users", {
      authId,
      email: args.email,
      name: args.name,
      username: args.email.split('@')[0],
      role: args.role,
      preferences: {
        emailNotifications: true,
        favoriteGenres: [],
      },
      createdAt: Date.now(),
    });
  },
});

// Public function to sync current user from Clerk
export const syncCurrentUser = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be logged in");
    }

    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .first();

    if (existing) {
      console.log('✅ User already exists:', existing._id);
      return existing._id;
    }

    // Create new user from Clerk identity
    const email = identity.email || "";
    const name = identity.name || identity.email || "User";
    const username = email.split('@')[0] || name.toLowerCase().replace(/\s+/g, '');

    const userId = await ctx.db.insert("users", {
      authId: identity.subject,
      email,
      name,
      username,
      role: "user",
      preferences: {
        emailNotifications: true,
        favoriteGenres: [],
      },
      createdAt: Date.now(),
    });

    console.log('✅ User created from Clerk identity:', userId);
    return userId;
  },
});
