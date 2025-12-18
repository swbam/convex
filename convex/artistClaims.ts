import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./admin";

async function getCurrentAppUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q: any) => q.eq("authId", identity.subject))
    .first();
}

export const create = mutation({
  args: {
    artistId: v.id("artists"),
    evidence: v.optional(v.array(v.object({ type: v.string(), value: v.string() }))),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) throw new Error("Must be logged in");

    if (!user.spotifyId) {
      throw new Error("Connect Spotify to claim an artist");
    }

    const existingMember = await ctx.db
      .query("artistMembers")
      .withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId))
      .first();
    if (existingMember) {
      return { status: "already_member", artistId: args.artistId };
    }

    const existingClaim = await ctx.db
      .query("artistClaims")
      .withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId))
      .first();
    if (existingClaim) {
      return { status: existingClaim.status, claimId: existingClaim._id };
    }

    // Spotify-first gating: only allow claiming artists we imported for this Spotify account.
    const spotifyRel = await ctx.db
      .query("userSpotifyArtists")
      .withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId))
      .first();
    if (!spotifyRel) {
      throw new Error("You can only claim artists that are linked to your Spotify account");
    }

    const claimId = await ctx.db.insert("artistClaims", {
      userId: user._id,
      artistId: args.artistId,
      status: "pending",
      submittedAt: Date.now(),
      spotifyUserId: user.spotifyId,
      evidence: args.evidence,
    });

    return { status: "pending", claimId };
  },
});

export const getMyClaims = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return [];

    const claims = await ctx.db
      .query("artistClaims")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);

    const hydrated = await Promise.all(
      claims.map(async (c: any) => {
        const artist = await ctx.db.get(c.artistId);
        return { ...c, artist };
      }),
    );

    return hydrated;
  },
});

export const listPending = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.max(1, Math.min(200, args.limit ?? 50));

    const pending = await ctx.db
      .query("artistClaims")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(limit);

    const hydrated = await Promise.all(
      pending.map(async (c: any) => {
        const [artist, user] = await Promise.all([ctx.db.get(c.artistId), ctx.db.get(c.userId)]);
        return { ...c, artist, user };
      }),
    );

    return hydrated;
  },
});

export const approve = mutation({
  args: {
    claimId: v.id("artistClaims"),
    role: v.optional(v.union(v.literal("owner"), v.literal("manager"), v.literal("viewer"))),
    note: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const adminUserId = await requireAdmin(ctx);

    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.status !== "pending") {
      return { success: true, status: claim.status };
    }

    const role = args.role ?? "owner";

    const existing = await ctx.db
      .query("artistMembers")
      .withIndex("by_user_artist", (q) => q.eq("userId", claim.userId).eq("artistId", claim.artistId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { role });
    } else {
      await ctx.db.insert("artistMembers", {
        userId: claim.userId,
        artistId: claim.artistId,
        role,
        createdAt: Date.now(),
      });
    }

    await ctx.db.patch(args.claimId, {
      status: "approved",
      reviewedAt: Date.now(),
      reviewedBy: adminUserId,
      reviewNote: args.note,
    });

    return { success: true };
  },
});

export const reject = mutation({
  args: {
    claimId: v.id("artistClaims"),
    note: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const adminUserId = await requireAdmin(ctx);

    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.status !== "pending") {
      return { success: true, status: claim.status };
    }

    await ctx.db.patch(args.claimId, {
      status: "rejected",
      reviewedAt: Date.now(),
      reviewedBy: adminUserId,
      reviewNote: args.note,
    });

    return { success: true };
  },
});

