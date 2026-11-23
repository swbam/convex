// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
const modules = import.meta.glob("../../convex/**/*.{ts,js}");
const pub = api as any, priv = internal as any;
const NOW = Date.parse("2026-09-24T12:00:00Z");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
async function fixture() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const data = await t.run(async ctx => {
    const artistId = await ctx.db.insert("artists", { name: "Artist", slug: "artist", isActive: true });
    const venueId = await ctx.db.insert("venues", { name: "Hall", city: "Chicago", country: "US" });
    const shows = [];
    // Deliberately import out of concert-date order.
    for (const date of ["2026-09-20", "2026-08-01", "2026-09-23"]) {
      const showId = await ctx.db.insert("shows", { artistId, venueId, date, status: "completed", slug: `artist-${date}` });
      await ctx.db.insert("setlists", { showId, isOfficial: true, songs: [], actualSetlist: [
        { title: "Déjà Vu", setNumber: 1, encore: false }, { title: "DEJA VU", setNumber: 2, encore: true },
        { title: "Deeper Well", setNumber: 1, encore: false },
      ] });
      shows.push(showId);
    }
    const upcoming = await ctx.db.insert("shows", { artistId, venueId, date: "2026-11-01", status: "upcoming" });
    await ctx.db.insert("setlists", { showId: upcoming, isOfficial: false, songs: [{ title: "Déjà Vu" }, { title: "Unplayed Song" }] });
    return { artistId, venueId, shows, upcoming };
  });
  return { t, ...data };
}

describe("song performance search", () => {
  it("finds local artists beyond the first 100 records and preserves distinct namesakes", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 120; i++) await ctx.db.insert("artists", { name: `Placeholder ${i}`, slug: `placeholder-${i}`, isActive: true });
      await ctx.db.insert("artists", { name: "The Satellites", slug: "satellites-one", isActive: true, ticketmasterId: "one" });
      await ctx.db.insert("artists", { name: "The Satellites", slug: "satellites-two", isActive: true, ticketmasterId: "two" });
      await ctx.db.insert("artists", { name: "The Satellites", slug: "satellites-inactive", isActive: false });
    });
    const matches = await f.t.query(pub.artists.search, { query: "Satellites" });
    expect(matches).toHaveLength(2);
    expect(new Set(matches.map((artist: any) => artist.ticketmasterId))).toEqual(new Set(["one", "two"]));
  });
  it("returns real performances newest first, independent of import order, spelling or repeated encores", async () => {
    const f = await fixture();
    await f.t.mutation(priv.songSearch.backfill, {});
    const result = await f.t.query(pub.songSearch.search, { query: "DEJA VU" });
    expect(result.results.map((row: any) => row.date)).toEqual(["2026-09-23", "2026-09-20", "2026-08-01"]);
    expect(result.results[0]).toMatchObject({ showId: f.shows[2], artistName: "Artist", venueName: "Hall", slug: "artist-2026-09-23" });
    expect(await f.t.query(pub.songSearch.search, { query: "Unplayed Song" })).toEqual({ results: [], refineQuery: false });
  });
  it("finds partial titles and excludes cancelled shows", async () => {
    const f = await fixture();
    await f.t.mutation(priv.songSearch.backfill, {});
    await f.t.run(ctx => ctx.db.patch(f.shows[2], { status: "cancelled" }));
    const result = await f.t.query(pub.songSearch.search, { query: "deeper" });
    expect(result.results).toHaveLength(2);
    expect(result.results[0].date).toBe("2026-09-20");
    expect(await f.t.query(pub.songSearch.search, { query: "d" })).toEqual({ results: [], refineQuery: false });
  });
  it("updates corrected setlists and concert dates idempotently", async () => {
    const f = await fixture();
    await f.t.mutation(priv.songSearch.backfill, {});
    await f.t.run(async ctx => {
      const list = await ctx.db.query("setlists").withIndex("by_show", q => q.eq("showId", f.shows[0])).first();
      await ctx.db.patch(list!._id, { actualSetlist: [{ title: "New Song", setNumber: 1, encore: false }] });
      await ctx.db.patch(f.shows[0], { date: "2026-09-24" });
    });
    await f.t.mutation(priv.songSearch.indexShow, { showId: f.shows[0] });
    await f.t.mutation(priv.songSearch.indexShow, { showId: f.shows[0] });
    expect((await f.t.query(pub.songSearch.search, { query: "Deja Vu" })).results).toHaveLength(2);
    expect((await f.t.query(pub.songSearch.search, { query: "New Song" })).results).toHaveLength(1);
    expect((await f.t.query(pub.songSearch.search, { query: "New Song" })).results[0].date).toBe("2026-09-24");
  });
  it("indexes new official imports automatically without polluting the import transaction", async () => {
    const f = await fixture();
    await f.t.mutation(priv.setlists.createFromApi, { showId: f.upcoming, data: { id: "official-new", sets: { set: [{ song: [{ name: "New Performance" }] }] } } });
    // Use a past concert date before letting scheduled indexing run.
    await f.t.run(ctx => ctx.db.patch(f.upcoming, { date: "2026-09-24" }));
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect((await f.t.query(pub.songSearch.search, { query: "New Performance" })).results).toHaveLength(1);
  });
});
