import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internalRef } from "./adminHelpers";

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
 * 1. Existing artistMembers record (from approved claim or team invite)
 * 
 * Note: We DO NOT auto-match user.spotifyId to artist.spotifyId because:
 * - user.spotifyId is the user's Spotify USER ID (from Clerk external account)
 * - artist.spotifyId is the Spotify ARTIST ID (from the Web API)
 * - These are fundamentally different identifiers and will never legitimately match.
 * 
 * Artist verification must go through the claim flow which includes
 * email verification and admin review.
 */
export const getMyArtistAccess = query({
  args: {},
  returns: v.object({
    hasAccess: v.boolean(),
    reason: v.optional(v.union(
      v.literal("not_signed_in"),
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

    // Check artistMembers table for approved claims and team invites
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

    return { hasAccess: false, reason: "not_an_artist" as const };
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
    await ctx.runMutation(internalRef.artists.syncArtistPortalState, {
      artistId: args.artistId,
    });
    await ctx.scheduler.runAfter(0, internalRef.artistAutomation.runManagedArtistWarmup, {
      artistId: args.artistId,
      reason: "team_member_invited",
      force: false,
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
    await ctx.runMutation(internalRef.artists.syncArtistPortalState, {
      artistId: args.artistId,
    });

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
    await ctx.runMutation(internalRef.artists.syncArtistPortalState, {
      artistId: args.artistId,
    });
    return { success: true };
  },
});

// ============================================================================
// SECURE INVITE STORAGE
// Token generation, hashing, and email delivery live in artistInvites.ts. These
// database functions never return or persist a new plaintext bearer token.
// ============================================================================

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const INVITE_COOLDOWN_MS = 60_000;
const MAX_INVITES_PER_HOUR = 25;

export const prepareInvite = internalMutation({
  args: {
    artistId: v.id("artists"),
    email: v.string(),
    role: v.union(v.literal("manager"), v.literal("viewer")),
    tokenHash: v.string(),
    now: v.number(),
    expiresAt: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
    inviteId: v.optional(v.id("artistInvites")),
    artistName: v.optional(v.string()),
    invitedByName: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { user } = await requireArtistAccess(ctx, args.artistId, "owner");
    const artist = await ctx.db.get(args.artistId);
    if (!artist) return { success: false, message: "Artist not found" };

    const email = normalizeEmail(args.email);
    if (!validEmail(email) || email.length > 320) {
      return { success: false, message: "Enter a valid email address" };
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existingUser) {
      const existingMember = await ctx.db
        .query("artistMembers")
        .withIndex("by_user_artist", (q) =>
          q.eq("userId", existingUser._id).eq("artistId", args.artistId),
        )
        .first();
      if (existingMember) {
        return { success: false, message: "This person already has team access" };
      }
    }

    const existingInvite = await ctx.db
      .query("artistInvites")
      .withIndex("by_artist_email", (q) =>
        q.eq("artistId", args.artistId).eq("email", email),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingInvite && args.now - existingInvite.createdAt < INVITE_COOLDOWN_MS) {
      return { success: false, message: "Wait a minute before sending another invitation" };
    }

    const windowStart = args.now - 60 * 60 * 1000;
    const recentIssuances = (invite: Doc<"artistInvites">) =>
      (invite.issuedAtHistory ?? [invite.createdAt]).filter(at => at > windowStart);
    const recentInvites = await ctx.db
      .query("artistInvites")
      .withIndex("by_artist_created_at", (q) =>
        q.eq("artistId", args.artistId).gt("createdAt", windowStart),
      )
      .take(MAX_INVITES_PER_HOUR);
    if (recentInvites.reduce((total, invite) => total + recentIssuances(invite).length, 0) >= MAX_INVITES_PER_HOUR) {
      return { success: false, message: "Hourly invitation limit reached. Try again later." };
    }

    let inviteId: Id<"artistInvites">;
    if (existingInvite) {
      inviteId = existingInvite._id;
      await ctx.db.patch(inviteId, {
        role: args.role,
        tokenHash: args.tokenHash,
        issuedAtHistory: [...recentIssuances(existingInvite), args.now],
        inviteToken: undefined,
        invitedBy: user._id,
        createdAt: args.now,
        expiresAt: args.expiresAt,
        sentAt: undefined,
        deliveryStatus: undefined,
      });
    } else {
      inviteId = await ctx.db.insert("artistInvites", {
        artistId: args.artistId,
        email,
        role: args.role,
        status: "pending",
        tokenHash: args.tokenHash,
        issuedAtHistory: [args.now],
        invitedBy: user._id,
        createdAt: args.now,
        expiresAt: args.expiresAt,
      });
    }

    return {
      success: true,
      inviteId,
      artistName: artist.name,
      invitedByName: user.name || user.username || "An artist team owner",
    };
  },
});

export const recordInviteDelivery = internalMutation({
  args: {
    inviteId: v.id("artistInvites"),
    tokenHash: v.optional(v.string()),
    deliveryStatus: v.union(
      v.literal("sent"),
      v.literal("not_configured"),
      v.literal("failed"),
    ),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!args.tokenHash || !invite || invite.tokenHash !== args.tokenHash || invite.status !== "pending") return false;
    if (invite.deliveryStatus === "sent") return true;
    await ctx.db.patch(args.inviteId, {
      deliveryStatus: args.deliveryStatus,
      sentAt: args.deliveryStatus === "sent" ? Date.now() : undefined,
    });
    return true;
  },
});

/**
 * Get pending invites for an artist (owner only).
 */
export const getPendingInvites = query({
  args: { artistId: v.id("artists") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return [];
    
    const membership = await ctx.db
      .query("artistMembers")
      .withIndex("by_user_artist", (q) =>
        q.eq("userId", user._id).eq("artistId", args.artistId),
      )
      .first();
    if (membership?.role !== "owner") return [];
    
    const invites = await ctx.db
      .query("artistInvites")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    
    // Filter out expired invites and mark them
    const now = Date.now();
    const validInvites = [];
    
    for (const invite of invites) {
      if (invite.expiresAt < now) {
        // Mark as expired (in query, we can't mutate but we filter it out)
        continue;
      }
      
      validInvites.push({
        _id: invite._id,
        email: invite.email,
        role: invite.role,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        deliveryStatus: invite.deliveryStatus,
        daysRemaining: Math.ceil((invite.expiresAt - now) / (24 * 60 * 60 * 1000)),
      });
    }
    
    return validInvites;
  },
});

/**
 * Revoke a pending invite (owner only).
 */
export const revokeInvite = mutation({
  args: {
    artistId: v.id("artists"),
    inviteId: v.id("artistInvites"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Verify caller is owner
    await requireArtistAccess(ctx, args.artistId, "owner");
    
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      return { success: false, message: "Invite not found" };
    }
    
    if (invite.artistId !== args.artistId) {
      return { success: false, message: "Invalid invite" };
    }
    
    if (invite.status !== "pending") {
      return { success: false, message: "Invite is no longer pending" };
    }
    
    await ctx.db.patch(args.inviteId, { status: "revoked" });
    
    return { success: true };
  },
});

/**
 * Get invites for the current user's email.
 */
export const getMyPendingInvites = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    if (!user || !user.email) return [];
    
    const email = user.email.toLowerCase();
    
    const invites = await ctx.db
      .query("artistInvites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    
    const now = Date.now();
    const validInvites = [];
    
    for (const invite of invites) {
      if (invite.expiresAt < now) continue;
      
      const artist = await ctx.db.get(invite.artistId);
      validInvites.push({
        _id: invite._id,
        artistId: invite.artistId,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt,
        artistName: artist?.name || "Unknown Artist",
        artistImage: artist?.images?.[0],
      });
    }
    
    return validInvites;
  },
});

export const getInvitePreviewByHash = internalQuery({
  args: { tokenHash: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    let invite = await ctx.db
      .query("artistInvites")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (!invite) return null;

    const [artist, invitedByUser] = await Promise.all([
      ctx.db.get(invite.artistId),
      ctx.db.get(invite.invitedBy),
    ]);
    const isExpired = invite.expiresAt < Date.now();
    return {
      artistId: invite.artistId,
      artistName: artist?.name || "Unknown Artist",
      artistImage: artist?.images?.[0],
      invitedByName: invitedByUser?.name || invitedByUser?.username || "An artist team owner",
      role: invite.role,
      status: isExpired && invite.status === "pending" ? "expired" : invite.status,
      isExpired,
      isValid: invite.status === "pending" && !isExpired,
    };
  },
});

export const acceptInviteByHash = internalMutation({
  args: { tokenHash: v.string(), verifiedEmails: v.optional(v.array(v.string())) },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
    artistId: v.optional(v.id("artists")),
    artistName: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) {
      return { success: false, message: "Please sign in first" };
    }
    
    let invite = await ctx.db
      .query("artistInvites")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (!invite) {
      return { success: false, message: "Invalid invite link" };
    }
    
    if (invite.status !== "pending") {
      if (invite.status === "accepted") {
        return { success: false, message: "This invite has already been used" };
      }
      if (invite.status === "revoked") {
        return { success: false, message: "This invite has been revoked" };
      }
      return { success: false, message: "This invite is no longer valid" };
    }
    
    if (invite.expiresAt < Date.now()) {
      await ctx.db.patch(invite._id, { status: "expired" });
      return { success: false, message: "This invite has expired" };
    }
    
    if (!args.verifiedEmails?.some(email => normalizeEmail(email) === invite.email)) {
      return {
        success: false,
        message: "Sign in with the verified email address this invitation was sent to",
      };
    }
    
    const artist = await ctx.db.get(invite.artistId);
    if (!artist) {
      return { success: false, message: "Artist no longer exists" };
    }
    
    // Check if already a member
    const existingMember = await ctx.db
      .query("artistMembers")
      .withIndex("by_user_artist", (q) =>
        q.eq("userId", user._id).eq("artistId", invite.artistId)
      )
      .first();
    
    if (existingMember) {
      // Mark invite as accepted anyway
      await ctx.db.patch(invite._id, {
        status: "accepted",
        inviteToken: undefined,
        acceptedAt: Date.now(),
        acceptedBy: user._id,
      });
      return {
        success: true,
        message: "You're already a team member",
        artistId: invite.artistId,
        artistName: artist.name,
      };
    }
    
    // Create membership
    await ctx.db.insert("artistMembers", {
      artistId: invite.artistId,
      userId: user._id,
      role: invite.role,
      createdAt: Date.now(),
      invitedBy: invite.invitedBy,
    });
    await ctx.runMutation(internalRef.artists.syncArtistPortalState, {
      artistId: invite.artistId,
    });

    // Mark invite as accepted
    await ctx.db.patch(invite._id, {
      status: "accepted",
      inviteToken: undefined,
      acceptedAt: Date.now(),
      acceptedBy: user._id,
    });
    await ctx.scheduler.runAfter(0, internalRef.artistAutomation.runManagedArtistWarmup, {
      artistId: invite.artistId,
      reason: "invite_accepted",
      force: false,
    });

    return {
      success: true,
      message: `Welcome to ${artist.name}'s team!`,
      artistId: invite.artistId,
      artistName: artist.name,
    };
  },
});

// Public proof is derived from a manually reviewed claim AND current membership.
// Removing access removes the badge without waiting for cached artist fields.
export const getPublicTeamStatus = query({
  args: { artistId: v.id("artists") }, returns: v.object({ verifiedTeam: v.boolean() }),
  handler: async (ctx, args) => {
    const claims = await ctx.db.query("artistClaims").withIndex("by_artist",
      q => q.eq("artistId", args.artistId)).filter(q => q.eq(q.field("status"), "approved")).take(100);
    for (const claim of claims) {
      if (claim.verificationMethod !== "manual_review" || !claim.reviewedBy || !claim.emailVerified) continue;
      const membership = await ctx.db.query("artistMembers").withIndex("by_user_artist",
        q => q.eq("userId", claim.userId).eq("artistId", args.artistId)).first();
      if (membership && membership.role !== "viewer") return { verifiedTeam: true };
    }
    return { verifiedTeam: false };
  },
});
