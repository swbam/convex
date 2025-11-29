import { action, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

const SETLISTFM_HTTP_TIMEOUT_MS = 30_000;

async function setlistFetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = SETLISTFM_HTTP_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

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
      const show = await ctx.runQuery(internalRef.shows.getByIdInternal, { id: args.showId });
      if (!show || !show.artistId || !show.venueId) {
        await ctx.runMutation(internalRef.shows.updateImportStatus, {
          showId: args.showId,
          status: "failed" as const,
        });
        console.error(`❌ Show ${args.showId} missing relations`);
        return null;
      }

      const [artist, venue] = await Promise.all([
        ctx.runQuery(internalRef.artists.getByIdInternal, { id: show.artistId }),
        ctx.runQuery(internalRef.venues.getByIdInternal, { id: show.venueId }),
      ]);

      if (!artist || !venue) {
        await ctx.runMutation(internalRef.shows.updateImportStatus, {
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

      const baseDate = new Date(args.showDate);
      if (Number.isNaN(baseDate.getTime())) {
        console.error(`❌ Invalid date format: ${args.showDate}`);
        throw new Error("Invalid date format");
      }

      const formatDate = (date: Date) => {
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(date.getUTCDate()).padStart(2, "0");
        return { api: `${dd}-${mm}-${yyyy}`, iso: `${yyyy}-${mm}-${dd}` };
      };

      // Exponential backoff with jitter for 429/5xx and hard timeout per attempt
      const fetchWithRetry = async (url: string, maxAttempts = 4) => {
        let attempt = 0;
        let delay = 1000; // 1s
        while (attempt < maxAttempts) {
          const response = await setlistFetchWithTimeout(url, {
            headers: {
              "x-api-key": apiKey,
              Accept: "application/json",
              "User-Agent": "setlists.live/1.0",
            },
          });
          if (response.ok) return response;
          if (response.status === 429 || response.status >= 500) {
            attempt += 1;
            if (attempt >= maxAttempts) return response;
            const jitter = Math.floor(Math.random() * 250);
            await new Promise((r) => setTimeout(r, delay + jitter));
            delay *= 2; // backoff
            continue;
          }
          return response;
        }
        return await setlistFetchWithTimeout(url, {
          headers: {
            "x-api-key": apiKey,
            Accept: "application/json",
            "User-Agent": "setlists.live/1.0",
          },
        });
      };

      const offsets = [0, -1, 1];
      for (const offset of offsets) {
        const tryDate = new Date(baseDate);
        tryDate.setUTCDate(baseDate.getUTCDate() + offset);
        const { api: setlistfmDate, iso } = formatDate(tryDate);
        const searchUrl = `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(
          artist.name,
        )}&cityName=${encodeURIComponent(venue.city)}&date=${setlistfmDate}`;

        console.log(`🔍 Searching setlist.fm (${offset}d): ${artist.name} @ ${venue.city} on ${setlistfmDate}`);

        const apiResponse = await fetchWithRetry(searchUrl);
        
        // Handle 404 as "no results" - continue to next date offset
        if (apiResponse.status === 404) {
          console.log(`ℹ️  No setlist found for date ${setlistfmDate}, trying next offset...`);
          continue;
        }
        
        // Handle other non-OK responses as errors
        if (!apiResponse.ok) {
          const errorMsg = `Setlist.fm API error: ${apiResponse.status}`;
          console.error(`❌ ${errorMsg}`);
          // Don't throw - mark as pending and let cron retry later
          await ctx.runMutation(internalRef.shows.updateImportStatus, {
            showId: args.showId,
            status: "pending" as const,
          });
          return null;
        }

        const data = await apiResponse.json();
        const response = data.setlist?.[0] ? { setlist: data.setlist[0] } : null;

        if (response && response.setlist) {
          const setlistId = await ctx.runMutation(internalRef.setlists.createFromApi, {
            showId: args.showId,
            data: response.setlist,
          });
          await ctx.runMutation(internalRef.shows.updateImportStatus, {
            showId: args.showId,
            status: "completed",
          });
          console.log(`✅ Synced setlist for ${artist.name} (${setlistId}) using date ${iso}`);
          return setlistId;
        }
      }

      // No setlist found after all attempts - keep pending for retries
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      baseDate.setHours(0, 0, 0, 0);

      if (baseDate >= today) {
        console.log(`ℹ️  Show hasn't occurred yet: ${artist.name} @ ${venue.city} on ${args.showDate}`);
      } else {
        console.log(
          `⚠️  No setlist found (±1 day attempts) for ${artist.name} @ ${venue.city} (${args.showDate}); keeping pending`,
        );
      }

      await ctx.runMutation(internalRef.shows.updateImportStatus, {
        showId: args.showId,
        status: "pending" as const,
      });
      return null;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`❌ Setlist sync failed for show ${args.showId}: ${errorMsg}`);
      await ctx.runMutation(internalRef.shows.updateImportStatus, {
        showId: args.showId,
        status: "pending" as const,
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
    const completedShows = await ctx.runQuery(internalRef.setlistfm.getCompletedShowsNeedingImport, {}); 
    let setlistsSynced = 0;
    for (const show of completedShows) {
      try {
        await ctx.runMutation(internalRef.shows.updateImportStatus, {
          showId: show._id,
          status: "importing",
        });

        const artist = await ctx.runQuery(internalRef.artists.getByIdInternal, { id: show.artistId });
        const venue = await ctx.runQuery(internalRef.venues.getByIdInternal, { id: show.venueId });
        
        if (artist && venue) {
          const setlistId = await ctx.runAction(internalRef.setlistfm.syncActualSetlist, {
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
    return await ctx.runAction(internalRef.setlistfm.syncActualSetlist, args);
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

      const response = await setlistFetchWithTimeout(setlistUrl, {
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
      await ctx.runMutation(internalRef.setlists.updateWithActualSetlist, {
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
    await ctx.runAction(internalRef.setlistfm.checkCompletedShows, {});
    return { success: true, message: "Completed shows check triggered successfully" };
  },
});

export const scanPendingImports = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔍 Scanning for pending Setlist.fm imports...");
    const pendingShows = await ctx.runQuery(internalRef.setlistfm.getPendingImports, {});

    let queuedCount = 0;
    for (const show of pendingShows) {
      try {
        const artist = await ctx.runQuery(internalRef.artists.getByIdInternal, { id: show.artistId });
        const venue = await ctx.runQuery(internalRef.venues.getByIdInternal, { id: show.venueId });

        if (artist && venue) {
          // Queue the import job instead of processing directly
          // This provides retry logic and better error handling
          await ctx.runMutation(internalRef.syncJobs.queueSetlistImport, {
            showId: show._id,
            artistName: artist.name,
            venueCity: venue.city,
            showDate: show.date,
          });
          queuedCount++;
          console.log(`✅ Queued setlist import for ${artist.name} at ${venue.city} on ${show.date}`);
        } else {
          await ctx.runMutation(internalRef.shows.updateImportStatus, { showId: show._id, status: "failed" });
          console.warn(`⚠️ Missing artist or venue for show ${show._id}`);
        }
      } catch (error) {
        console.error(`Failed to queue import for show ${show._id}:`, error);
        await ctx.runMutation(internalRef.shows.updateImportStatus, { showId: show._id, status: "failed" });
      }
    }

    console.log(`✅ Import scan complete: ${queuedCount} jobs queued (will be processed by process-setlist-queue cron)`);
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
