import { action, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const syncActualSetlist = internalAction({
  args: {
    showId: v.id("shows"),
    artistName: v.string(),
    venueCity: v.string(),
    showDate: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    try {
      const show = await ctx.runQuery(internal.shows.getByIdInternal, { id: args.showId });
      if (!show || !show.artistId || !show.venueId) {
        await ctx.runMutation(internal.shows.updateImportStatus, {
          showId: args.showId,
          status: "failed" as const,
        });
        console.error(`❌ Show ${args.showId} missing relations`);
        return null;
      }

      const [artist, venue] = await Promise.all([
        ctx.runQuery(internal.artists.getByIdInternal, { id: show.artistId }),
        ctx.runQuery(internal.venues.getByIdInternal, { id: show.venueId }),
      ]);

      if (!artist || !venue) {
        await ctx.runMutation(internal.shows.updateImportStatus, {
          showId: args.showId,
          status: "failed" as const,
        });
        console.error(`❌ Show ${args.showId} missing artist or venue`);
        return null;
      }

      // API call to Setlist.fm
      const apiKey = process.env.SETLISTFM_API_KEY;
      if (!apiKey) {
        console.error("❌ SETLISTFM_API_KEY not configured");
        throw new Error("SETLISTFM_API_KEY not configured");
      }

      const dateMatch = args.showDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dateMatch) {
        console.error(`❌ Invalid date format: ${args.showDate}`);
        throw new Error("Invalid date format");
      }
      const [, year, month, day] = dateMatch;
      const setlistfmDate = `${day}-${month}-${year}`;

      const searchUrl = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(artist.name)}&cityName=${encodeURIComponent(venue.city)}&date=${setlistfmDate}`;

      console.log(`🔍 Searching setlist.fm: ${artist.name} @ ${venue.city} on ${setlistfmDate}`);

      const apiResponse = await fetch(searchUrl, {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'setlists.live/1.0'
        }
      });

      if (!apiResponse.ok) {
        const errorMsg = `Setlist.fm API error: ${apiResponse.status}`;
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const data = await apiResponse.json();
      const response = data.setlist?.[0] ? { setlist: data.setlist[0] } : null;

      if (response && response.setlist) {
        // Insert setlist and songs
        const setlistId = await ctx.runMutation(internal.setlists.createFromApi, {
          showId: args.showId,
          data: response.setlist,
        });
        await ctx.runMutation(internal.shows.updateImportStatus, {
          showId: args.showId,
          status: "completed",
        });
        console.log(`✅ Synced setlist for ${artist.name} (${setlistId})`);
        return setlistId;
      } else {
        // No setlist found - check if show is actually in the past
        const showDate = new Date(args.showDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        showDate.setHours(0, 0, 0, 0);
        
        if (showDate >= today) {
          // Show hasn't happened yet - keep as pending
          console.log(`ℹ️  Show hasn't occurred yet: ${artist.name} @ ${venue.city} on ${args.showDate}`);
          await ctx.runMutation(internal.shows.updateImportStatus, {
            showId: args.showId,
            status: "pending" as const,
          });
        } else {
          // Show is past but no setlist available on setlist.fm
          console.log(`⚠️  No setlist found on setlist.fm for ${artist.name} @ ${venue.city} (${args.showDate})`);
          await ctx.runMutation(internal.shows.updateImportStatus, {
            showId: args.showId,
            status: "failed" as const,
          });
        }
        return null;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`❌ Setlist sync failed for show ${args.showId}: ${errorMsg}`);
      await ctx.runMutation(internal.shows.updateImportStatus, {
        showId: args.showId,
        status: "failed" as const,
      });
      // Let the job queue (syncJobs.ts) handle retries with proper exponential backoff
      return null;
    }
  },
});

export const checkCompletedShows = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔍 Checking for completed shows needing setlist import...");
    const completedShows = await ctx.runQuery(internal.setlistfm.getCompletedShowsNeedingImport, {}); 
    let setlistsSynced = 0;
    for (const show of completedShows) {
      try {
        await ctx.runMutation(internal.shows.updateImportStatus, {
          showId: show._id,
          status: "importing",
        });

        const artist = await ctx.runQuery(internal.artists.getByIdInternal, { id: show.artistId });
        const venue = await ctx.runQuery(internal.venues.getByIdInternal, { id: show.venueId });
        
        if (artist && venue) {
          const setlistId = await ctx.runAction(internal.setlistfm.syncActualSetlist, {
            showId: show._id,
            artistName: artist.name,
            venueCity: venue.city,
            showDate: show.date,
          });

          if (setlistId) {
            setlistsSynced++;
          }
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error processing show ${show._id}:`, error);
      }
    }

    console.log(`✅ Check complete: ${setlistsSynced} setlists synced`);
    return null;
  },
});

// Public actions for external use
export const triggerSetlistSync = action({
  args: {
    showId: v.id("shows"),
    artistName: v.string(),
    venueCity: v.string(),
    showDate: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    return await ctx.runAction(internal.setlistfm.syncActualSetlist, args);
  },
});

export const syncSpecificSetlist = internalAction({
  args: {
    showId: v.id("shows"),
    setlistfmId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const apiKey = process.env.SETLISTFM_API_KEY;
    if (!apiKey) {
      console.error("❌ SETLISTFM_API_KEY not configured");
      return null;
    }

    try {
      // Get specific setlist by ID
      const setlistUrl = `https://api.setlist.fm/rest/1.0/setlist/${args.setlistfmId}`;
      console.log(`🔍 Fetching specific setlist: ${args.setlistfmId}`);

      const response = await fetch(setlistUrl, {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'setlists.live/1.0'
        }
      });

      if (!response.ok) {
        const errorMsg = `Setlist.fm API error: ${response.status}`;
        console.error(`❌ ${errorMsg}`);
        if (response.status === 404) {
          console.log(`ℹ️  Setlist ${args.setlistfmId} not found`);
          return null;
        }
        if (response.status === 429) {
          console.error("⚠️  Rate limited by Setlist.fm API");
          return null;
        }
        throw new Error(errorMsg);
      }

      const setlist = await response.json();
      const songs: { title: string; setNumber: number; encore: boolean; album?: string; duration?: number }[] = [];

      console.log(`✅ Found setlist: ${setlist.artist?.name} @ ${setlist.venue?.name} on ${setlist.eventDate}`);

      // Extract songs from sets
      if (setlist.sets && setlist.sets.set) {
        for (const [setIndex, set] of setlist.sets.set.entries()) {
          const isEncore = set.encore === 1 || set.encore === true || set.encore === "true";
          const setNumber = setIndex + 1;

          console.log(`📋 Processing set ${setNumber} (encore: ${isEncore}) with ${set.song?.length || 0} songs`);

          if (set.song && Array.isArray(set.song)) {
            for (const song of set.song) {
              if (song.name && song.name.trim() !== '') {
                songs.push({
                  title: song.name.trim(),
                  setNumber: setNumber,
                  encore: isEncore,
                  album: song.info || undefined,
                  duration: undefined,
                });
              }
            }
          }
        }
      }

      if (songs.length === 0) {
        console.log(`ℹ️  No songs found in setlist ${args.setlistfmId}`);
        return null;
      }

      // Update setlist with actual data
      await ctx.runMutation(internal.setlists.updateWithActualSetlist, {
        showId: args.showId,
        actualSetlist: songs,
        setlistfmId: args.setlistfmId,
        setlistfmData: setlist,
      });

      console.log(`✅ Updated setlist with ${songs.length} songs from setlist.fm ID ${args.setlistfmId}`);
      return args.setlistfmId;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`❌ Setlist.fm sync error for ${args.setlistfmId}: ${errorMsg}`);
      return null;
    }
  },
});

export const triggerCompletedShowsCheck = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx): Promise<{ success: boolean; message: string }> => {
    await ctx.runAction(internal.setlistfm.checkCompletedShows, {});
    return { success: true, message: "Completed shows check triggered successfully" };
  },
});

export const scanPendingImports = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔍 Scanning for pending Setlist.fm imports...");
    const pendingShows = await ctx.runQuery(internal.setlistfm.getPendingImports, {});

    let successCount = 0;
    for (const show of pendingShows) {
      try {
        await ctx.runMutation(internal.shows.updateImportStatus, { showId: show._id, status: "importing" });

        const artist = await ctx.runQuery(internal.artists.getByIdInternal, { id: show.artistId });
        const venue = await ctx.runQuery(internal.venues.getByIdInternal, { id: show.venueId });

        if (artist && venue) {
          const setlistId = await ctx.runAction(internal.setlistfm.syncActualSetlist, {
            showId: show._id,
            artistName: artist.name,
            venueCity: venue.city,
            showDate: show.date,
          });

          if (setlistId) {
            successCount++;
          }
        } else {
          await ctx.runMutation(internal.shows.updateImportStatus, { showId: show._id, status: "failed" });
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to import for show ${show._id}:`, error);
        await ctx.runMutation(internal.shows.updateImportStatus, { showId: show._id, status: "failed" });
      }
    }

    console.log(`Import scan complete: ${successCount} successful`);
    return null;
  },
});

export const getCompletedShowsNeedingImport = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .filter((q) => q.or(
        q.eq(q.field("importStatus"), undefined),
        q.eq(q.field("importStatus"), "pending"),
        q.eq(q.field("importStatus"), "failed")
      ))
      .take(5);
  },
});

export const getPendingImports = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .filter((q) => q.or(
        q.eq(q.field("importStatus"), "pending"),
        q.eq(q.field("importStatus"), undefined)
      ))
      .take(5);
  },
});
