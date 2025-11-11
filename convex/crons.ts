import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

const crons = cronJobs();

// Orchestrator pattern: configurable via DB (cronSettings table).
export const orchestrate = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Helper to get interval/enable and lastRun
    const getSetting = async (name: string, defaultMs: number) => {
      const existing = await ctx.runQuery(internal.cronSettings.getByNameInternal, { name });
      if (!existing) {
        await ctx.runMutation(internal.cronSettings.upsertInternal, {
          name,
          intervalMs: defaultMs,
          enabled: true,
          lastRunAt: 0,
        });
        return { intervalMs: defaultMs, enabled: true, lastRunAt: 0 };
      }
      return existing as any;
    };
    const maybeRun = async (name: string, defaultMs: number, fn: () => Promise<void>) => {
      const s = await getSetting(name, defaultMs);
      if (!s.enabled) return;
      const now = Date.now();
      const last = s.lastRunAt || 0;
      if (now - last >= s.intervalMs) {
        try {
          await fn();
        } finally {
          await ctx.runMutation(internal.cronSettings.upsertInternal, {
            name,
            intervalMs: s.intervalMs,
            enabled: s.enabled,
            lastRunAt: now,
          });
        }
      }
    };

    // Map all prior jobs to orchestrated checks
    await maybeRun("update-trending", 4 * 60 * 60 * 1000, async () => {
      await ctx.runAction(internal.maintenance.syncTrendingData, {});
    });
    await maybeRun("check-completed-shows", 2 * 60 * 60 * 1000, async () => {
      await ctx.runAction(internal.setlistfm.checkCompletedShows, {});
    });
    await maybeRun("daily-cleanup", 24 * 60 * 60 * 1000, async () => {
      await ctx.runAction(internal.maintenance.cleanupOrphanedRecords, {});
    });
    await maybeRun("setlistfm-scan", 30 * 60 * 1000, async () => {
      await ctx.runAction(internal.setlistfm.scanPendingImports, {});
    });
    await maybeRun("sync-engagement-counts", 60 * 60 * 1000, async () => {
      await ctx.runMutation(internal.trending.updateEngagementCounts, {});
    });
    await maybeRun("update-artist-show-counts", 2 * 60 * 60 * 1000, async () => {
      await ctx.runMutation(internal.trending.updateArtistShowCounts, {});
    });
    await maybeRun("update-artist-trending", 4 * 60 * 60 * 1000, async () => {
      await ctx.runMutation(internal.trending.updateArtistTrending, {});
    });
    await maybeRun("update-show-trending", 4 * 60 * 60 * 1000, async () => {
      await ctx.runMutation(internal.trending.updateShowTrending, {});
    });
    await maybeRun("auto-transition-shows", 2 * 60 * 60 * 1000, async () => {
      await ctx.runMutation(internal.shows.autoTransitionStatuses, {});
    });
    await maybeRun("populate-missing-fields", 60 * 60 * 1000, async () => {
      await ctx.runAction(internal.maintenance.populateMissingFields, {});
    });
    await maybeRun("spotify-refresh", 12 * 60 * 60 * 1000, async () => {
      await ctx.runAction(internal.spotifyAuth.refreshUserTokens, {});
    });
    await maybeRun("refresh-auto-setlists", 6 * 60 * 60 * 1000, async () => {
      await ctx.runMutation(internal.setlists.refreshMissingAutoSetlists, { limit: 60 });
    });
    await maybeRun("backfill-legacy-setlists", 7 * 24 * 60 * 60 * 1000, async () => {
      await ctx.runMutation(internal.setlists.refreshMissingAutoSetlists, { limit: 200, includeCompleted: true });
    });
  },
});

// Run orchestrator frequently; actual work is gated by DB-configured intervals.
crons.interval("orchestrator", { minutes: 5 }, internal.crons.orchestrate, {});

export default crons;
