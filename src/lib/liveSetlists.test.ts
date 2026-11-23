// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
import { DMB_MBID, HOUR, MINUTE, nextLiveCheck, parsePerformances, providerRetryAt } from "../../shared/liveSetlist";
const modules = import.meta.glob("../../convex/**/*.{ts,js}");
const NOW = Date.parse("2026-11-09T00:30:00Z"), ref = internal as any;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function fixture() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  rateLimiterTest.register(t);
  const ids = await t.run(async ctx => {
    const adminId = await ctx.db.insert("users", { authId: "admin", username: "admin", role: "admin", createdAt: NOW });
    const artistId = await ctx.db.insert("artists", { slug: "dave-matthews-band", name: "Dave Matthews Band", setlistfmMbid: DMB_MBID, isActive: true });
    const venueId = await ctx.db.insert("venues", { name: "Hall", city: "Chicago", country: "US" });
    const showId = await ctx.db.insert("shows", { artistId, venueId, date: "2026-11-08", startsAt: NOW, timeZone: "America/Chicago", status: "upcoming" });
    const setlistId = await ctx.db.insert("setlists", { showId, songs: [{ title: "Warehouse" }, { title: "Crush" }, { title: "Zero votes" }], isOfficial: false });
    for (const [title, at, userId] of [["Warehouse", NOW - 1, "fan-a"], ["Warehouse", NOW - 1, "fan-a"], ["Crush", NOW + 1, "fan-b"], ["Not requested", NOW - 1, "fan-c"]] as const)
      await ctx.db.insert("songVotes", { userId, setlistId, songTitle: title, createdAt: at, voteType: "upvote" });
    return { adminId, artistId, venueId, showId, setlistId };
  });
  const admin = t.withIdentity({ subject: "admin" });
  const sessionId = await admin.mutation(api.liveSetlists.enrollShow, { showId: ids.showId });
  return { t, admin, sessionId, ...ids };
}
const result = (version = "v1") => ({ id: "source1", version, songs: [{ title: "Warehouse", setNumber: 1, encore: false, guest: "Jake Renick Simpson" }], sourceUrl: "https://www.setlist.fm/setlist/example.html", sourceUpdatedAt: NOW });

describe("DMB performance normalization and schedule", () => {
  it("preserves guest, cover, notes, order, reprises and encores; excludes tapes", () => {
    expect(parsePerformances({ sets: { set: [{ song: [{ name: "Intro", tape: true }, { name: "Warehouse", with: { name: "Jake Renick Simpson" }, info: ">" }, { name: "Sledgehammer", cover: { name: "Peter Gabriel" } }] }, { encore: 1, song: [{ name: "Warehouse" }] }] } })).toEqual([
      { title: "Warehouse", setNumber: 1, encore: false, guest: "Jake Renick Simpson", notes: ">" },
      { title: "Sledgehammer", setNumber: 1, encore: false, cover: "Peter Gabriel" },
      { title: "Warehouse", setNumber: 2, encore: true },
    ]);
    expect(() => parsePerformances({ sets: {} })).toThrow();
    expect(parsePerformances({ sets: { set: [] } })).toEqual([]);
  });
  it("bounds polling to the show window and fixed follow-ups, with adaptive idle/error delays", () => {
    expect(nextLiveCheck(NOW, NOW - HOUR, undefined)).toBe(NOW - 30 * MINUTE);
    expect(nextLiveCheck(NOW, NOW, NOW)).toBe(NOW + 3 * MINUTE);
    expect(nextLiveCheck(NOW, NOW + 16 * MINUTE, NOW)).toBe(NOW + 21 * MINUTE);
    expect(nextLiveCheck(NOW, NOW, NOW, 3)).toBe(NOW + 20 * MINUTE);
    expect(nextLiveCheck(NOW, NOW + 4 * HOUR, NOW)).toBe(NOW + 4.5 * HOUR);
    expect(nextLiveCheck(NOW, NOW + 72 * HOUR, NOW)).toBeUndefined();
    expect(providerRetryAt(NOW, "3600")).toBe(NOW + HOUR);
    expect(providerRetryAt(NOW, "garbage")).toBe(NOW + 15 * MINUTE);
  });
});

describe("bounded durable live pilot", () => {
  it("requires admin, validates artist identity, and permits only three distinct shows", async () => {
    const f = await fixture();
    await expect(f.t.mutation(api.liveSetlists.enrollShow, { showId: f.showId })).rejects.toThrow("logged in");
    expect(await f.admin.mutation(api.liveSetlists.enrollShow, { showId: f.showId })).toBe(f.sessionId);
    for (let i = 0; i < 3; i++) {
      const showId = await f.t.run(ctx => ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId, date: "2026-11-10", startsAt: NOW + HOUR, status: "upcoming" }));
      if (i < 2) await f.admin.mutation(api.liveSetlists.enrollShow, { showId });
      else await expect(f.admin.mutation(api.liveSetlists.enrollShow, { showId })).rejects.toThrow("three shows");
    }
    await f.t.run(ctx => ctx.db.patch(f.artistId, { setlistfmMbid: "someone-else" }));
    expect(await f.t.mutation(ref.liveSetlists.claim, { sessionId: f.sessionId })).toBeNull();
    expect(await f.t.query(api.liveSetlists.getState, { showId: f.showId })).toMatchObject({ phase: "paused" });
  });
  it("freezes eligible votes once, leases one worker, ignores stale and duplicate results", async () => {
    const f = await fixture();
    const claim = await f.t.mutation(ref.liveSetlists.claim, { sessionId: f.sessionId });
    expect(await f.t.mutation(ref.liveSetlists.claim, { sessionId: f.sessionId })).toBeNull();
    expect((await f.t.query(api.liveSetlists.getContent, { showId: f.showId }))?.requests).toEqual([{ songTitle: "Warehouse", upvotes: 1 }]);
    expect(await f.t.mutation(ref.liveSetlists.applyResult, { sessionId: f.sessionId, generation: claim.generation - 1, result: result() })).toBe(false);
    expect(await f.t.mutation(ref.liveSetlists.applyResult, { sessionId: f.sessionId, generation: claim.generation, result: result() })).toBe(true);
    expect(await f.t.mutation(ref.liveSetlists.applyResult, { sessionId: f.sessionId, generation: claim.generation, result: result("stale") })).toBe(false);
    const show = await f.t.run(ctx => ctx.db.get(f.showId));
    expect(show?.status).toBe("upcoming");
    expect(await f.t.run(ctx => ctx.db.query("setlists").withIndex("by_official", q => q.eq("isOfficial", true)).take(1))).toEqual([]);
    await expect(f.t.mutation(ref.setlists.createFromApi, { showId: f.showId, data: { id: "source1", sets: { set: [{ song: [{ name: "Warehouse" }] }] } } })).rejects.toThrow("completeness");
  });
  it("does not rewrite unchanged content; applies removals and empty revisions, rejecting older versions", async () => {
    const f = await fixture();
    const apply = async (value: ReturnType<typeof result>) => {
      const claim = await f.t.mutation(ref.liveSetlists.claim, { sessionId: f.sessionId });
      await f.t.mutation(ref.liveSetlists.applyResult, { sessionId: f.sessionId, generation: claim.generation, result: value });
      const state = await f.t.run(ctx => ctx.db.get(f.sessionId));
      vi.setSystemTime(state!.nextCheckAt!);
    };
    await apply(result());
    const first = await f.t.query(api.liveSetlists.getContent, { showId: f.showId });
    await apply(result());
    expect(await f.t.query(api.liveSetlists.getContent, { showId: f.showId })).toEqual(first);
    await apply({ ...result("older"), sourceUpdatedAt: NOW - 1, songs: [] });
    expect((await f.t.query(api.liveSetlists.getContent, { showId: f.showId }))?.songs).toHaveLength(1);
    await apply({ ...result("v2"), sourceUpdatedAt: NOW + 1, songs: [] });
    expect((await f.t.query(api.liveSetlists.getContent, { showId: f.showId }))?.songs).toEqual([]);
  });
  it("freezes materialized vote counts without leaking database fields into the public snapshot", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.setlistId, { voteCountsReady: true, voteCountsSchedule: `2026-11-08|${NOW}|America/Chicago` });
      await ctx.db.insert("songVoteCounts", { setlistId: f.setlistId, songKey: "warehouse", songTitle: "Warehouse", upvotes: 8 });
    });
    await f.t.mutation(ref.liveSetlists.claim, { sessionId: f.sessionId });
    expect((await f.t.query(api.liveSetlists.getContent, { showId: f.showId }))?.requests).toEqual([{ songTitle: "Warehouse", upvotes: 8 }]);
  });
  it("shares a UTC daily budget with historical imports and enforces the per-show cap", async () => {
    const f = await fixture();
    await f.admin.mutation(api.setlistProvider.setBudget, { dailyBudget: 2 });
    const claim = await f.t.mutation(ref.liveSetlists.claim, { sessionId: f.sessionId });
    expect((await f.t.mutation(ref.setlistProvider.reserve, { sessionId: f.sessionId, generation: claim.generation })).ok).toBe(true);
    expect((await f.t.mutation(ref.setlistProvider.reserve, {})).ok).toBe(false); // burst, no daily consumption
    vi.setSystemTime(NOW + 1001);
    expect((await f.t.mutation(ref.setlistProvider.reserve, {})).ok).toBe(false); // live headroom
    await f.admin.mutation(api.liveSetlists.control, { showId: f.showId, operation: "pause" });
    expect((await f.t.mutation(ref.setlistProvider.reserve, {})).ok).toBe(true);
    vi.setSystemTime(NOW + 2002);
    const denial = await f.t.mutation(ref.setlistProvider.reserve, {});
    expect(denial.ok).toBe(false);
    expect(new Date(denial.retryAt).toISOString()).toBe("2026-11-10T00:00:00.000Z");
    await f.t.run(ctx => ctx.db.patch(f.sessionId, { requestsUsed: 120 }));
    expect((await f.t.mutation(ref.setlistProvider.reserve, { sessionId: f.sessionId, generation: claim.generation })).ok).toBe(false);
    expect((await f.t.run(ctx => ctx.db.get(f.sessionId)))?.requestsUsed).toBe(120);
  });
  it("pauses shared requests after 429 and does not let manual checks bypass the cap", async () => {
    const f = await fixture();
    await f.t.mutation(ref.setlistProvider.throttled, { retryAfter: "3600" });
    expect(await f.t.mutation(ref.setlistProvider.reserve, {})).toEqual({ ok: false, retryAt: NOW + HOUR });
    await f.t.run(ctx => ctx.db.patch(f.sessionId, { requestsUsed: 120 }));
    await expect(f.admin.mutation(api.liveSetlists.control, { showId: f.showId, operation: "refresh" })).rejects.toThrow("limit");
  });
  it("requires review after the show window and guards the exact revision during finalization", async () => {
    const f = await fixture();
    const claim = await f.t.mutation(ref.liveSetlists.claim, { sessionId: f.sessionId });
    await f.t.mutation(ref.liveSetlists.applyResult, { sessionId: f.sessionId, generation: claim.generation, result: result() });
    await expect(f.admin.mutation(api.liveSetlists.confirmComplete, { showId: f.showId, version: "v1" })).rejects.toThrow("monitoring window");
    vi.setSystemTime(NOW + 4 * HOUR);
    await expect(f.admin.mutation(api.liveSetlists.confirmComplete, { showId: f.showId, version: "old" })).rejects.toThrow("source changed");
    await f.admin.mutation(api.liveSetlists.confirmComplete, { showId: f.showId, version: "v1" });
    expect((await f.t.run(ctx => ctx.db.get(f.showId)))?.status).toBe("completed");
    const official = await f.t.run(ctx => ctx.db.query("setlists").withIndex("by_official", q => q.eq("isOfficial", true)).first());
    expect(official?.actualSetlist?.[0].title).toBe("Warehouse");
    expect(official?.setlistfmData.sets.set[0].song[0].with.name).toBe("Jake Renick Simpson");
  });
  it("matches exact concert identity before saving and uses the stable ID on later polls", async () => {
    const f = await fixture(); vi.stubEnv("SETLISTFM_API_KEY", "test");
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ setlist: [{ id: "source1", versionId: "v1", lastUpdated: new Date(NOW).toISOString(), eventDate: "08-11-2026", artist: { mbid: DMB_MBID }, venue: { name: "Hall", city: { name: "Chicago" } }, sets: { set: [{ song: [{ name: "Warehouse" }] }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await f.t.action(ref.liveSetlists.poll, { sessionId: f.sessionId });
    expect((await f.t.query(api.liveSetlists.getContent, { showId: f.showId }))?.songs).toHaveLength(1);
    expect((await f.t.run(ctx => ctx.db.get(f.sessionId)))?.requestsUsed).toBe(1);
    vi.setSystemTime(NOW + 3 * MINUTE);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ id: "source1", versionId: "v2", eventDate: "09-11-2026", artist: { mbid: DMB_MBID }, venue: { name: "Hall", city: { name: "Chicago" } }, sets: { set: [] } }), { status: 200 }));
    await f.t.action(ref.liveSetlists.poll, { sessionId: f.sessionId });
    expect(fetch.mock.calls[1][0]).toContain("/setlist/source1");
    expect((await f.t.query(api.liveSetlists.getContent, { showId: f.showId }))?.songs).toHaveLength(1);
    expect((await f.t.query(api.liveSetlists.getState, { showId: f.showId }))?.delayed).toBe(true);
  });
});
