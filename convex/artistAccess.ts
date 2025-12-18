import { query } from "./_generated/server";
import { v } from "convex/values";

async function getCurrentAppUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q: any) => q.eq("authId", identity.subject))
    .first();
}

export const getMyArtists = query({
  args: {},
  returns: v.array(
    v.object({
      artist: v.any(),
      role: v.union(v.literal("owner"), v.literal("manager"), v.literal("viewer")),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return [];

    const memberships = await ctx.db
      .query("artistMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const results: Array<{ artist: any; role: "owner" | "manager" | "viewer" }> = [];
    for (const m of memberships) {
      const artist = await ctx.db.get((m as any).artistId);
      if (!artist) continue;
      const role = (m as any).role;
      if (role !== "owner" && role !== "manager" && role !== "viewer") continue;
      results.push({ artist, role });
    }

    return results;
  },
});

export const isArtistMember = query({
  args: { artistId: v.id("artists") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!user) return false;
    const membership = await ctx.db
      .query("artistMembers")
      .withIndex("by_user_artist", (q) => q.eq("userId", user._id).eq("artistId", args.artistId))
      .first();
    return !!membership;
  },
});
