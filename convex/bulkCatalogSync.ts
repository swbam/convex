"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internalRef } from "./adminHelpers";

// Bulk sync catalogs for all artists missing songs
export const syncAllMissingCatalogs = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    synced: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    console.log("🎵 Starting bulk catalog sync for artists without songs...");

    const limit = args.limit ?? 50;
    const artists = await ctx.runQuery(internalRef.artists.getAllInternal, { limit: 200 });

    let processed = 0;
    let synced = 0;
    let skipped = 0;

    for (const artist of artists.slice(0, limit)) {
      processed++;

      // Skip if no Spotify ID
      if (!artist.spotifyId) {
        console.log(`⏭️ Skipping ${artist.name} - no Spotify ID`);
        skipped++;
        continue;
      }

      // Check if artist already has songs
      const artistSongs = await ctx.runQuery(internalRef.artistSongs.getByArtist, {
        artistId: artist._id,
      });
      const songCount = artistSongs.length;

      if (songCount > 0) {
        console.log(`⏭️ Skipping ${artist.name} - already has ${songCount} songs`);
        skipped++;
        continue;
      }

      // Sync catalog
      try {
        console.log(`📥 Syncing catalog for ${artist.name}...`);
        await ctx.runAction(internalRef.spotify.syncArtistCatalog, {
          artistId: artist._id,
          artistName: artist.name,
        });
        synced++;

        // Rate limit to avoid overwhelming Spotify API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Failed to sync catalog for ${artist.name}:`, error);
      }
    }

    console.log(`✅ Bulk catalog sync complete: ${synced} synced, ${skipped} skipped, ${processed} total`);

    return {
      processed,
      synced,
      skipped,
    };
  },
});
