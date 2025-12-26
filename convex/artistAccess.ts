import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================================
// HELPERS
// ============================================================================

async function getCurrentAppUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
    .first();
}

type ArtistRole = "owner" | "manager" | "viewer";

const ROLE_LEVELS: Record<ArtistRole, number> = {
  viewer: 0,
  manager: 1,
  owner: 2,
};

/**
 * Require that the current user has at least the specified role for an artist.
 * Throws if not authenticated or insufficient permissions.
 */
async function requireArtistAccess(
  ctx: QueryCtx | MutationCtx,
  artistId: Id<"artists">,
  minimumRole: ArtistRole = "viewer"
): Promise<{ user: Doc<"users">; membership: Doc<"artistMembers"> }> {
  const user = await getCurrentAppUser(ctx);
  if (!user) throw new Error("Sign in required");

  const membership = await ctx.db
    .query("artistMembers")
    .withIndex("by_user_artist", (q) =>
      q.eq("userId", user._id).eq("artistId", artistId)
    )
    .first();

  if (!membership) throw new Error("No access to this artist");

  if (ROLE_LEVELS[membership.role] < ROLE_LEVELS[minimumRole]) {
    throw new Error(`Requires ${minimumRole} access`);
  }

  return { user, membership };
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Check if the current user has artist access and return their artists.
 * This is the main entry point for the /for-artists landing page.
 * 
 * Access is granted via:
 * 1. Direct Spotify ID match (user's spotifyId === artist's spotifyId)
 * 2. Existing artistMembers record (team invite)
 */
export const getMyArtistAccess = query({
  args: {},
  returns: v.object({
    hasAccess: v.boolean(),
    reason: v.optional(v.union(
      v.literal("not_signed_in"),
      v.literal("no_spotify"),
      v.literal("not_an_artist")
    )),
    artists: v.optional(v.array(
      v.object({
        artist: v.any(),
        role: v.union(v.literal("owner"), v.literal("manager"), v.literal("viewer")),
      })
    )),
  }),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    
    if (!user) {
      return { hasAccess: false, reason: "not_signed_in" as const };
    }

    if (!user.spotifyId) {
      return { hasAccess: false, reason: "no_spotify" as const };
    }

    // Method 1: Check for direct Spotify ID match
    // This catches artists whose Spotify user ID matches their artist profile ID
    const matchedArtist = await ctx.db
      .query("artists")
      .withIndex("by_spotify_id", (q) => q.eq("spotifyId", user.spotifyId))
      .first();

    if (matchedArtist) {
      // Check if already a member
      const existingMembership = await ctx.db
        .query("artistMembers")
        .withIndex("by_user_artist", (q) =>
          q.eq("userId", user._id).eq("artistId", matchedArtist._id)
        )
        .first();

      if (!existingMembership) {
        // Auto-create owner membership for matched Spotify ID
        // Note: This happens on query, so we return the result but the mutation
        // to create the membership should happen separately
        return {
          hasAccess: true,
          artists: [{ artist: matchedArtist, role: "owner" as const }],
        };
      }

      // Already a member, include in results below
    }

    // Method 2: Check artistMembers table for team invites
    const memberships = await ctx.db
      .query("artistMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (memberships.length > 0) {
      const artistsWithRoles = await Promise.all(
        memberships.map(async (m) => {
          const artist = await ctx.db.get(m.artistId);
          return artist ? { artist, role: m.role } : null;
        })
      );

      const validArtists = artistsWithRoles.filter(
        (a): a is { artist: Doc<"artists">; role: ArtistRole } => a !== null
      );

      if (validArtists.length > 0) {
        return { hasAccess: true, artists: validArtists };
      }
    }

    // Handle case where Spotify ID matched but no membership exists yet
    // Return access true so frontend can trigger the auto-join mutation
    if (matchedArtist) {
      return {
        hasAccess: true,
        artists: [{ artist: matchedArtist, role: "owner" as const }],
      };
    }

    return { hasAccess: false, reason: "not_an_artist" as const };
  },
});

/**
 * Auto-join as owner if user's Spotify ID matches an artist's Spotify ID.
 * Called by frontend when getMyArtistAccess returns a matched artist without membership.
 */
export const autoJoinAsOwner = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    artistId: v.optional(v.id("artists")),
    message: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return { success: false, message: "Not signed in" };
    if (!user.spotifyId) return { success: false, message: "No Spotify connected" };

    // Find matching artist
    const matchedArtist = await ctx.db
      .query("artists")
      .withIndex("by_spotify_id", (q) => q.eq("spotifyId", user.spotifyId))
      .first();

    if (!matchedArtist) {
      return { success: false, message: "No matching artist found" };
    }

    // Check if already a member
    const existing = await ctx.db
      .query("artistMembers")
      .withIndex("by_user_artist", (q) =>
        q.eq("userId", user._id).eq("artistId", matchedArtist._id)
      )
      .first();

    if (existing) {
      return { success: true, artistId: matchedArtist._id, message: "Already a member" };
    }

    // Create owner membership
    await ctx.db.insert("artistMembers", {
      artistId: matchedArtist._id,
      userId: user._id,
      role: "owner",
      createdAt: Date.now(),
    });

    return { success: true, artistId: matchedArtist._id };
  },
});

/**
 * Get artists the current user has access to.
 * Legacy function - use getMyArtistAccess for the landing page flow.
 */
export const getMyArtists = query({
  args: {},
  returns: v.array(
    v.object({
      artist: v.any(),
      role: v.union(v.literal("owner"), v.literal("manager"), v.literal("viewer")),
    })
  ),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return [];

    const memberships = await ctx.db
      .query("artistMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const results: Array<{ artist: Doc<"artists">; role: ArtistRole }> = [];
    for (const m of memberships) {
      const artist = await ctx.db.get(m.artistId);
      if (!artist) continue;
      results.push({ artist, role: m.role });
    }

    return results;
  },
});

/**
 * Check if current user is a member of a specific artist.
 */
export const isArtistMember = query({
  args: { artistId: v.id("artists") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return false;

    const membership = await ctx.db
      .query("artistMembers")
      .withIndex("by_user_artist", (q) =>
        q.eq("userId", user._id).eq("artistId", args.artistId)
      )
      .first();

    return !!membership;
  },
});

/**
 * Get team members for an artist (owner only).
 */
export const getTeamMembers = query({
  args: { artistId: v.id("artists") },
  returns: v.array(
    v.object({
      _id: v.id("artistMembers"),
      userId: v.id("users"),
      role: v.union(v.literal("owner"), v.literal("manager"), v.literal("viewer")),
      createdAt: v.number(),
      user: v.object({
        _id: v.id("users"),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        avatar: v.optional(v.string()),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return [];

    // Verify caller has at least viewer access
    const membership = await ctx.db
      .query("artistMembers")
      .withIndex("by_user_artist", (q) =>
        q.eq("userId", user._id).eq("artistId", args.artistId)
      )
      .first();

    if (!membership) return [];

    // Get all team members
    const members = await ctx.db
      .query("artistMembers")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .collect();

    const results = await Promise.all(
      members.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        if (!memberUser) return null;

        return {
          _id: m._id,
          userId: m.userId,
          role: m.role,
          createdAt: m.createdAt,
          user: {
            _id: memberUser._id,
            name: memberUser.name,
            email: memberUser.email,
            avatar: memberUser.avatar,
          },
        };
      })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Invite a team member by email (owner only).
 * The invitee must already have a user account.
 */
export const inviteTeamMember = mutation({
  args: {
    artistId: v.id("artists"),
    email: v.string(),
    role: v.union(v.literal("manager"), v.literal("viewer")),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Verify caller is owner
    const { user } = await requireArtistAccess(ctx, args.artistId, "owner");

    // Normalize email
    const email = args.email.toLowerCase().trim();

    // Find invitee by email
    const invitee = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!invitee) {
      return {
        success: false,
        message: "User not found. They need to sign up with this email first.",
      };
    }

    // Check if invitee is already a member
    const existing = await ctx.db
      .query("artistMembers")
      .withIndex("by_user_artist", (q) =>
        q.eq("userId", invitee._id).eq("artistId", args.artistId)
      )
      .first();

    if (existing) {
      return { success: false, message: "User is already a team member" };
    }

    // Create membership
    await ctx.db.insert("artistMembers", {
      artistId: args.artistId,
      userId: invitee._id,
      role: args.role,
      createdAt: Date.now(),
      invitedBy: user._id,
    });

    return { success: true };
  },
});

/**
 * Remove a team member (owner only).
 * Owners cannot remove themselves.
 */
export const removeTeamMember = mutation({
  args: {
    artistId: v.id("artists"),
    memberId: v.id("artistMembers"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Verify caller is owner
    const { user, membership: callerMembership } = await requireArtistAccess(
      ctx,
      args.artistId,
      "owner"
    );

    // Get the membership to remove
    const memberToRemove = await ctx.db.get(args.memberId);
    if (!memberToRemove) {
      return { success: false, message: "Member not found" };
    }

    // Verify it's for the same artist
    if (memberToRemove.artistId !== args.artistId) {
      return { success: false, message: "Invalid member" };
    }

    // Prevent removing self
    if (memberToRemove.userId === user._id) {
      return { success: false, message: "Cannot remove yourself" };
    }

    // Prevent removing another owner (only the owner themselves can leave)
    if (memberToRemove.role === "owner") {
      return { success: false, message: "Cannot remove another owner" };
    }

    // Delete the membership
    await ctx.db.delete(args.memberId);

    return { success: true };
  },
});

/**
 * Update a team member's role (owner only).
 */
export const updateTeamMemberRole = mutation({
  args: {
    artistId: v.id("artists"),
    memberId: v.id("artistMembers"),
    role: v.union(v.literal("manager"), v.literal("viewer")),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Verify caller is owner
    await requireArtistAccess(ctx, args.artistId, "owner");

    // Get the membership to update
    const member = await ctx.db.get(args.memberId);
    if (!member) {
      return { success: false, message: "Member not found" };
    }

    // Verify it's for the same artist
    if (member.artistId !== args.artistId) {
      return { success: false, message: "Invalid member" };
    }

    // Can't change owner role
    if (member.role === "owner") {
      return { success: false, message: "Cannot change owner role" };
    }

    // Update role
    await ctx.db.patch(args.memberId, { role: args.role });

    return { success: true };
  },
});

/**
 * Leave an artist team (for non-owners).
 */
export const leaveArtistTeam = mutation({
  args: { artistId: v.id("artists") },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { membership } = await requireArtistAccess(ctx, args.artistId, "viewer");

    // Owners can't leave (must transfer ownership or delete account)
    if (membership.role === "owner") {
      return { success: false, message: "Owners cannot leave. Transfer ownership first." };
    }

    await ctx.db.delete(membership._id);
    return { success: true };
  },
});
