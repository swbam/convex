import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { catalogResultStatus, catalogResultValidator } from "./lib/catalogResult";

const HOUR = 3600000;

// Claim the existing catalog job atomically, including recovery after action termination.
export const begin = internalMutation({
  args: { artistId: v.id("artists") },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, { artistId }) => {
    const artist = await ctx.db.get(artistId);
    const now = Date.now();
    if (!artist || (artist.catalogSyncBackoffUntil ?? 0) > now) return null;
    const age = now - (artist.catalogSyncAttemptedAt ?? 0);
    if (artist.catalogSyncStatus === "syncing") {
      if (age < 30 * 60000) return null;
    } else if (artist.catalogSyncAttemptedAt !== undefined &&
      age < (artist.catalogSyncStatus === "completed" ? 24 * HOUR : HOUR)) return null;
    await ctx.db.patch(artistId, { catalogSyncStatus: "syncing", catalogSyncAttemptedAt: now });
    return now;
  },
});

export const finish = internalMutation({
  args: {
    artistId: v.id("artists"), attemptedAt: v.number(), result: catalogResultValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, { artistId, attemptedAt, result }) => {
    const artist = await ctx.db.get(artistId);
    if (!artist || artist.catalogSyncStatus !== "syncing" ||
        artist.catalogSyncAttemptedAt !== attemptedAt) return false;
    for (const count of [result.albumsExpected, result.albumsFailed, result.tracksExpected, result.tracksImported]) {
      if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid catalog counts");
    }
    if (result.albumsFailed > result.albumsExpected || result.tracksImported > result.tracksExpected) {
      throw new Error("Inconsistent catalog counts");
    }
    const status = catalogResultStatus(result);
    const completed = status === "completed";
    const failures = completed ? 0 : (artist.catalogSyncFailureCount ?? 0) + 1;
    const now = Date.now();
    await ctx.db.patch(artistId, {
      catalogSyncStatus: status,
      // Keep old usable songs and the last *complete* freshness timestamp on partial failure.
      lastCatalogSyncAt: completed ? now : artist.lastCatalogSyncAt,
      catalogSyncResult: { ...result, failedAlbumIds: result.failedAlbumIds.slice(0, 100),
        failedTrackIds: result.failedTrackIds.slice(0, 100), error: result.error?.slice(0, 500) },
      catalogSyncFailureCount: failures,
      catalogSyncLastFailure: completed ? undefined : now,
      catalogSyncBackoffUntil: failures >= 3 ? now + 72 * HOUR : undefined,
    });
    return true;
  },
});
