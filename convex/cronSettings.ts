import { internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./admin";

export const getByNameInternal = internalQuery({
  args: { name: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.query("cronSettings").withIndex("by_name", (q) => q.eq("name", args.name)).first();
  },
});

export const upsertInternal = internalMutation({
  args: {
    name: v.string(),
    intervalMs: v.number(),
    enabled: v.boolean(),
    lastRunAt: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("cronSettings").withIndex("by_name", (q) => q.eq("name", args.name)).first();
    if (existing) {
      const { name, ...rest } = args;
      await ctx.db.patch(existing._id, rest);
      return { _id: existing._id, ...existing, ...rest };
    }
    const id = await ctx.db.insert("cronSettings", {
      name: args.name,
      intervalMs: args.intervalMs,
      enabled: args.enabled,
      lastRunAt: args.lastRunAt,
    });
    return await ctx.db.get(id);
  },
});

export const list = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("cronSettings").order("asc").collect();
  },
});

export const update = mutation({
  args: {
    name: v.string(),
    intervalMs: v.number(),
    enabled: v.boolean(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("cronSettings").withIndex("by_name", (q) => q.eq("name", args.name)).first();
    if (existing) {
      await ctx.db.patch(existing._id, { intervalMs: args.intervalMs, enabled: args.enabled });
    } else {
      await ctx.db.insert("cronSettings", {
        name: args.name,
        intervalMs: args.intervalMs,
        enabled: args.enabled,
        lastRunAt: 0,
      });
    }
    return { success: true };
  },
});


