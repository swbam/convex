import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper function to get authenticated user ID from app users table
export const getAuthUserId = async (ctx: QueryCtx): Promise<Id<"users"> | null> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  
  // Find the corresponding app user by auth ID (Clerk subject)
  const appUser = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
    .first();
  
  return appUser?._id || null;
};

export const loggedInUser = query({
  args: {},
  returns: v.union(
    v.object({
      identity: v.any(),
      appUser: v.optional(v.any()),
      needsSetup: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const appUser = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .first();

    return {
      identity,
      appUser,
      needsSetup: !appUser,
    };
  },
});

export const createAppUser = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx: MutationCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be logged in");
    }
    
    // Check if app user already exists
    const existingAppUser = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .first();
    
    if (existingAppUser) {
      return existingAppUser._id;
    }
    
    // Create app user
    return await ctx.db.insert("users", {
      authId: identity.subject,
      username: identity.name || identity.email || "Anonymous",
      role: "user",
      preferences: {
        emailNotifications: true,
        favoriteGenres: [],
      },
      createdAt: Date.now(),
    });
  },
});

export const ensureUserExists = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx: MutationCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be logged in");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .first();

    if (existing) return existing._id;
    
    // Extract email and name from Clerk identity
    const email = identity.email || "";
    const name = identity.name || identity.email || "User";
    const username = email.split('@')[0] || name.toLowerCase().replace(/\s+/g, '');
    
    return await ctx.db.insert("users", {
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
  },
});