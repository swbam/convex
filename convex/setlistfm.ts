import { setlistProviderFetch } from "./lib/setlistProviderFetch";
import { importRetryExpiry } from "./lib/importRetry";
import { selectSetlistMatch } from "./lib/setlistMatch";
import { hasShowEnded } from "./lib/showTiming";
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { internalRef, requireAdmin, requireAdminForAction } from "./adminHelpers";
import { Id } from "./_generated/dataModel";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any


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

      if (show.status === "cancelled" || !hasShowEnded(show)) return null;
      if (await ctx.runQuery(internalRef.liveSetlists.isReserved, { showId: args.showId })) return null;

      // API call to Setlist.fm
      const apiKey = process.env.SETLISTFM_API_KEY;
      if (!apiKey) {
        console.error("❌ SETLISTFM_API_KEY not configured");
        throw new Error("SETLISTFM_API_KEY not configured");
      }

      const baseDate = new Date(`${show.date}T00:00:00Z`);
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
          const response = await setlistProviderFetch(ctx, url, {
            headers: {
              "x-api-key": apiKey,
              Accept: "application/json",
              "User-Agent": "setlists.live/1.0",
            },
          });
          if (response.ok || response.status === 429) return response;
          if (response.status >= 500) {
            attempt += 1;
            if (attempt >= maxAttempts) return response;
            const jitter = Math.floor(Math.random() * 250);
            await new Promise((r) => setTimeout(r, delay + jitter));
            delay *= 2; // backoff
            continue;
          }
          return response;
        }
        return await setlistProviderFetch(ctx, url, {
          headers: {
            "x-api-key": apiKey,
            Accept: "application/json",
            "User-Agent": "setlists.live/1.0",
          },
        });
      };

      const offsets = [0]; // Provider dates are concert-local dates; never guess adjacent nights.
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
        const match = selectSetlistMatch(Array.isArray(data.setlist) ? data.setlist : [], {
          artistName: artist.name, artistMbid: artist.setlistfmMbid,
          venueName: venue.name, city: venue.city, date: show.date,
        });
        const response = match ? { setlist: match } : null;

        if (response && response.setlist) {
          // Check if the setlist actually has songs before marking as completed
          const sets = response.setlist.sets?.set;
          const hasSongs = Array.isArray(sets) && sets.some((set: any) =>
            Array.isArray(set.song) && set.song.length > 0
          );

          if (hasSongs) {
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
          } else {
            // Setlist entry exists but no songs yet - mark as not_found to retry later
            console.log(`ℹ️  Setlist found but empty for ${artist.name} @ ${venue.city} on ${iso}, will retry`);
            await ctx.runMutation(internalRef.shows.updateImportStatus, {
              showId: args.showId,
              status: "not_found" as const,
            });
            return null;
          }
        }
      }

      // No setlist found after all attempts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      baseDate.setHours(0, 0, 0, 0);

      if (baseDate >= today) {
        // Show hasn't happened yet - keep pending
        console.log(`ℹ️  Show hasn't occurred yet: ${artist.name} @ ${venue.city} on ${args.showDate}`);
        await ctx.runMutation(internalRef.shows.updateImportStatus, {
          showId: args.showId,
          status: "pending" as const,
        });
      } else {
        // Show is in the past but no setlist found - mark as not_found (will retry later)
        console.log(
          `⚠️  No setlist found on Setlist.fm for ${artist.name} @ ${venue.city} (${args.showDate}); marking not_found`,
        );
        await ctx.runMutation(internalRef.shows.updateImportStatus, {
          showId: args.showId,
          status: "not_found" as const,
        });
      }
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
    await ctx.runMutation(internalRef.catalogRepertoire.recoverQueues, {});
    if (!process.env.SETLISTFM_API_KEY) return null;
    const name = "completed-setlist-import";
    const acquired = await ctx.runMutation(internalRef.maintenance.acquireLock, {
      name, staleMs: 15 * 60 * 1000,
    });
    if (!acquired) return null;
    const startedAt = Date.now();
    try {
      await ctx.runMutation(internalRef.setlistfm.prepareCompletedShowImports, {});
      const budget = await ctx.runQuery(internalRef.setlistProvider.getWorkerBudget, {});
      if ((budget.cooldownUntil ?? 0) > startedAt) return null;
      // Pace bulk work across the remaining two-hour windows. Each individual fetch
      // still passes through the global limiter, including retries and live-show reserves.
      const windowsLeft = 12 - Math.floor(new Date(startedAt).getUTCHours() / 2);
      const slots = Math.min(60, Math.floor(budget.remaining * 0.6 / windowsLeft));
      let firstRemaining = Math.min(20, Math.ceil(slots / 2));
      let retryRemaining = slots - firstRemaining;
      for (let wave = 0; wave < 3 && (firstRemaining || retryRemaining); wave++) {
        const shows = await ctx.runQuery(internalRef.setlistfm.getCompletedShowsNeedingImport,
          { firstLimit: firstRemaining, retryLimit: retryRemaining });
        if (!shows.length) break;
        for (const show of shows) {
        // Leave headroom for a final provider request and release the lock.
        if (Date.now() - startedAt > 4 * 60 * 1000) break;
        const reserved = await ctx.runMutation(internalRef.setlistfm.reserveCompletedShowImport, {
          showId: show._id,
        });
        if (!reserved) continue;
        if ((show.importAttemptCount ?? 0) === 0) firstRemaining--;
        else retryRemaining--;
        try {
          const [artist, venue] = await Promise.all([
            ctx.runQuery(internalRef.artists.getByIdInternal, { id: show.artistId }),
            ctx.runQuery(internalRef.venues.getByIdInternal, { id: show.venueId }),
          ]);
          if (!artist || !venue) throw new Error("Missing show artist or venue");
          await ctx.runAction(internalRef.setlistfm.syncActualSetlist, {
            showId: show._id, artistName: artist.name,
            venueCity: venue.city, showDate: show.date,
          });
        } catch (error) {
          console.error(`Setlist import failed for ${show._id}`, error);
          await ctx.runMutation(internalRef.shows.updateImportStatus, {
            showId: show._id, status: "failed",
          });
        }
        // Keep the existing provider spacing; this is not a provider-wide quota limiter.
        await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (Date.now() - startedAt > 4 * 60 * 1000) break;
      }
    } finally {
      await ctx.runMutation(internalRef.maintenance.releaseLock, { name });
    }
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
    await requireAdminForAction(ctx);
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
      if (await ctx.runQuery(internalRef.liveSetlists.isReserved, { showId: args.showId })) return null;
      // Get specific setlist by ID
      const setlistUrl = `https://api.setlist.fm/rest/1.0/setlist/${args.setlistfmId}`;
      console.log(`🔍 Fetching specific setlist: ${args.setlistfmId}`);

      const response = await setlistProviderFetch(ctx, setlistUrl, {
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
          const isEncore = Number(set.encore) > 0 || set.encore === true || set.encore === "true";
          const setNumber = setIndex + 1;

          console.log(`📋 Processing set ${setNumber} (encore: ${isEncore}) with ${set.song?.length || 0} songs`);

          if (set.song && Array.isArray(set.song)) {
            for (const song of set.song) {
              if (!song.tape && song.name && song.name.trim() !== '') {
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

export const triggerCompletedShowsCheck = internalAction({
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

// Bootstrap legacy records in bounded pages. New completions are queued by shows.ts.
export const prepareCompletedShowImports = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowStart = new Date(now - 14 * 86400000).toISOString().slice(0, 10);
    const today = new Date(now).toISOString().slice(0, 10);
    const result = await ctx.db.query("shows")
      .withIndex("by_status_and_date", q =>
        q.eq("status", "completed").gte("date", windowStart).lte("date", today))
      .paginate({ numItems: 200, cursor: args.cursor ?? null });
    for (const show of result.page) {
      if (show.importStatus === "completed") continue;
      if (show.importNextAttemptAt !== undefined) {
        if (show.importRetryExpiresAt === undefined) await ctx.db.patch(show._id, { importRetryExpiresAt: importRetryExpiry(show.date) });
        continue;
      }
      const retry = show.importStatus === "not_found" || show.importStatus === "failed" ||
        show.importStatus === "importing";
      await ctx.db.patch(show._id, {
        importStatus: show.importStatus ?? "pending",
        importRetryExpiresAt: importRetryExpiry(show.date),
        importAttemptCount: show.importAttemptCount ?? (retry ? 1 : 0),
        // lastSynced is used once for legacy migration, never for subsequent retries.
        importNextAttemptAt: retry
          ? Math.max(now, (show.importLastAttemptAt ?? show.lastSynced ?? 0) +
              (show.importStatus === "not_found" ? 86400000 : 3600000))
          : now,
      });
    }
    if (!result.isDone) await ctx.scheduler.runAfter(0,
      internalRef.setlistfm.prepareCompletedShowImports, { cursor: result.continueCursor });
    return null;
  },
});

export const getCompletedShowsNeedingImport = internalQuery({
  args: { firstLimit: v.optional(v.number()), retryLimit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowStart = new Date(now - 14 * 86400000).toISOString().slice(0, 10);
    const today = new Date(now).toISOString().slice(0, 10);
    const groups = await Promise.all(
      (["pending", "failed", "not_found", "importing"] as const).map(status =>
        ctx.db.query("shows").withIndex("by_status_import_date", q =>
          q.eq("status", "completed").eq("importStatus", status)
            .gte("date", windowStart).lte("date", today))
          .filter(q => q.and(q.gte(q.field("importNextAttemptAt"), 0), q.lte(q.field("importNextAttemptAt"), now)))
          .take(60))
    );
    // Expired rows are excluded by the index range BEFORE either admission budget.
    const due = groups.flat().filter(s => hasShowEnded(s, now)).sort((a, b) =>
      (a.importNextAttemptAt ?? 0) - (b.importNextAttemptAt ?? 0) || a.date.localeCompare(b.date) || a._id.localeCompare(b._id));
    const firstLimit = Math.max(0, Math.min(20, args.firstLimit ?? 20));
    const retryLimit = Math.max(0, Math.min(40, args.retryLimit ?? 10));
    return [...due.filter(s => (s.importAttemptCount ?? 0) === 0).slice(0, firstLimit),
      ...due.filter(s => (s.importAttemptCount ?? 0) > 0).slice(0, retryLimit)];
  },
});

// Separate housekeeping from provider admission. No provider requests are spent here.
export const backfillImportExpiry = internalMutation({
  args: { cursor: v.optional(v.string()), cutoff: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cutoff = args.cutoff ?? new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const result = await ctx.db.query("shows").withIndex("by_status_and_date",
      q => q.eq("status", "completed").lt("date", cutoff))
      .paginate({ numItems: 250, cursor: args.cursor ?? null, maximumBytesRead: 1_000_000 });
    for (const show of result.page) {
      if (show.importNextAttemptAt !== undefined) await ctx.db.patch(show._id, { importNextAttemptAt: undefined, importRetryExpiresAt: undefined });
    }
    if (!result.isDone) await ctx.scheduler.runAfter(0, internalRef.setlistfm.backfillImportExpiry,
      { cursor: result.continueCursor, cutoff });
    return null;
  },
});

export const expireCompletedShowImports = internalMutation({
  args: {}, returns: v.number(),
  handler: async (ctx) => {
    const rows = await ctx.db.query("shows").withIndex("by_import_retry_expiry",
      q => q.gte("importRetryExpiresAt", 0).lte("importRetryExpiresAt", Date.now())).take(250);
    for (const row of rows) await ctx.db.patch(row._id, { importNextAttemptAt: undefined, importRetryExpiresAt: undefined });
    if (rows.length === 250) await ctx.scheduler.runAfter(0, internalRef.setlistfm.expireCompletedShowImports, {});
    return rows.length;
  },
});

export const reserveCompletedShowImport = internalMutation({
  args: { showId: v.id("shows"), initialize: v.optional(v.boolean()) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.showId);
    const now = Date.now();
    if (!show || show.status !== "completed" || show.importStatus === "completed" ||
        (show.importNextAttemptAt === undefined && !args.initialize) ||
        (show.importNextAttemptAt ?? 0) > now) return false;
    const windowStart = new Date(now - 14 * 86400000).toISOString().slice(0, 10);
    if (show.date < windowStart) {
      await ctx.db.patch(show._id, { importNextAttemptAt: undefined, importRetryExpiresAt: undefined });
      return false;
    }
    if (!hasShowEnded(show, now)) {
      await ctx.db.patch(show._id, { importNextAttemptAt: now + 3600000 });
      return false;
    }
    await ctx.db.patch(show._id, {
      importStatus: "importing", importLastAttemptAt: now,
      importRetryExpiresAt: importRetryExpiry(show.date),
      importNextAttemptAt: now + 3600000, // recover a crashed action after its lease expires
      importAttemptCount: (show.importAttemptCount ?? 0) + 1,
    });
    return true;
  },
});

// Admin observability: importStatus breakdown for recently-completed shows
// plus bounded global counts (capped at 1000 per status to stay within read
// limits — "1000" should be read as "1000+").
export const getImportStats = query({
  args: {},
  returns: v.union(v.null(), v.any()),
  handler: async (ctx) => {
    try {
      await requireAdmin(ctx);
    } catch {
      return null;
    }

    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const windowStart = new Date(now - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const recent = await ctx.db
      .query("shows")
      .withIndex("by_status_and_date", (q) =>
        q.eq("status", "completed").gte("date", windowStart).lte("date", today),
      )
      .order("desc")
      .take(2000);
    const recentBreakdown: Record<string, number> = {};
    for (const s of recent) {
      const key = s.importStatus ?? "unset";
      recentBreakdown[key] = (recentBreakdown[key] ?? 0) + 1;
    }

    const globalCounts: Record<string, number> = {};
    for (const status of ["pending", "importing", "completed", "not_found", "failed"] as const) {
      const rows = await ctx.db
        .query("shows")
        .withIndex("by_import_status", (q) => q.eq("importStatus", status))
        .take(1000);
      globalCounts[status] = rows.length;
    }

    return {
      windowDays: 30,
      recentCompletedShows: recent.length,
      recentBreakdown,
      globalCounts,
      globalCountsCappedAt: 1000,
    };
  },
});

// Find shows marked as "completed" but with empty actualSetlist - these need re-import
export const getShowsWithEmptySetlists = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

    // Get completed shows that might have empty setlists
    const completedShows = await ctx.db
      .query("shows")
      .withIndex("by_status_and_date", (q) => q.eq("status", "completed"))
      .order("desc")
      .filter((q) => q.and(
        q.eq(q.field("importStatus"), "completed"),
        q.lt(q.field("lastSynced"), twentyFourHoursAgo)
      ))
      .take(limit * 2);

    // Filter to only shows where the setlist is empty
    const showsNeedingRetry: any[] = [];
    for (const show of completedShows) {
      if (showsNeedingRetry.length >= limit) break;

      const setlists = await ctx.db
        .query("setlists")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();

      const hasActualSetlist = setlists.some((s: any) =>
        s.actualSetlist && Array.isArray(s.actualSetlist) && s.actualSetlist.length > 0
      );

      if (!hasActualSetlist) {
        showsNeedingRetry.push(show);
      }
    }

    return showsNeedingRetry;
  },
});

// Action to re-import shows with empty setlists
export const retryEmptySetlists = internalAction({
  args: { limit: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    console.log(`🔄 Checking for shows with empty setlists to retry...`);

    const showsToRetry = await ctx.runQuery(internalRef.setlistfm.getShowsWithEmptySetlists, { limit });

    if (showsToRetry.length === 0) {
      console.log(`✅ No shows with empty setlists need retry`);
      return null;
    }

    console.log(`📋 Found ${showsToRetry.length} shows with empty setlists to retry`);

    for (const show of showsToRetry) {
      try {
        // Reset import status to trigger re-import
        await ctx.runMutation(internalRef.shows.updateImportStatus, {
          showId: show._id,
          status: "not_found" as const,
        });

        const artist = await ctx.runQuery(internalRef.artists.getByIdInternal, { id: show.artistId });
        const venue = await ctx.runQuery(internalRef.venues.getByIdInternal, { id: show.venueId });

        if (artist && venue) {
          await ctx.runAction(internalRef.setlistfm.syncActualSetlist, {
            showId: show._id,
            artistName: artist.name,
            venueCity: venue.city,
            showDate: show.date,
          });
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to retry show ${show._id}:`, error);
      }
    }

    console.log(`✅ Retry complete for ${showsToRetry.length} shows`);
    return null;
  },
});

export const getPendingImports = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query("shows")
      .withIndex("by_status_and_date", (q) => q.eq("status", "completed"))
      .order("desc")
      .filter((q) => q.or(
        q.eq(q.field("importStatus"), "pending"),
        q.eq(q.field("importStatus"), undefined)
      ))
      .take(5);
  },
});
