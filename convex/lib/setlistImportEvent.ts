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
  const show = await ctx.db.get(args.showId);
  if (!show) throw new Error("Show not found");
  await ctx.db.patch(show._id, {
    status: "completed", setlistfmId: args.setlistfmId, importStatus: "completed",
    importNextAttemptAt: undefined, lastSynced: Date.now(),
  });
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
