import { queueRepertoireMerge } from "../catalogRepertoire";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internalRef } from "../adminHelpers";

// Called in the same transaction as the actual-setlist write, never on predictions.
export async function recordSetlistImport(ctx: MutationCtx, args: {
  showId: Id<"shows">; setlistfmId: string; actualSongCount: number;
  previouslyImported: boolean; source: string;
  predictionAccuracy?: number;
}) {
  if (!args.setlistfmId || args.actualSongCount === 0) throw new Error("Empty official setlist");
  const pilot = await ctx.db.query("liveSetlistSessions").withIndex("by_show", q => q.eq("showId", args.showId)).unique();
  if (pilot && !pilot.confirmedAt) throw new Error("Live pilot completeness must be reviewed before official import");
  const show = await ctx.db.get(args.showId);
  if (!show) throw new Error("Show not found");
  await ctx.db.patch(show._id, {
    status: "completed", setlistfmId: args.setlistfmId, importStatus: "completed",
    importNextAttemptAt: undefined, lastSynced: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internalRef.songSearch.indexShow, { showId: show._id });
  await queueRepertoireMerge(ctx, show);
  if (!args.previouslyImported) await ctx.scheduler.runAfter(0, internalRef.analytics.capture, {
    event: "official_setlist_imported",
    distinctId: `artist:${show.artistId}`,
    insertId: `official_setlist_imported:${show._id}:${args.setlistfmId}`,
    properties: {
      show_id: show._id, artist_id: show.artistId, setlistfm_id: args.setlistfmId,
      actual_song_count: args.actualSongCount, import_source: args.source,
      prediction_accuracy: args.predictionAccuracy,
    },
  });
}
