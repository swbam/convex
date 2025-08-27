import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Helper function to get authenticated user ID from app users table
export const getAuthUserId = async (ctx: any): Promise<Id<"users"> | null> => {
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
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    
    // Check if app user exists
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .first();
    
    return {
      identity,
      appUser
    };
  },
});

export const createAppUser = mutation({
  args: {},
  handler: async (ctx) => {
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
      bio: undefined,
      role: "user",
    });
  },
});