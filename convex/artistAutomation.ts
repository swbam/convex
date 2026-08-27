import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internalRef } from "./adminHelpers";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const UPCOMING_URGENT_WINDOW_MS = 7 * DAY;
// Widened from 3 to 14 days to match the setlist.fm import-retry window
const COMPLETED_IMPORT_WINDOW_MS = 14 * DAY;
const DEMAND_RECONCILE_WINDOW_MS = 12 * HOUR;
const MAX_AUTOMATED_ARTISTS_PER_RUN = 8;

function parseShowDate(date?: string): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  const timestamp = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function uniqueShowIds(shows: Array<{ _id: any }>): any[] {
  return Array.from(new Set(shows.map((show) => show._id)));
}

export const getManagedArtistSyncCandidates = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? MAX_AUTOMATED_ARTISTS_PER_RUN, 25));
    const artists = await ctx.db
      .query("artists")
      .withIndex("by_artist_access_enabled", (q) => q.eq("artistAccessEnabled", true))
      .collect();

    const now = Date.now();
    const candidates = await Promise.all(
      artists.map(async (artist) => {
        const upcomingShows = await ctx.db
          .query("shows")
          .withIndex("by_artist_status_and_date", (q) => q.eq("artistId", artist._id).eq("status", "upcoming"))
          .order("asc")
          .take(3);

        const nextShowAt = parseShowDate(upcomingShows[0]?.date);
        const hasUrgentUpcomingShow =
          nextShowAt !== null && nextShowAt >= now && nextShowAt - now <= UPCOMING_URGENT_WINDOW_MS;

        const freshnessWindowMs = hasUrgentUpcomingShow ? HOUR : DAY;
        const lastRefreshAt = artist.lastAutonomousRefreshAt ?? 0;
        const needsRefresh =
          !lastRefreshAt ||
          now - lastRefreshAt >= freshnessWindowMs ||
          !artist.ticketmasterId ||
          !artist.spotifyId ||
          artist.catalogSyncStatus !== "completed";

        const urgencyScore =
          (hasUrgentUpcomingShow ? 1000 : 0) +
          (!artist.ticketmasterId ? 500 : 0) +
          (!artist.spotifyId ? 300 : 0) +
          (artist.catalogSyncStatus !== "completed" ? 200 : 0) +
          Math.min(Math.floor((now - lastRefreshAt) / HOUR), 100);

        return {
          artistId: artist._id,
          artistName: artist.name,
          nextShowDate: upcomingShows[0]?.date,
          hasUrgentUpcomingShow,
          lastAutonomousRefreshAt: artist.lastAutonomousRefreshAt,
          ticketmasterId: artist.ticketmasterId,
          spotifyId: artist.spotifyId,
          catalogSyncStatus: artist.catalogSyncStatus ?? "never",
          needsRefresh,
          urgencyScore,
        };
      }),
    );

    return candidates
      .filter((candidate) => candidate.needsRefresh)
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
      .slice(0, limit);
  },
});

export const getArtistWarmupSnapshot = internalQuery({
  args: {
    artistId: v.id("artists"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const artist = await ctx.db.get(args.artistId);
    if (!artist) {
      return null;
    }

    const [upcomingShows, completedShows, artistSongs] = await Promise.all([
      ctx.db
        .query("shows")
        .withIndex("by_artist_status_and_date", (q) => q.eq("artistId", args.artistId).eq("status", "upcoming"))
        .order("asc")
        .collect(),
      ctx.db
        .query("shows")
        .withIndex("by_artist_status_and_date", (q) => q.eq("artistId", args.artistId).eq("status", "completed"))
        .order("desc")
        .take(10),
      ctx.db
        .query("artistSongs")
        .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
        .collect(),
    ]);

    const cutoff = Date.now() - COMPLETED_IMPORT_WINDOW_MS;
    const recentCompletedShows = completedShows.filter((show) => {
      const showDate = parseShowDate(show.date);
      return showDate !== null && showDate >= cutoff;
    });

    return {
      artist,
      upcomingShows,
      recentCompletedShows,
      songCount: artistSongs.length,
    };
  },
});

export const refreshManagedArtistAutomation = internalAction({
  args: {},
  returns: v.object({
    scheduled: v.number(),
    artists: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const candidates = await ctx.runQuery(
      internalRef.artistAutomation.getManagedArtistSyncCandidates,
      { limit: MAX_AUTOMATED_ARTISTS_PER_RUN },
    );

    let scheduled = 0;
    const artists: string[] = [];

    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      const delayMs = i * 15_000;
      await ctx.scheduler.runAfter(delayMs, internalRef.artistAutomation.runManagedArtistWarmup, {
        artistId: candidate.artistId,
        reason: candidate.hasUrgentUpcomingShow ? "urgent_upcoming_show" : "scheduled_refresh",
        force: false,
      });
      scheduled += 1;
      artists.push(candidate.artistName);
    }

    return { scheduled, artists };
  },
});

export const runManagedArtistWarmup = internalAction({
  args: {
    artistId: v.id("artists"),
    reason: v.optional(v.string()),
    force: v.optional(v.boolean()),
    analyticsDistinctId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const lockName = `artist-warmup:${args.artistId}`;
    const lockAcquired = await ctx.runMutation(internalRef.maintenance.acquireLock, {
      name: lockName,
      staleMs: 30 * MINUTE,
    });

    if (!lockAcquired) {
      return { skipped: true, reason: "already_running" };
    }

    try {
      let snapshot = await ctx.runQuery(internalRef.artistAutomation.getArtistWarmupSnapshot, {
        artistId: args.artistId,
      });
      if (!snapshot?.artist) {
        return { skipped: true, reason: "artist_not_found" };
      }

      const now = Date.now();
      const steps: string[] = [];
      let demandReconciled = false;
      let scheduledCompletedImports = 0;

      const nextShowAt = parseShowDate(snapshot.upcomingShows[0]?.date);
      const hasUrgentUpcomingShow =
        nextShowAt !== null && nextShowAt >= now && nextShowAt - now <= UPCOMING_URGENT_WINDOW_MS;
      const showFreshnessWindowMs = hasUrgentUpcomingShow ? HOUR : DAY;

      if (args.force || !snapshot.artist.ticketmasterId) {
        await ctx.runAction(internalRef.ticketmaster.searchAndSyncArtistShows, {
          artistId: args.artistId,
          artistName: snapshot.artist.name,
        });
        steps.push("ticketmaster_search");
        snapshot = await ctx.runQuery(internalRef.artistAutomation.getArtistWarmupSnapshot, {
          artistId: args.artistId,
        });
      } else if (
        args.force ||
        !snapshot.artist.lastShowSyncAt ||
        now - snapshot.artist.lastShowSyncAt >= showFreshnessWindowMs
      ) {
        await ctx.runAction(internalRef.ticketmaster.syncArtistShowsWithTracking, {
          artistId: args.artistId,
          ticketmasterId: snapshot.artist.ticketmasterId,
          artistName: snapshot.artist.name,
        });
        steps.push("ticketmaster_shows");
        snapshot = await ctx.runQuery(internalRef.artistAutomation.getArtistWarmupSnapshot, {
          artistId: args.artistId,
        });
      }

      if (
        args.force ||
        !snapshot.artist.spotifyId ||
        !snapshot.artist.lastSpotifyBasicsSyncAt ||
        now - snapshot.artist.lastSpotifyBasicsSyncAt >= DAY
      ) {
        await ctx.runAction(internalRef.spotify.enrichArtistBasics, {
          artistId: args.artistId,
          artistName: snapshot.artist.name,
        });
        steps.push("spotify_basics");
        snapshot = await ctx.runQuery(internalRef.artistAutomation.getArtistWarmupSnapshot, {
          artistId: args.artistId,
        });
      }

      const catalogFresh =
        snapshot.artist.catalogSyncStatus === "completed" &&
        !!snapshot.artist.lastCatalogSyncAt &&
        now - snapshot.artist.lastCatalogSyncAt < DAY;

      if (!catalogFresh || snapshot.songCount === 0 || args.force) {
        if (snapshot.songCount === 0 && snapshot.upcomingShows.length > 0) {
          await ctx.runAction(internalRef.spotify.importArtistTopTracks, {
            artistId: args.artistId,
            artistName: snapshot.artist.name,
            maxTracks: 25,
          });
          steps.push("spotify_top_tracks_seed");
        }

        await ctx.runAction(internalRef.spotify.syncArtistCatalog, {
          artistId: args.artistId,
          artistName: snapshot.artist.name,
        });
        steps.push("spotify_catalog");
        snapshot = await ctx.runQuery(internalRef.artistAutomation.getArtistWarmupSnapshot, {
          artistId: args.artistId,
        });
      }

      if (snapshot.songCount > 0 && snapshot.upcomingShows.length > 0) {
        await ctx.runMutation(internalRef.setlists.ensurePredictionsForArtistShows, {
          artistId: args.artistId,
        });
        steps.push("prediction_setlists");
      }

      const demandShowIds = uniqueShowIds([
        ...snapshot.upcomingShows.slice(0, 20),
        ...snapshot.recentCompletedShows.slice(0, 10),
      ]);
      const shouldReconcileDemand =
        demandShowIds.length > 0 &&
        (args.force ||
          !snapshot.artist.lastDemandReconcileAt ||
          now - snapshot.artist.lastDemandReconcileAt >= DEMAND_RECONCILE_WINDOW_MS);

      if (shouldReconcileDemand) {
        await ctx.runMutation(internalRef.admin.backfillShowSongDemandInternal, {
          mode: "reconcile",
          showIds: demandShowIds,
        });
        demandReconciled = true;
        steps.push("demand_reconcile");
      }

      for (let i = 0; i < snapshot.recentCompletedShows.length; i += 1) {
        const show = snapshot.recentCompletedShows[i];
        const needsImport =
          !show.setlistfmId &&
          (show.importStatus === "pending" || show.importStatus === "failed" || !show.importStatus);

        if (!needsImport) {
          continue;
        }

        const venue = await ctx.runQuery(internalRef.venues.getByIdInternal, { id: show.venueId });
        if (!venue?.city) {
          continue;
        }

        await ctx.scheduler.runAfter(i * 1_500, internalRef.setlistfm.syncActualSetlist, {
          showId: show._id,
          artistName: snapshot.artist.name,
          venueCity: venue.city,
          showDate: show.date,
        });
        scheduledCompletedImports += 1;
      }

      // One-time setlist.fm history import so the artist's Past tab has data.
      if (!snapshot.artist.lastSetlistfmHistorySyncAt) {
        await ctx.scheduler.runAfter(0, internalRef.setlistfmHistory.importArtistHistory, {
          artistId: args.artistId,
        });
        steps.push("setlistfm_history_import");
      }

      await ctx.runMutation(internalRef.artists.recordAutomationSync, {
        artistId: args.artistId,
        lastAutonomousRefreshAt: now,
        lastDemandReconcileAt: demandReconciled ? now : undefined,
      });

      const result = {
        skipped: false,
        artistId: args.artistId,
        artistName: snapshot.artist.name,
        reason: args.reason ?? "manual",
        steps,
        songCount: snapshot.songCount,
        upcomingShows: snapshot.upcomingShows.length,
        recentCompletedShows: snapshot.recentCompletedShows.length,
        scheduledCompletedImports,
      };
      await ctx.scheduler.runAfter(0, internalRef.analytics.capture, {
        event: "artist_warmup_completed",
        distinctId: args.analyticsDistinctId || `artist:${args.artistId}`,
        properties: {
          artist_id: args.artistId,
          reason: args.reason ?? "manual",
          force: Boolean(args.force),
          steps,
          step_count: steps.length,
          song_count: snapshot.songCount,
          upcoming_show_count: snapshot.upcomingShows.length,
          recent_completed_show_count: snapshot.recentCompletedShows.length,
          scheduled_setlist_import_count: scheduledCompletedImports,
          demand_reconciled: demandReconciled,
          duration_ms: Date.now() - startedAt,
        },
      });
      return result;
    } catch (error) {
      await ctx.scheduler.runAfter(0, internalRef.analytics.capture, {
        event: "artist_warmup_failed",
        distinctId: args.analyticsDistinctId || `artist:${args.artistId}`,
        properties: {
          artist_id: args.artistId,
          reason: args.reason ?? "manual",
          force: Boolean(args.force),
          error_type: error instanceof Error ? error.name : "unknown_error",
          duration_ms: Date.now() - startedAt,
        },
      });
      throw error;
    } finally {
      await ctx.runMutation(internalRef.maintenance.releaseLock, { name: lockName });
    }
  },
});
