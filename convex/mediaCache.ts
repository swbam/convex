import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
export const get = internalQuery({
  args: { key: v.string() },
  handler: (ctx, { key }) => ctx.db.query("heroImageCache").withIndex("by_key", q => q.eq("key", key)).first(),
});
export const claim = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const cached = await ctx.db.query("heroImageCache").withIndex("by_key", q => q.eq("key", key)).first();
    const now = Date.now();
    if (cached && cached.refreshAfter > now) return false;
    // Short lease also prevents parallel page + preview fetches hitting the provider twice.
    if (cached) await ctx.db.patch(cached._id, { refreshAfter: now + 30000 });
    else await ctx.db.insert("heroImageCache", { key, refreshAfter: now + 30000 });
    return true;
  },
});
export const finish = internalMutation({
  args: { key: v.string(), image: v.optional(v.object({ url: v.string(), width: v.optional(v.number()), height: v.optional(v.number()) })), failed: v.boolean() },
  handler: async (ctx, { key, image, failed }) => {
    const cached = await ctx.db.query("heroImageCache").withIndex("by_key", q => q.eq("key", key)).first();
    if (!cached) return;
    // Keep the last usable photo during an outage. Negative results are cached too.
    await ctx.db.patch(cached._id, {
      ...(failed ? {} : { image }),
      refreshAfter: Date.now() + (failed ? 15 * 60000 : image ? 7 * 86400000 : 86400000),
    });
  },
});
