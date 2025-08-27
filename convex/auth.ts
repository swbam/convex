import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { query, mutation } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, Anonymous],
});

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const authUser = await ctx.db.get(userId);
    if (!authUser) {
      return null;
    }
    
    // Check if app user exists
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", userId))
      .first();
    
    return { ...authUser, appUser };
  },
});

export const createAppUser = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in");
    }
    
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Check if app user already exists
    const existingAppUser = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", userId))
      .first();
    
    if (existingAppUser) {
      return existingAppUser._id;
    }
    
    // Create app user
    return await ctx.db.insert("users", {
      authId: userId,
      username: (user as any).name || (user as any).email || "Anonymous",
      bio: undefined,
      role: "user",
    });
  },
});
