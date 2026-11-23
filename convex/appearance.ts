import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./adminHelpers";
import { DEFAULT_APPEARANCE, normalizeAppearance, sameAppearance } from "../shared/appearance";
import { appearanceValidator } from "./lib/appearanceValidator";

// A single indexed record; the public response contains no administrator identity.
export const get = query({
  args: {},
  returns: v.object({ settings: appearanceValidator, revision: v.number(), updatedAt: v.union(v.number(), v.null()) }),
  handler: async ctx => {
    const record = await ctx.db.query("siteAppearance").withIndex("by_key", q => q.eq("key", "global")).unique();
    return { settings: record?.settings ?? DEFAULT_APPEARANCE, revision: record?.revision ?? 0, updatedAt: record?.updatedAt ?? null };
  },
});

export const save = mutation({
  args: { settings: appearanceValidator, expectedRevision: v.number() },
  returns: v.object({ revision: v.number() }),
  handler: async (ctx, args) => {
    const actorUserId = await requireAdmin(ctx);
    let settings;
    try { settings = normalizeAppearance(args.settings); }
    catch (error) { throw new ConvexError(error instanceof Error ? error.message : "Invalid appearance settings."); }
    const record = await ctx.db.query("siteAppearance").withIndex("by_key", q => q.eq("key", "global")).unique();
    const revision = record?.revision ?? 0;
    if (args.expectedRevision !== revision) {
      throw new ConvexError("Appearance changed in another session. Load the saved settings before saving again.");
    }
    if (record && sameAppearance(record.settings, settings)) return { revision };
    const updatedAt = Date.now();
    const next = { settings, revision: revision + 1, updatedAt };
    if (record) await ctx.db.patch(record._id, next);
    else await ctx.db.insert("siteAppearance", { key: "global", ...next });
    await ctx.db.insert("adminAuditLogs", {
      actorUserId,
      action: "appearance.save",
      args: { before: record?.settings ?? DEFAULT_APPEARANCE, after: settings, revision: next.revision },
      createdAt: updatedAt,
      success: true,
    });
    return { revision: next.revision };
  },
});
