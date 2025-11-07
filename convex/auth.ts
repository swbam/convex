import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const USERNAME_MAX_ATTEMPTS = 20;

const sanitizeUsername = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

const extractString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

// Helper to extract Spotify ID from Clerk identity
function extractSpotifyId(identity: any): string | undefined {
  // Check various places Spotify ID might be stored
  if (identity?.spotifyId) return String(identity.spotifyId);
  if (identity?.externalAccounts) {
    const spotifyAccount = identity.externalAccounts.find((acc: any) => 
      acc.provider === 'spotify' || acc.provider === 'oauth_spotify'
    );
    if (spotifyAccount?.providerAccountId || spotifyAccount?.provider_user_id) {
      return String(spotifyAccount.providerAccountId || spotifyAccount.provider_user_id);
    }
  }
  if (identity?.unsafeMetadata?.spotifyId) return String(identity.unsafeMetadata.spotifyId);
  if (identity?.publicMetadata?.spotifyId) return String(identity.publicMetadata.spotifyId);
  return undefined;
}

function extractRoleFromIdentity(identity: any): "user" | "admin" {
  // Preferred: role claim from JWT template (maps Clerk public_metadata.role)
  const roleClaim = (identity && (identity as any).role) as string | undefined;
  const publicMetaRole =
    (identity && (identity as any).publicMetadata?.role) as string | undefined;
  const unsafeMetaRole =
    (identity && (identity as any).unsafeMetadata?.role) as string | undefined;
  const role = roleClaim || publicMetaRole || unsafeMetaRole || "user";
  return role === "admin" ? "admin" : "user";
}

async function generateUniqueUsername(ctx: MutationCtx, seed: string | null | undefined) {
  const base = sanitizeUsername(seed ?? "");
  const fallbackBase = base.length > 0 ? base : "user";

  for (let attempt = 0; attempt < USERNAME_MAX_ATTEMPTS; attempt++) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const candidate = `${fallbackBase}${suffix}`;
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", candidate))
      .first();
    if (!existing) {
      return candidate;
    }
  }

  return `${fallbackBase}-${Math.random().toString(36).slice(2, 8)}`;
}

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
    
    const usernameSeed =
      extractString(identity.username) ??
      extractString(identity.name) ??
      extractString(identity.givenName) ??
      (extractString(identity.email) ? extractString(identity.email)!.split("@")[0] : null);
    const username = await generateUniqueUsername(ctx, usernameSeed || extractString(identity.subject) || "user");

    // Create app user
    const role = extractRoleFromIdentity(identity);
    return await ctx.db.insert("users", {
      authId: identity.subject,
      username,
      role,
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

    if (existing) {
      // CRITICAL: Keep user data in sync with Clerk
      const desiredRole = extractRoleFromIdentity(identity);
      const avatar = extractString(identity.pictureUrl) || extractString(identity.imageUrl);
      const spotifyId = extractSpotifyId(identity);
      const email = extractString(identity.email) || existing.email;
      const name = extractString(identity.name) || existing.name;
      
      // Update fields that may have changed in Clerk
      const updates: any = {};
      if (desiredRole !== existing.role) updates.role = desiredRole;
      if (avatar && avatar !== existing.avatar) updates.avatar = avatar;
      if (spotifyId && spotifyId !== existing.spotifyId) updates.spotifyId = spotifyId;
      if (email !== existing.email) updates.email = email;
      if (name !== existing.name) updates.name = name;
      
      // Ensure preferences exist
      if (!existing.preferences) {
        updates.preferences = {
          emailNotifications: true,
          favoriteGenres: [],
        };
      }
      
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
        console.log('✅ User synced from Clerk:', existing._id, updates);
      }
      
      return existing._id;
    }
    
    // Extract email and name from Clerk identity
    const email = extractString(identity.email) || "";
    const name = extractString(identity.name) || email || "User";
    const usernameSeed =
      extractString(identity.username) ??
      extractString(identity.name) ??
      extractString(identity.givenName) ??
      (email ? email.split("@")[0] : null);
    const username = await generateUniqueUsername(ctx, usernameSeed || name);
    
    // CRITICAL: Extract avatar and spotifyId from identity
    const avatar = extractString(identity.pictureUrl) || extractString(identity.imageUrl);
    const spotifyId = extractSpotifyId(identity);
    
    const role = extractRoleFromIdentity(identity);
    return await ctx.db.insert("users", {
      authId: identity.subject,
      email,
      name,
      username,
      avatar,
      spotifyId,
      role,
      preferences: {
        emailNotifications: true,
        favoriteGenres: [],
      },
      createdAt: Date.now(),
    });
  },
});
