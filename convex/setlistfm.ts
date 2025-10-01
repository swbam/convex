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
    const attempt = 1;
    const maxAttempts = 3;
    try {
      const show = await ctx.runQuery(internal.shows.getByIdInternal, { id: args.showId });
      if (!show || !show.artistId || !show.venueId) {
        await ctx.runMutation(internal.shows.updateImportStatus, {
          showId: args.showId,
          status: "failed" as const,
        });
        throw new Error("Missing relations");
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
        throw new Error("Missing artist or venue");
      }

      // API call to Setlist.fm (simplified for now - implement full logic)
      const apiKey = process.env.SETLISTFM_API_KEY;
      if (!apiKey) {
        throw new Error("SETLISTFM_API_KEY not configured");
      }

      const dateMatch = args.showDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dateMatch) {
        throw new Error("Invalid date format");
      }
      const [, year, month, day] = dateMatch;
      const setlistfmDate = `${day}-${month}-${year}`;

      const searchUrl = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(artist.name)}&cityName=${encodeURIComponent(venue.city)}&date=${setlistfmDate}`;
      
      const apiResponse = await fetch(searchUrl, {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'setlists.live/1.0'
        }
      });

      if (!apiResponse.ok) {
        throw new Error(`Setlist.fm API error: ${apiResponse.status}`);
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
        console.log(`✅ Synced setlist for ${artist.name}`);
        return setlistId;
      } else {
        // No setlist found
        await ctx.runMutation(internal.shows.updateImportStatus, {
          showId: args.showId,
          status: "failed" as const, // Use failed instead of no_setlist for now
        });
        return null;
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed for show ${args.showId}:`, error);
      await ctx.runMutation(internal.shows.updateImportStatus, {
        showId: args.showId,
        status: "failed" as const,
      });
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        // Retry via scheduler instead of recursion
        await ctx.scheduler.runAfter(delay, internal.setlistfm.syncActualSetlist, args);
        return null;
      }
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
      console.log("Setlist.fm API key not configured");
      return null;
    }

    try {
      // Get specific setlist by ID
      const setlistUrl = `https://api.setlist.fm/rest/1.0/setlist/${args.setlistfmId}`;
      console.log(`Fetching specific setlist: ${setlistUrl}`);
      
      const response = await fetch(setlistUrl, {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'setlists.live/1.0'
        }
      });

      if (!response.ok) {
        console.log(`Setlist.fm API error: ${response.status}`);
        return null;
      }

      const setlist = await response.json();
      const songs: { title: string; setNumber: number; encore: boolean; album?: string; duration?: number }[] = [];

      console.log(`Found setlist for ${setlist.artist?.name} at ${setlist.venue?.name} on ${setlist.eventDate}`);

      // Extract songs from sets
      if (setlist.sets && setlist.sets.set) {
        for (const [setIndex, set] of setlist.sets.set.entries()) {
          const isEncore = set.encore === 1 || set.encore === true || set.encore === "true";
          const setNumber = setIndex + 1;
          
          console.log(`Processing set ${setNumber} (encore: ${isEncore}) with ${set.song?.length || 0} songs`);
          
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
        console.log(`No songs found in setlist`);
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
      console.error("Setlist.fm sync error:", error);
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
