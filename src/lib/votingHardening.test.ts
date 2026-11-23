// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
import { songKey, summarizeRequests } from "../../convex/lib/predictions";
import { hasVotingClosed } from "../../convex/lib/showTiming";
const modules = import.meta.glob("../../convex/**/*.{ts,js}");
const pub = api as any, priv = internal as any;
const NOW = Date.parse("2026-09-24T12:00:00Z");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
async function fixture() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const ids = await t.run(async ctx => {
    const artistId = await ctx.db.insert("artists", { name: "Example", slug: "example", lowerName: "example", isActive: true });
    const venueId = await ctx.db.insert("venues", { name: "Hall", city: "Springfield", state: "IL", country: "US" });
    const userId = await ctx.db.insert("users", { authId: "fan", username: "fan", role: "user", createdAt: NOW });
    const showId = await ctx.db.insert("shows", { artistId, venueId, date: "2026-09-25", status: "upcoming", startsAt: NOW + 86400000 });
    const songIds = [];
    for (const title of ["Déjà Vu", "Second Song", "第三首", "Fourth Song", "Fifth Song", "Sixth Song"]) {
      const songId = await ctx.db.insert("songs", { title, isLive: false, isRemix: false });
      await ctx.db.insert("artistSongs", { artistId, songId, isPrimaryArtist: true });
      songIds.push(songId);
    }
    const songs = await Promise.all(songIds.slice(0, 3).map(async id => ({ title: (await ctx.db.get(id))!.title, songId: id })));
    const setlistId = await ctx.db.insert("setlists", { showId, songs, isOfficial: false });
    return { artistId, venueId, userId, showId, setlistId, songIds };
  });
  const fan = t.withIdentity({ subject: "fan" });
  return { t, fan, ...ids };
}
const voteArgs = (f: Awaited<ReturnType<typeof fixture>>, title = "Déjà Vu") => ({ setlistId: f.setlistId, songTitle: title, voteType: "upvote" });

describe("real fan predictions", () => {
  it("normalizes provider variants and keeps non-Latin song identity", () => {
    expect(songKey("DÉJÀ VU - 2011 Remaster")).toBe(songKey("Déjà Vu"));
    expect(songKey("Song (feat. Guest)")).toBe(songKey("Song"));
    expect(songKey("第三首")).not.toBe(songKey("第二首"));
    expect(songKey("Song (Part II)")).not.toBe(songKey("Song"));
  });
  it("requires real participation and deduplicates requests and repeated performances", () => {
    expect(summarizeRequests([], [{ title: "Déjà Vu" }])).toMatchObject({ accuracy: null, hasCommunityData: false });
    const summary = summarizeRequests([{ songTitle: "Déjà Vu", upvotes: 2 }, { songTitle: "DEJA VU", upvotes: 1 }, { songTitle: "Second", upvotes: 1 }, { songTitle: "Third", upvotes: 1 }], [{ title: "Déjà Vu" }, { title: "DEJA VU" }]);
    expect(summary).toMatchObject({ totalVotes: 5, requestedSongs: 3, matched: 1, accuracy: 33, hasCommunityData: true });
  });
  it("toggles canonical votes and all derived totals atomically", async () => {
    const f = await fixture();
    expect(await f.fan.mutation(pub.songVotes.voteOnSong, voteArgs(f, "DEJA VU"))).toEqual({ action: "added" });
    expect(await f.fan.query(pub.songVotes.getSetlistSongVotes, { setlistId: f.setlistId })).toEqual([{ songTitle: "Déjà Vu", upvotes: 1, userVoted: true }]);
    expect(await f.fan.mutation(pub.songVotes.voteOnSong, voteArgs(f))).toEqual({ action: "removed" });
    expect(await f.t.run(ctx => ctx.db.query("songVotes").collect())).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.query("showSongDemand").collect())).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.get(f.setlistId))).toMatchObject({ songVoteCount: 0, voteCountsReady: true });
  });
  it("rejects nonexistent songs and anonymous IDs that impersonate user IDs", async () => {
    const f = await fixture();
    await expect(f.fan.mutation(pub.songVotes.voteOnSong, voteArgs(f, "Invented"))).rejects.toThrow("not in this setlist");
    await expect(f.t.mutation(pub.songVotes.voteOnSong, { ...voteArgs(f), anonId: f.userId })).rejects.toThrow("Anonymous ID");
  });
  it("enforces the anonymous budget and releases a slot on removal", async () => {
    const f = await fixture(), anonId = "anon_fixture_12345";
    for (const title of ["Déjà Vu", "Second Song"]) await f.t.mutation(pub.songVotes.voteOnSong, { ...voteArgs(f, title), anonId });
    await expect(f.t.mutation(pub.songVotes.voteOnSong, { ...voteArgs(f, "第三首"), anonId })).rejects.toThrow("only vote on 2");
    await f.t.mutation(pub.songVotes.voteOnSong, { ...voteArgs(f), anonId });
    await f.t.mutation(pub.songVotes.voteOnSong, { ...voteArgs(f, "第三首"), anonId });
    expect(await f.t.run(ctx => ctx.db.query("songVotes").collect())).toHaveLength(2);
  });
  it.each(["started", "completed", "cancelled", "official"])("blocks additions and removals on %s shows", async kind => {
    const f = await fixture();
    await f.fan.mutation(pub.songVotes.voteOnSong, voteArgs(f));
    await f.t.run(async ctx => {
      if (kind === "started") await ctx.db.patch(f.showId, { startsAt: NOW - 1 });
      else if (kind === "official") await ctx.db.patch(f.setlistId, { isOfficial: true });
      else await ctx.db.patch(f.showId, { status: kind as "completed" | "cancelled" });
    });
    await expect(f.fan.mutation(pub.songVotes.voteOnSong, voteArgs(f))).rejects.toThrow("closed");
    await expect(f.fan.mutation(pub.songVotes.voteOnSong, voteArgs(f, "Second Song"))).rejects.toThrow("closed");
    expect(await f.t.run(ctx => ctx.db.query("songVotes").collect())).toHaveLength(1);
  });
  it("enforces catalog ownership and prevents public official-setlist creation", async () => {
    const f = await fixture();
    await expect(f.fan.mutation(pub.setlists.create, { showId: f.showId, songs: [], isOfficial: true })).rejects.toThrow("Official");
    await expect(f.t.mutation(pub.setlists.create, { showId: f.showId, songs: [] })).rejects.toThrow("Sign in");
    await expect(f.fan.mutation(pub.setlists.addSongToSetlist, { showId: f.showId, song: { title: "Invented", songId: f.songIds[0] } })).rejects.toThrow("catalog");
    const song = { title: "Fourth Song", songId: f.songIds[3] };
    await f.fan.mutation(pub.setlists.addSongToSetlist, { showId: f.showId, song });
    await f.t.run(ctx => ctx.db.patch(f.showId, { status: "completed" }));
    await expect(f.fan.mutation(pub.setlists.addSongToSetlist, { showId: f.showId, song })).rejects.toThrow("closed");
  });
  it("returns unavailable before comparison and a genuine zero for a missed prediction", async () => {
    const f = await fixture();
    await f.fan.mutation(pub.songVotes.voteOnSong, voteArgs(f));
    expect(await f.fan.query(pub.activity.getVoteAccuracy, { userId: f.userId })).toBeNull();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.showId, { status: "completed" });
      await ctx.db.insert("setlists", { showId: f.showId, songs: [], isOfficial: true, actualSetlist: [{ title: "Second Song", setNumber: 1, encore: false }] });
    });
    expect(await f.fan.query(pub.activity.getVoteAccuracy, { userId: f.userId })).toBe(0);
    expect(await f.fan.query(pub.activity.getUserActivityStats, {})).toMatchObject({ accuracy: 0, evaluatedVotes: 1 });
    expect(await f.t.query(pub.activity.getVoteAccuracy, { userId: f.userId })).toBeNull();
  });
  it("excludes late/invalid legacy votes and never counts seeded suggestions as fan accuracy", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.insert("songVotes", { ...voteArgs(f), voteType: "upvote", userId: f.userId, createdAt: NOW + 86400001 });
      await ctx.db.insert("songVotes", { ...voteArgs(f, "Invented"), voteType: "upvote", userId: f.userId, createdAt: NOW });
      await ctx.db.patch(f.showId, { status: "completed" });
    });
    await f.t.mutation(priv.setlists.createFromApi, { showId: f.showId, data: { id: "actual", sets: { set: [{ song: [{ name: "Déjà Vu" }] }] } } });
    expect(await f.t.run(ctx => ctx.db.get(f.setlistId))).not.toHaveProperty("accuracy");
    expect(await f.t.query(pub.songVotes.getSetlistSongVotes, { setlistId: f.setlistId })).toEqual([]);
    expect(await f.t.query(pub.setlists.getSetlistWithVotes, { showId: f.showId })).toMatchObject({ actualSetlist: [{ title: "Déjà Vu", wasPredicted: false, voteCount: 0 }] });
  });
  it("backfills legacy totals idempotently and trends only voted setlists", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 2100; i++) await ctx.db.insert("setlists", { showId: f.showId, songs: [], isOfficial: false });
      await ctx.db.insert("songVotes", { ...voteArgs(f), userId: f.userId, voteType: "upvote", createdAt: NOW });
    });
    await f.t.mutation(priv.songVotes.backfillVoteCounts, {});
    await f.t.mutation(priv.songVotes.backfillVoteCounts, {});
    const trending = await f.t.query(pub.activity.getTrendingSetlists, { limit: 20 });
    expect(trending).toHaveLength(1);
    expect(trending[0]).toMatchObject({ _id: f.setlistId, voteCount: 1 });
  });
  it("invalidates cached vote eligibility when a show is rescheduled", async () => {
    const f = await fixture();
    await f.fan.mutation(pub.songVotes.voteOnSong, voteArgs(f));
    await f.t.run(ctx => ctx.db.patch(f.showId, { startsAt: NOW - 1 }));
    expect(await f.t.query(pub.songVotes.getSetlistSongVotes, { setlistId: f.setlistId })).toEqual([]);
    await f.t.mutation(priv.songVotes.backfillVoteCounts, {});
    expect(await f.t.run(ctx => ctx.db.get(f.setlistId))).toMatchObject({ songVoteCount: 0 });
  });
  it("repairs historical cached accuracy across pages without altering songs or raw votes", async () => {
    const f = await fixture();
    await f.fan.mutation(pub.songVotes.voteOnSong, voteArgs(f));
    await f.t.run(async ctx => {
      await ctx.db.patch(f.setlistId, { actualSetlist: [{ title: "Déjà Vu", setNumber: 1, encore: false }], accuracy: 0 });
      for (let i = 0; i < 220; i++) await ctx.db.insert("setlists", { showId: f.showId, songs: [{ title: "Second Song" }], isOfficial: false, actualSetlist: [{ title: "Second Song", setNumber: 1, encore: false }], accuracy: 100 });
    });
    await f.t.mutation(priv.songVotes.repairPredictionAccuracy, {});
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const lists = await f.t.run(ctx => ctx.db.query("setlists").collect());
    expect(lists.filter(list => list.accuracy !== undefined)).toHaveLength(1);
    expect(lists.find(list => list._id === f.setlistId)).toMatchObject({ accuracy: 100, songs: expect.arrayContaining([{ title: "Déjà Vu", songId: f.songIds[0] }]) });
    expect(await f.t.run(ctx => ctx.db.query("songVotes").collect())).toHaveLength(1);
  });
  it("calculates actual accuracy from voted songs, independent of seeded suggestions", async () => {
    const f = await fixture();
    await f.fan.mutation(pub.songVotes.voteOnSong, voteArgs(f));
    await f.t.mutation(priv.setlists.createFromApi, { showId: f.showId, data: { id: "actual-voted", sets: { set: [{ song: [{ name: "DEJA VU" }, { name: "Fourth Song" }] }] } } });
    expect(await f.t.run(ctx => ctx.db.get(f.setlistId))).toMatchObject({ accuracy: 100 });
    expect(await f.fan.query(pub.activity.getUserActivityStats, {})).toMatchObject({ accuracy: 100, evaluatedVotes: 1 });
  });
  it("closes TBA shows on their local date and precise shows at the provider start", () => {
    expect(hasVotingClosed({ date: "2026-09-25", timeZone: "Pacific/Auckland" }, Date.parse("2026-09-24T14:00:00Z"))).toBe(true);
    expect(hasVotingClosed({ date: "2026-09-25", startsAt: NOW + 1 }, NOW)).toBe(false);
    expect(hasVotingClosed({ date: "2026-09-25", startsAt: NOW }, NOW)).toBe(true);
  });
});

describe("import integrity and transaction isolation", () => {
  it("coalesces global trending refresh requests and respects disabled jobs", async () => {
    const f = await fixture();
    const id = await f.t.run(ctx => ctx.db.insert("cronSettings", { name: "update-show-trending", enabled: true, intervalMs: 3600000 }));
    expect(await f.t.mutation(priv.trending.requestShowTrendingRefresh, {})).toBe(true);
    expect(await f.t.mutation(priv.trending.requestShowTrendingRefresh, {})).toBe(false);
    await f.t.run(ctx => ctx.db.patch(id, { enabled: false, lastRunAt: NOW + 1 }));
    expect(await f.t.mutation(priv.trending.requestShowTrendingRefresh, {})).toBe(false);
  });
  it("keeps co-headliners independent and repeated imports idempotent", async () => {
    const f = await fixture();
    const secondArtist = await f.t.run(ctx => ctx.db.insert("artists", { name: "Guest", slug: "guest", isActive: true }));
    const args = { venueId: f.venueId, ticketmasterId: "shared-event", date: "2026-09-25", status: "upcoming", startsAt: NOW + 86400000 };
    const first = await f.t.mutation(priv.shows.createFromTicketmaster, { ...args, artistId: f.artistId });
    const second = await f.t.mutation(priv.shows.createFromTicketmaster, { ...args, artistId: secondArtist });
    expect(first).not.toBe(second);
    expect(await f.t.mutation(priv.shows.createFromTicketmaster, { ...args, artistId: f.artistId })).toEqual(first);
    expect(await f.t.run(ctx => ctx.db.get(first))).toMatchObject({ artistId: f.artistId });
  });
  it("never replaces fans' existing song selections during seeding", async () => {
    const f = await fixture();
    const before = await f.t.run(ctx => ctx.db.get(f.setlistId));
    await f.t.mutation(priv.setlists.autoGenerateSetlist, { artistId: f.artistId, showId: f.showId });
    expect(await f.t.run(ctx => ctx.db.get(f.setlistId))).toEqual(before);
  });
  it("schedules prediction seeding in pages, outside show-import transactions", async () => {
    const f = await fixture();
    await f.t.run(async ctx => { for (let i = 0; i < 30; i++) await ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId, date: "2026-09-25", status: "upcoming" }); });
    expect(await f.t.mutation(priv.setlists.ensurePredictionsForArtistShows, { artistId: f.artistId })).toEqual({ showsChecked: 25, scheduled: 25, done: false });
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.filter(job => job.name.includes("autoGenerateSetlist"))).toHaveLength(25);
    expect(jobs.filter(job => job.name.includes("ensurePredictionsForArtistShows"))).toHaveLength(1);
  });
  it("preserves recordings linked to another artist when removing a catalog", async () => {
    const f = await fixture();
    const other = await f.t.run(ctx => ctx.db.insert("artists", { name: "Guest", slug: "guest", isActive: true }));
    await f.t.run(ctx => ctx.db.insert("artistSongs", { artistId: other, songId: f.songIds[0], isPrimaryArtist: false }));
    await f.t.mutation(priv.songs.deleteByArtist, { artistId: f.artistId });
    expect(await f.t.run(ctx => ctx.db.get(f.songIds[0]))).not.toBeNull();
    expect(await f.t.run(ctx => ctx.db.get(f.songIds[1]))).toBeNull();
  });
  it("does not merge identical venue names in different regions", async () => {
    const f = await fixture();
    const imported = await f.t.mutation(priv.venues.createFromTicketmaster, { name: "Hall", city: "Springfield", state: "MA", country: "US", ticketmasterId: "venue-new" });
    expect(imported).not.toBe(f.venueId);
  });
  it("does not overwrite a same-name artist with a different provider identity", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.artistId, { ticketmasterId: "first-artist" }));
    const imported = await f.t.mutation(priv.artists.createFromTicketmaster, { name: "Example", ticketmasterId: "second-artist", genres: ["Rock"] });
    expect(imported).not.toBe(f.artistId);
    expect(await f.t.run(ctx => ctx.db.get(f.artistId))).toMatchObject({ ticketmasterId: "first-artist" });
  });
  it("recognizes a second encore and excludes taped intros", async () => {
    const f = await fixture();
    await f.t.mutation(priv.setlists.createFromApi, { showId: f.showId, data: { id: "encores", sets: { set: [{ song: [{ name: "Intro", tape: true }, { name: "Déjà Vu" }] }, { encore: 2, song: [{ name: "Second Song" }] }] } } });
    const lists = await f.t.run(ctx => ctx.db.query("setlists").collect());
    expect(lists.find(list => list.isOfficial)?.actualSetlist).toEqual([{ title: "Déjà Vu", setNumber: 1, encore: false }, { title: "Second Song", setNumber: 2, encore: true }]);
  });
});
