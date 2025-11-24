import { internalQuery, action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

/**
 * Diagnostic tools for finding and fixing missing setlists
 */

export const findShowsWithoutSetlists = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    showId: v.id("shows"),
    artistName: v.string(),
    date: v.string(),
    status: v.string(),
    hasSongs: v.boolean(),
    artistSongCount: v.number(),
  })),
  handler: async (ctx, args) => {
    const shows = await ctx.db.query("shows").take(args.limit || 100);
    const missing: Array<{
      showId: any;
      artistName: string;
      date: string;
      status: string;
      hasSongs: boolean;
      artistSongCount: number;
    }> = [];
    
    for (const show of shows) {
      const setlist = await ctx.db
        .query("setlists")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .first();
      
      if (!setlist) {
        const artist = await ctx.db.get(show.artistId);
        const artistSongs = await ctx.db
          .query("artistSongs")
          .withIndex("by_artist", (q) => q.eq("artistId", show.artistId))
          .collect();
        
        missing.push({
          showId: show._id,
          artistName: artist?.name || "Unknown",
          date: show.date,
          status: show.status,
          hasSongs: artistSongs.length > 0,
          artistSongCount: artistSongs.length,
        });
      }
    }
    
    return missing;
  },
});

// Public action to manually trigger backfill (for admin dashboard)
export const backfillMissingSetlists = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx, args): Promise<{ scheduled: number }> => {
    console.log("🔄 Starting backfill for missing setlists...");
    const result = await ctx.runMutation(internalRef.setlists.refreshMissingAutoSetlists, {
      limit: args.limit || 500,
      includeCompleted: true, // CRITICAL: Scan ALL shows, not just upcoming
    });
    console.log(`✅ Backfill scheduled: ${result.scheduled} setlist generations queued`);
    return result as { scheduled: number };
  },
});

// Diagnostic: Find artists with no songs (need catalog sync)
export const findArtistsWithoutSongs = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    artistId: v.id("artists"),
    artistName: v.string(),
    hasSpotifyId: v.boolean(),
    lastSynced: v.optional(v.number()),
  })),
  handler: async (ctx, args) => {
    const artists = await ctx.db.query("artists").take(args.limit || 50);
    const missing: Array<{
      artistId: any;
      artistName: string;
      hasSpotifyId: boolean;
      lastSynced: number | undefined;
    }> = [];
    
    for (const artist of artists) {
      const artistSongs = await ctx.db
        .query("artistSongs")
        .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
        .collect();
      
      if (artistSongs.length === 0) {
        missing.push({
          artistId: artist._id,
          artistName: artist.name,
          hasSpotifyId: !!artist.spotifyId,
          lastSynced: artist.lastSynced,
        });
      }
    }
    
    return missing;
  },
});
