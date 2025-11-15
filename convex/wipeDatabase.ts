import { internalMutation } from "./_generated/server";

/**
 * DANGEROUS: Wipes all application tables except `users`.
 *
 * This is intentionally exposed only as an internal mutation so it can be invoked
 * from trusted tooling (e.g. scripts or Convex CLI) and never from the client.
 * It uses pagination to handle large tables without hitting Convex's 32K read limit.
 */
export const wipeAllTablesExceptUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("🗑️  Starting database wipe (preserving users)...");
    
    const tablesToWipe = [
      "artists",
      "venues",
      "shows",
      "songs",
      "artistSongs",
      "setlists",
      "votes",
      "songVotes",
      "userSpotifyArtists",
      "userActions",
      "trendingArtists",
      "trendingShows",
      "contentFlags",
      "userFollows",
      "syncStatus",
      "syncJobs",
      "maintenanceLocks",
      "spotifyTokens",
      "errorLogs",
      "cronSettings",
    ] as const;

    let totalDeleted = 0;

    for (const tableName of tablesToWipe) {
      try {
        // Use pagination to avoid hitting the 32K read limit
        const pageSize = 100;
        let hasMore = true;
        let tableTotal = 0;

        while (hasMore) {
          // Get a page of records
          const records = await ctx.db.query(tableName as any).take(pageSize);
          
          if (records.length === 0) {
            hasMore = false;
            break;
          }

          // Delete this batch
          for (const record of records) {
            await ctx.db.delete(record._id);
          }

          tableTotal += records.length;
          
          // If we got fewer than pageSize, we're done
          if (records.length < pageSize) {
            hasMore = false;
          }
        }

        if (tableTotal > 0) {
          console.log(`✅ ${tableName}: deleted ${tableTotal} records`);
        }
        totalDeleted += tableTotal;
      } catch (error) {
        console.error(`❌ Error wiping ${tableName}:`, error);
      }
    }

    console.log(`🎉 Database wipe complete! Deleted ${totalDeleted} records total.`);
    console.log(`👤 Users table preserved.`);

    return {
      success: true,
      tablesWiped: tablesToWipe.length,
      deletedRecords: totalDeleted,
    };
  },
});
