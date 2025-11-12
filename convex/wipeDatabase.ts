import { mutation } from "./_generated/server";

/**
 * DANGEROUS: Wipes all tables except users
 * Use this to reset the database to a clean state while preserving user accounts
 * 
 * This uses pagination to handle large tables without hitting Convex's 32K read limit
 */
export const wipeAllTablesExceptUsers = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🗑️  Starting database wipe (preserving users)...");
    
    const tablesToWipe = [
      // "activity" - REMOVED: Table deleted from schema, activity computed from other tables
      "artistSongs",
      "artists",
      "contentFlags",
      "cronSettings",
      "errorLogs",
      "follows",
      "jobs",
      "maintenanceLocks",
      "setlistSongs",
      "setlistVotes",
      "setlists",
      "shows",
      "songVotes",
      "songs",
      "spotifyTokens",
      "syncJobs",
      "syncProgress",
      "syncStatus",
      "trending",
      "trendingArtists",
      "trendingShows",
      "userAchievements",
      "userActions",
      "userFollows",
      "userSpotifyArtists",
      "venues",
      "votes",
    ];

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
