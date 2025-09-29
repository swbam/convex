import { v } from "convex/values";

export default {
  load: async (ctx: { db: any }) => {
    const { db } = ctx;

    // Add voteCount field to shows table (optional number, defaults to 0 if needed)
    await db.addField("shows", "voteCount", {
      optional: true,
      type: v.number(),
    });

    // Add setlistCount field to shows table (optional number, defaults to 0 if needed)
    await db.addField("shows", "setlistCount", {
      optional: true,
      type: v.number(),
    });

    // Add importStatus field to shows table
    await db.addField("shows", "importStatus", {
      optional: true,
      type: v.union(
        v.literal("pending"),
        v.literal("importing"),
        v.literal("completed"),
        v.literal("failed")
      ),
    });

    // Optionally backfill existing shows with defaults
    const existingShows = await db.query("shows").collect();
    for (const show of existingShows) {
      if (show.voteCount === undefined) {
        await db.patch(show._id, { voteCount: 0 });
      }
      if (show.setlistCount === undefined) {
        await db.patch(show._id, { setlistCount: 0 });
      }
      if (show.importStatus === undefined) {
        await db.patch(show._id, { importStatus: "pending" });
      }
    }
  },
};