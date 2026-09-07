import { v } from "convex/values";

export const catalogResultValidator = v.object({
  albumsExpected: v.number(),
  albumsFailed: v.number(),
  tracksExpected: v.number(),
  tracksImported: v.number(),
  failedAlbumIds: v.array(v.string()),
  failedTrackIds: v.array(v.string()),
  error: v.optional(v.string()),
});

export function catalogResultStatus(result: {
  albumsFailed: number; tracksExpected: number; tracksImported: number; error?: string;
}): "completed" | "partial" | "failed" {
  if (result.tracksImported === 0) return "failed";
  return !result.error && result.albumsFailed === 0 && result.tracksImported === result.tracksExpected
    ? "completed" : "partial";
}
