// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
import { isFestivalEvent } from "../../convex/lib/festivalIdentity";
import { selectFestivalImages, festivalView } from "../../convex/lib/festivalMedia";
import { findFestivalImages } from "../../convex/festivalMediaSync";
import { formatFestivalDates } from "./festivalDates";
const modules = import.meta.glob("../../convex/**/*.{ts,js}");
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const image = (width: number, fallback = false) => ({ url: `https://s1.ticketm.net/${width}.jpg`, width, height: Math.round(width*9/16), fallback });
async function fixture() {
  const t = convexTest({ schema, modules });
  const id = await t.run(async ctx => {
    await ctx.db.insert("users", { authId: "admin", role: "admin", username: "admin", createdAt: 1 });
    return ctx.db.insert("festivals", { name: "Example Festival", slug: "example", location: "Austin, TX", year: 2026, startDate: "2026-06-06", endDate: "2026-06-07", status: "announced", discoveryState: "listed", ticketUrl: "https://tickets.example/2026" });
  });
  return { t, id, admin: t.withIdentity({ subject: "admin" }) };
}
describe("festival discovery and artwork", () => {
  it("never treats every concert at a festival-named venue as a festival", () => {
    expect(isFestivalEvent({ name: "Yacht Rock Revue", _embedded: { venues: [{ name: "Austin City Limits Live" }] } })).toBe(false);
    expect(isFestivalEvent({ name: "Official 2026 ACL Fest Nights: Parcels" })).toBe(false);
    expect(isFestivalEvent({ name: "Food Festival", classifications: [{ segment: { name: "Miscellaneous" } }] })).toBe(false);
    expect(isFestivalEvent({ name: "Shaky Knees Presents: Jimmy Eat World" })).toBe(false);
    expect(isFestivalEvent({ name: "Riot Fest Late Night: Thrice" })).toBe(false);
    expect(isFestivalEvent({ name: "United We Dance: Festival Energy. All Night" })).toBe(false);
    expect(isFestivalEvent({ name: "Railbird Festival" })).toBe(true);
    expect(isFestivalEvent({ name: "EDC Orlando" })).toBe(true);
  });
  it("selects responsive artwork while rejecting generic fallback and unsafe URLs", () => {
    expect(selectFestivalImages([image(2048, true), image(640), image(1200)])).toMatchObject({ imageUrl: image(1200).url, imageCardUrl: image(640).url });
    expect(selectFestivalImages([image(2048, true)])).toBeUndefined();
    expect(selectFestivalImages([{ ...image(1200), url: "javascript:alert(1)" }])).toBeUndefined();
  });
  it("uses a matching event response without a second API request", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test");
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: "Example Festival", dates: { start: { localDate: "2026-06-06" } }, _embedded: { venues: [{ city: { name: "Austin" }, state: { stateCode: "TX" } }] }, images: [image(1200)] }) });
    vi.stubGlobal("fetch", fetcher);
    expect(await findFestivalImages({ ticketmasterId: "event", name: "Example Festival", location: "Austin, TX", startDate: "2026-06-06", endDate: "2026-06-07" })).toMatchObject({ imageUrl: image(1200).url });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not reuse wrong-year event art or an arbitrary attraction result", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ name: "Example Festival", dates: { start: { localDate: "2027-06-06" } }, images: [image(1200)] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ _embedded: { attractions: [{ name: "Unrelated Band", images: [image(1200)] }] } }) }));
    expect(await findFestivalImages({ ticketmasterId: "old", name: "Example Festival", location: "Austin, TX", startDate: "2026-06-06", endDate: "2026-06-07" })).toBeUndefined();
  });
  it("preserves manual artwork and ticket URLs during provider enrichment", async () => {
    const { t, id, admin } = await fixture();
    await expect(t.mutation(api.festivalMediaSync.setOverride, { festivalId: id, imageUrl: image(1200).url })).rejects.toThrow();
    await expect(admin.mutation(api.festivalMediaSync.setOverride, { festivalId: id, imageUrl: "http://insecure.example/image.jpg" })).rejects.toThrow();
    await admin.mutation(api.festivalMediaSync.setOverride, { festivalId: id, imageUrl: "https://official.example/art.jpg" });
    await t.mutation(internal.festivalMediaSync.record, { festivalId: id, imageUrl: image(1200).url, imageCardUrl: image(640).url });
    expect(await t.query(api.festivals.getBySlug, { slug: "example" })).toMatchObject({ imageUrl: "https://official.example/art.jpg", ticketUrl: "https://tickets.example/2026" });
    await admin.mutation(api.festivalMediaSync.setOverride, { festivalId: id, imageUrl: "" });
    expect(await t.query(api.festivals.getBySlug, { slug: "example" })).toMatchObject({ imageUrl: image(1200).url });
  });
  it("filters before pagination and includes other years and ongoing editions", async () => {
    const { t } = await fixture();
    const today = new Date().toISOString().slice(0,10);
    await t.run(async ctx => {
      for (let i=0; i<60; i++) await ctx.db.insert("festivals", { name: "Old Festival", slug: `old-${i}`, year: 2020, startDate: "2020-01-01", endDate: "2020-01-01", location: "Austin, TX", status: "completed", discoveryState: "listed" });
      for (const [slug, state, end] of [["future", "listed", "2029-01-02"], ["ongoing", "listed", today], ["review", "review", "2028-01-01"]] as const) await ctx.db.insert("festivals", { name: "Example Festival", slug, year: 2029, startDate: today, endDate: end, location: "Austin, TX", status: "announced", discoveryState: state });
    });
    const page = await t.query(api.festivals.browse, { period: "upcoming", paginationOpts: { numItems: 1, cursor: null } });
    expect(page.page.map(f => f.slug)).toEqual(["ongoing"]);
    const next = await t.query(api.festivals.browse, { period: "upcoming", paginationOpts: { numItems: 10, cursor: page.continueCursor } });
    expect(next.page.map(f => f.slug)).toEqual(["future"]);
    const past = await t.query(api.festivals.browse, { period: "past", paginationOpts: { numItems: 2, cursor: null } });
    expect(past.page[0].slug).toBe("example");
    expect(past.page.every(f => f.status === "completed")).toBe(true);
  });
  it("retains suspicious legacy records while excluding them from discovery", async () => {
    const { t } = await fixture();
    const id = await t.run(ctx => ctx.db.insert("festivals", { name: "Yacht Rock Revue", slug: "yacht", year: 2026, startDate: "2026-02-27", endDate: "2026-03-01", location: "Austin, TX", status: "completed" }));
    await t.mutation(internal.festivalMediaSync.classifyLegacy, {});
    expect(await t.run(ctx => ctx.db.get(id))).toMatchObject({ discoveryState: "review", name: "Yacht Rock Revue" });
  });
  it("persists artwork on normal event imports and refuses non-festivals", async () => {
    const { t } = await fixture();
    const args = { eventName: "New Festival", eventDate: "2026-10-01", venueCity: "Austin", venueState: "TX", ...selectFestivalImages([image(1200)]) };
    const id = await t.mutation(internal.festivals.upsertFestivalFromEvent, args);
    expect(await t.run(ctx => ctx.db.get(id!))).toMatchObject({ imageUrl: image(1200).url, discoveryState: "listed" });
    expect(await t.mutation(internal.festivals.upsertFestivalFromEvent, { ...args, eventName: "Random Solo Tour" })).toBeNull();
  });
  it("formats one-day events without duplicated dates and derives completion", () => {
    expect(formatFestivalDates("2026-04-08", "2026-04-08")).toBe("Apr 8, 2026");
    expect(festivalView({ startDate: "2020-01-01", endDate: "2020-01-01", status: "announced" }).status).toBe("completed");
  });
});
describe("source lineup coverage", () => {
  it("displays unmatched source artists without manufacturing performance records", async () => {
    const { t, id } = await fixture();
    await t.mutation(internal.festivalRoster.storeInternal, { festivalId: id, year: 2026, source: "wiki", sourceUrl: "https://en.wikipedia.org/wiki/Example", entries: [{ name: "Known by source only", dayNumber: 2 }, { name: "Another artist" }] });
    const schedule = await t.query(api.festivals.getSchedule, { festivalSlug: "example" });
    expect(schedule!.totalArtists).toBe(2);
    expect(schedule!.days.flatMap((d: any) => d.shows).map((s: any) => s.artist.name).sort()).toEqual(["Another artist", "Known by source only"]);
    expect(await t.run(ctx => ctx.db.query("shows").collect())).toHaveLength(0);
  });
  it("guards editions, dates, permissions and preserves verified rosters", async () => {
    const { t, id } = await fixture();
    const args = { festivalId: id, year: 2026, source: "official", sourceUrl: "https://official.example/2026", entries: [{ name: "First" }, { name: "Second" }], verified: true };
    await expect(t.mutation(api.festivalRoster.save, args)).rejects.toThrow();
    await expect(t.mutation(internal.festivalRoster.storeInternal, { ...args, year: 2027 })).rejects.toThrow("edition");
    await expect(t.mutation(internal.festivalRoster.storeInternal, { ...args, entries: [{ name: "First", dayNumber: 5 }] })).rejects.toThrow("outside");
    await t.mutation(internal.festivalRoster.storeInternal, args);
    await t.mutation(internal.festivalRoster.storeInternal, { ...args, verified: false, source: "ticketmaster", entries: [{ name: "First" }] });
    expect((await t.query(api.festivals.getSchedule, { festivalSlug: "example" }))!.totalArtists).toBe(2);
  });
});

describe("roster repair durability", () => {
  it("reconciles source-only artists and corrects counts after verified replacement", async () => {
    const { t, id } = await fixture();
    const args = { festivalId: id, year: 2026, source: "official", sourceUrl: "https://official.example/2026", verified: true };
    await t.mutation(internal.festivalRoster.storeInternal, { ...args, entries: [{ name: "First" }, { name: "Second" }] });
    await t.mutation(internal.festivals.reconcileEditionCounts, {});
    expect((await t.run(ctx => ctx.db.get(id)))?.artistCount).toBe(2);
    await t.mutation(internal.festivalRoster.storeInternal, { ...args, entries: [{ name: "First" }] });
    expect((await t.run(ctx => ctx.db.get(id)))?.artistCount).toBe(1);
  });
  it("parses modern year sections including unlinked artists and compound names", async () => {
    const { t } = await fixture();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => `<div class="mw-heading"><h3>2026</h3></div><table><tr><td><ul><li><a>Shane Smith</a> and The Saints</li><li>Unlinked Artist</li></ul></td></tr></table><div class="mw-heading"><h3>2025</h3></div><ul><li>Wrong Edition</li></ul>` }));
    const result = await t.action(internal.festivalBootstrap.scrapeFestivalLineup, { wikiUrl: "https://en.wikipedia.org/wiki/Example", year: 2026, festivalName: "Example Festival" });
    expect(result.artists).toEqual(["Shane Smith and The Saints", "Unlinked Artist"]);
  });
});
