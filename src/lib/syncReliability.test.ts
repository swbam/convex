// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { internal, api } from "../../convex/_generated/api";
import { classifyAttraction, isConcertDiscoveryCandidate } from "../../convex/lib/attractionIdentity";
import { queueRepertoireMerge } from "../../convex/catalogRepertoire";
import { importRetryExpiry } from "../../convex/lib/importRetry";

const modules = import.meta.glob("../../convex/**/*.{ts,js}");
const ref = internal as any;
const NOW = Date.parse("2026-10-23T02:00:00Z");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function setup() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const ids = await t.run(async ctx => ({
    artistId: await ctx.db.insert("artists", { name: "Example", slug: "example", isActive: true, upcomingShowsCount: 99, ticketmasterId: "tm1" }),
    venueId: await ctx.db.insert("venues", { name: "Hall", city: "Chicago", country: "US" }),
  }));
  return { t, ...ids };
}

describe("setlist retry fairness and retirement", () => {
  it("admits current work even with hundreds of expired candidates ahead of it", async () => {
    const { t, artistId, venueId } = await setup();
    const ids = await t.run(async ctx => {
      for (let i = 0; i < 150; i++) await ctx.db.insert("shows", {
        artistId, venueId, date: "2026-09-20", status: "completed", importStatus: "not_found",
        importAttemptCount: 1, importNextAttemptAt: NOW - 20 * 86400000,
      });
      const retry = await ctx.db.insert("shows", { artistId, venueId, date: "2026-10-20", status: "completed",
        importStatus: "not_found", importAttemptCount: 1, importNextAttemptAt: NOW - 1000 });
      const first = await ctx.db.insert("shows", { artistId, venueId, date: "2026-10-21", status: "completed",
        importStatus: "pending", importAttemptCount: 0, importNextAttemptAt: NOW - 1000 });
      return { retry, first };
    });
    const due = await t.query(ref.setlistfm.getCompletedShowsNeedingImport, {});
    expect(due.map((s: any) => s._id)).toEqual([ids.first, ids.retry]);
    expect(await t.mutation(ref.setlistfm.reserveCompletedShowImport, { showId: ids.retry })).toBe(true);
    expect(await t.mutation(ref.setlistfm.reserveCompletedShowImport, { showId: ids.retry })).toBe(false);
    expect(await t.query(ref.setlistfm.getCompletedShowsNeedingImport, { firstLimit: 0, retryLimit: 10 })).toEqual([]);
  });
  it("expires indexed work only after the inclusive 14-day boundary", async () => {
    const { t, artistId, venueId } = await setup();
    const ids = await t.run(async ctx => Promise.all(["2026-10-08", "2026-10-09"].map(date => ctx.db.insert("shows", {
      artistId, venueId, date, status: "completed", importStatus: "not_found",
      importNextAttemptAt: NOW - 1000, importRetryExpiresAt: importRetryExpiry(date),
    }))));
    expect(await t.mutation(ref.setlistfm.expireCompletedShowImports, {})).toBe(1);
    expect(await t.run(ctx => ctx.db.get(ids[0]))).not.toHaveProperty("importNextAttemptAt");
    expect(await t.run(ctx => ctx.db.get(ids[1]))).toHaveProperty("importNextAttemptAt");
  });
  it("retires obsolete jobs without making any provider request or changing recent jobs", async () => {
    const { t } = await setup();
    const old = await t.run(ctx => ctx.db.insert("syncJobs", { type: "setlist_import", priority: 1, status: "pending", retryCount: 0, maxRetries: 3 }));
    vi.setSystemTime(NOW + 90 * 86400000);
    const recent = await t.run(ctx => ctx.db.insert("syncJobs", { type: "setlist_import", priority: 1, status: "pending", retryCount: 0, maxRetries: 3 }));
    expect(await t.mutation(ref.syncJobs.retireLegacySetlistJobs, {})).toBe(1);
    expect(await t.run(ctx => ctx.db.get(old))).toMatchObject({ status: "cancelled", currentPhase: "retired" });
    expect(await t.run(ctx => ctx.db.get(recent))).toMatchObject({ status: "pending" });
  });
});

describe("complete show count generations", () => {
  it("counts beyond 5,000, preserves prior values during counting, and ignores duplicate pages", async () => {
    const { t, artistId, venueId } = await setup();
    const [late, empty] = await t.run(async ctx => Promise.all(["Late", "Empty"].map(name =>
      ctx.db.insert("artists", { name, slug: name.toLowerCase(), isActive: true, upcomingShowsCount: 99 }))));
    for (let offset = 0; offset < 5205; offset += 200) {
      await t.run(async ctx => {
        for (let i = offset; i < Math.min(offset + 200, 5205); i++) await ctx.db.insert("shows", {
          artistId: i < 5000 ? artistId : late, venueId,
          date: i < 5000 ? "2026-11-01" : "2027-01-01", status: "upcoming",
        });
      });
    }
    await t.mutation(ref.trending.updateArtistShowCounts, {});
    const state = () => t.run(ctx => ctx.db.query("artistShowCountRuns").first());
    let run = (await state())!;
    const first = { generation: run.generation, phase: run.phase, cursor: run.cursor };
    await t.mutation(ref.artistShowCounts.step, first);
    await t.mutation(ref.artistShowCounts.step, first); // duplicate delivery must not double count
    expect((await state())!.showsCounted).toBe(200);
    expect(await t.run(ctx => ctx.db.get(late))).toMatchObject({ upcomingShowsCount: 99 });
    for (let n = 0; n < 100; n++) {
      run = (await state())!;
      if (run.phase === "complete") break;
      await t.mutation(ref.artistShowCounts.step, { generation: run.generation, phase: run.phase, cursor: run.cursor });
    }
    expect(await state()).toMatchObject({ phase: "complete", showsCounted: 5205, artistsUpdated: 3 });
    expect(await t.run(ctx => ctx.db.get(artistId))).toMatchObject({ upcomingShowsCount: 5000 });
    expect(await t.run(ctx => ctx.db.get(late))).toMatchObject({ upcomingShowsCount: 205 });
    expect(await t.run(ctx => ctx.db.get(empty))).toMatchObject({ upcomingShowsCount: 0 });
  });
});

describe("performer identity", () => {
  it.each([["Hans Zimmer", ["Classical"]], ["John Williams", ["Classical"]], ["Trans-Siberian Orchestra", ["Rock"]],
    ["The Dave Brubeck Quartet", ["Jazz"]], ["Christmas", ["Rock"]]])("accepts %s across discovery and import", async (name, genres) => {
    expect(classifyAttraction(name, genres).decision).toBe("artist");
    expect(isConcertDiscoveryCandidate(name, genres)).toBe(true);
    const { t } = await setup();
    expect(await t.mutation(ref.artists.createFromTicketmaster, { name, genres, ticketmasterId: name })).not.toBeNull();
  });
  it("records ambiguous metadata for review and retries only changed evidence", async () => {
    const { t } = await setup();
    expect(await t.mutation(ref.artists.createFromTicketmaster, { name: "Unknown", genres: [], ticketmasterId: "unknown" })).toBeNull();
    expect(await t.query(ref.artists.getAttractionImportDecision, { name: "Unknown", genres: [], ticketmasterId: "unknown" })).toMatchObject({ decision: "review" });
    expect(await t.query(ref.artists.getAttractionImportDecision, { name: "Unknown", genres: ["Rock"], ticketmasterId: "unknown" })).toBeNull();
    expect(await t.mutation(ref.artists.createFromTicketmaster, { name: "Unknown", genres: ["Rock"], ticketmasterId: "unknown" })).not.toBeNull();
    expect(await t.run(ctx => ctx.db.query("attractionDecisions").collect())).toEqual([]);
  });
  it("keeps festivals and explicit non-musical formats out of performer discovery", () => {
    expect(isConcertDiscoveryCandidate("Railbird Festival", ["Rock"])).toBe(false);
    expect(isConcertDiscoveryCandidate("Twilight in Concert", ["Classical"])).toBe(false);
    expect(classifyAttraction("A Comedy Night", ["Comedy"]).decision).toBe("excluded");
  });
});

describe("touring refresh coverage", () => {
  it("rotates stale touring artists and backs off failures without erasing existing data", async () => {
    const { t, artistId, venueId } = await setup();
    await t.run(ctx => ctx.db.insert("shows", { artistId, venueId, date: "2026-11-20", status: "upcoming" }));
    expect(await t.mutation(ref.touringRefresh.dispatch, {})).toMatchObject({ scheduled: 1 });
    expect(await t.mutation(ref.touringRefresh.dispatch, {})).toMatchObject({ scheduled: 0 });
    await t.mutation(ref.touringRefresh.finish, { artistId, attemptAt: NOW, interval: 7 * 86400000, error: "partial" });
    expect(await t.run(ctx => ctx.db.get(artistId))).toMatchObject({ showRefreshFailures: 1, upcomingShowsCount: 99, nextShowRefreshAt: NOW + 6 * 3600000 });
  });
});


it("reconciles cached tickets on an already linked show without resurrecting an older listing", async () => {
  const { t, artistId, venueId } = await setup();
  const { showId, cacheId } = await t.run(async ctx => {
    const showId = await ctx.db.insert("shows", { artistId, venueId, date: "2026-11-28", status: "upcoming", ticketmasterId: "one" });
    const cacheId = await ctx.db.insert("trendingShows", { showId, ticketmasterId: "one", showSlug: "one", artistSlug: "artist",
      artistName: "Artist", venueName: "Hall", venueCity: "Chicago", venueCountry: "US", date: "2026-11-28", status: "upcoming",
      ticketUrl: "https://www.ticketmaster.com/event/one", ticketInfo: { kind: "admission", saleStatus: "onsale" }, rank: 1, lastUpdated: NOW });
    return { showId, cacheId };
  });
  await t.mutation(ref.importTrendingShows.importTrendingShowsBatch, {});
  expect((await t.run(ctx => ctx.db.get(showId)))?.ticketInfo?.saleStatus).toBe("onsale");
  await t.run(async ctx => {
    await ctx.db.patch(showId, { lastSynced: NOW + 1000, ticketInfo: { kind: "admission", saleStatus: "offsale" } });
    await ctx.db.patch(cacheId, { lastUpdated: NOW - 1000 });
  });
  await t.mutation(ref.importTrendingShows.importTrendingShowsBatch, {});
  expect((await t.run(ctx => ctx.db.get(showId)))?.ticketInfo?.saleStatus).toBe("offsale");
});

it("serializes same-artist repertoire jobs and deduplicates repeated imports", async () => {
  const { t, artistId, venueId } = await setup();
  await t.run(async ctx => {
    for (const date of ["2026-10-01", "2026-10-02"]) {
      const showId = await ctx.db.insert("shows", { artistId, venueId, date, status: "completed" });
      await ctx.db.insert("setlists", { showId, isOfficial: true, setlistfmId: date, songs: [],
        actualSetlist: [{ title: "One Song", setNumber: 1, encore: false }] });
      const show = (await ctx.db.get(showId))!;
      await queueRepertoireMerge(ctx, show);
      await queueRepertoireMerge(ctx, show);
    }
  });
  const jobs = await t.run(ctx => ctx.db.query("repertoireMergeJobs").take(3));
  expect(jobs).toHaveLength(2);
  expect(jobs.filter(j => j.scheduledId)).toHaveLength(1);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.query("repertoireMergeJobs").take(1))).toHaveLength(0);
  expect(await t.run(ctx => ctx.db.query("artistSongs").withIndex("by_artist", q => q.eq("artistId", artistId)).take(2))).toHaveLength(1);
});

it("rediscovers active artists with no future shows within the existing eight-job limit", async () => {
  const { t, artistId } = await setup();
  const result = await t.mutation(ref.touringRefresh.dispatch, {});
  expect(result.scheduled).toBe(1);
  expect((await t.run(ctx => ctx.db.get(artistId)))?.lastShowRefreshAttemptAt).toBe(NOW);
  expect((await t.mutation(ref.touringRefresh.dispatch, {})).scheduled).toBe(0);
});
