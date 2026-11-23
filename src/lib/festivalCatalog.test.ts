// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
import { matchesFestivalEvent } from "../../convex/lib/festivalIdentity";
import { hasVotingClosed } from "../../convex/lib/showTiming";
const modules = import.meta.glob("../../convex/**/*.{ts,js}");
const pub = api as any, priv = internal as any;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function fixture() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const ids = await t.run(async ctx => {
    const artistId = await ctx.db.insert("artists", { name: "Example", slug: "example", isActive: true });
    const venueId = await ctx.db.insert("venues", { name: "Park", city: "Austin", state: "TX", country: "US" });
    const festivalId = await ctx.db.insert("festivals", { name: "Example Festival", slug: "example-festival", year: 2026, startDate: "2026-10-02", endDate: "2026-10-04", status: "lineup", location: "Austin, TX", venueId });
    return { artistId, venueId, festivalId };
  });
  return { t, ...ids };
}

describe("festival edition integrity", () => {
  it.each(["batch", "maintenance"])("preserves provider timing through the trending cache and %s importer", async importer => {
    const f = await fixture();
    const startsAt = Date.now() + 3 * 86400000;
    const timing = { startsAt, endsAt: startsAt + 7200000, timeZone: "America/Chicago" };
    await f.t.mutation(priv.trending.replaceTrendingShowsCache, { fetchedAt: Date.now(), shows: [{
      ticketmasterId: "timed-event", artistTicketmasterId: "timed-artist", artistName: "Example",
      venueName: "Park", venueCity: "Austin", venueState: "TX", venueCountry: "US",
      date: new Date(startsAt).toISOString().slice(0, 10), startTime: "14:00", status: "upcoming", rank: 1, ...timing,
    }] });
    await f.t.mutation(importer === "batch" ? priv.importTrendingShows.importTrendingShowsBatch : priv.maintenance.importTrendingShows, { limit: 1 });
    const show = await f.t.run(ctx => ctx.db.query("shows").withIndex("by_ticketmaster_id", q => q.eq("ticketmasterId", "timed-event")).first());
    expect(show).toMatchObject(timing);
    expect(hasVotingClosed(show!, startsAt - 1)).toBe(false);
    expect(hasVotingClosed(show!, startsAt)).toBe(true);
  });
  it("festival search uses provider dates and returns the stored canonical slug", async () => {
    const f = await fixture();
    vi.stubEnv("TICKETMASTER_API_KEY", "test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ _embedded: { events: [{ id: "event", dates: { start: { localDate: "2026-10-03" } }, _embedded: { venues: [{ name: "Park", city: { name: "Austin" }, state: { stateCode: "TX" } }] } }] } }) }));
    expect(await f.t.action(priv.ticketmaster.triggerFullArtistSyncInternal, { ticketmasterId: "attraction", artistName: "Example Festival" })).toMatchObject({ type: "festival", festivalId: f.festivalId, slug: "example-festival" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await expect(f.t.action(priv.ticketmaster.triggerFullArtistSyncInternal, { ticketmasterId: "missing", artistName: "Unknown Festival" })).rejects.toThrow("No dated festival edition");
  });

  it("requires the festival name, local date, and city instead of loose keywords", () => {
    const festival = { name: "Example Festival", location: "Austin, TX", startDate: "2026-10-02", endDate: "2026-10-04" };
    const event = { name: "Example Festival 2026 - Day 2", dates: { start: { localDate: "2026-10-03" } }, _embedded: { venues: [{ city: { name: "Austin" }, state: { stateCode: "TX" } }] } };
    expect(matchesFestivalEvent(festival, event)).toBe(true);
    expect(matchesFestivalEvent(festival, { ...event, name: "Other Festival" })).toBe(false);
    expect(matchesFestivalEvent(festival, { ...event, dates: { start: { localDate: "2027-10-03" } } })).toBe(false);
    expect(matchesFestivalEvent({ ...festival, location: "Houston, TX" }, event)).toBe(false);
  });
  it("never merges another year, city, or distant tour stop", async () => {
    const f = await fixture();
    const args = { eventName: "Example Festival", eventDate: "2026-10-03", venueName: "Park", venueCity: "Austin", venueState: "TX" };
    const existing = await f.t.mutation(priv.festivals.upsertFestivalFromEvent, args);
    expect(existing).toBe(f.festivalId);
    for (const override of [{ eventDate: "2027-10-03" }, { venueCity: "Houston" }, { eventDate: "2026-12-03" }, { venueName: "Other Park" }]) {
      expect(await f.t.mutation(priv.festivals.upsertFestivalFromEvent, { ...args, ...override })).not.toBe(existing);
    }
  });
  it("counts unique artists, derives real days, and excludes unrelated legacy links", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (const date of ["2026-10-02", "2026-10-03", "2027-10-02"]) await ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId, festivalId: f.festivalId, date, status: "upcoming", ticketmasterId: date });
    });
    const schedule = await f.t.query(pub.festivals.getSchedule, { festivalSlug: "example-festival" });
    expect(schedule.totalArtists).toBe(1);
    expect(schedule.days.map((d: any) => d.dayNumber)).toEqual([1, 2]);
  });
  it("rejects public lineup writes and keeps unknown schedule separate", async () => {
    const f = await fixture();
    await expect(f.t.mutation(pub.festivals.addArtist, { artistId: f.artistId, festivalId: f.festivalId })).rejects.toThrow("logged in");
    // Use persisted legacy roster data to avoid a scheduler in this query test.
    await f.t.run(ctx => ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId, festivalId: f.festivalId, date: "2026-10-02", dayNumber: 1, status: "upcoming" }));
    const schedule = await f.t.query(pub.festivals.getSchedule, { festivalSlug: "example-festival" });
    expect(schedule.days[0].dayNumber).toBe(0);
    expect(schedule.days[0].shows[0].stageName).toBeUndefined();
  });
  it("rejects duplicate active imports and marks empty source results failed", async () => {
    const f = await fixture();
    const args = { festivalId: f.festivalId, totalItems: 3, source: "ticketmaster" };
    await f.t.mutation(priv.festivalLineupImport.createFestivalLineupImportJobInternal, args);
    await expect(f.t.mutation(priv.festivalLineupImport.createFestivalLineupImportJobInternal, args)).rejects.toThrow("already running");
    const other = await fixture();
    const id = await other.t.mutation(priv.festivalLineupImport.createFestivalLineupImportJobInternal, { ...args, festivalId: other.festivalId, totalItems: 0 });
    expect(await other.t.run(ctx => ctx.db.get(id))).toMatchObject({ status: "failed" });
  });
});

describe("provider-independent request repertoire", () => {
  it("supplements only official imports, deduplicates, excludes medleys, and preserves requests", async () => {
    const f = await fixture();
    const ids = await f.t.run(async ctx => {
      const showId = await ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId, date: "2026-09-01", status: "completed" });
      const songId = await ctx.db.insert("songs", { title: "Existing", spotifyId: "spotify", isLive: false, isRemix: false });
      await ctx.db.insert("artistSongs", { artistId: f.artistId, songId, isPrimaryArtist: true });
      const predictionId = await ctx.db.insert("setlists", { showId, isOfficial: false, songs: [{ title: "Existing", songId }], songVoteCount: 3 });
      await ctx.db.insert("setlists", { showId, isOfficial: true, songs: [], setlistfmId: "provider", actualSetlist: ["Existing", "Missing Hit", "MISSING HIT", "Song A / Song B"].map(title => ({ title, setNumber: 1, encore: false })) });
      return { showId, predictionId };
    });
    expect(await f.t.mutation(priv.catalogRepertoire.mergeFromShow, { showId: ids.showId })).toBe(1);
    expect(await f.t.mutation(priv.catalogRepertoire.mergeFromShow, { showId: ids.showId })).toBe(0);
    const songs = await f.t.query(pub.songs.getByArtist, { artistId: f.artistId });
    expect(songs).toHaveLength(2);
    expect(songs.find((s: any) => s.title === "Missing Hit")).toMatchObject({ repertoireSource: "setlistfm", album: "Performed live · setlist.fm" });
    expect(await f.t.run(ctx => ctx.db.get(ids.predictionId))).toMatchObject({ songVoteCount: 3, songs: [{ title: "Existing" }] });
    const unverified = await f.t.run(async ctx => {
      const id = await ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId, date: "2026-09-02", status: "completed" });
      await ctx.db.insert("setlists", { showId: id, isOfficial: false, songs: [], actualSetlist: [{ title: "Invented", setNumber: 1, encore: false }] });
      return id;
    });
    expect(await f.t.mutation(priv.catalogRepertoire.mergeFromShow, { showId: unverified })).toBe(0);
  });
});
