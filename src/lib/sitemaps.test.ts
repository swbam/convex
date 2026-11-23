// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { internal } from "../../convex/_generated/api";
const modules = import.meta.glob("../../convex/**/*.{ts,js}");
const priv = internal as any;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(Date.parse("2026-09-24T12:00:00Z")); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
it("retires public crawl routes without resolving catalog data or fetching the frontend", async () => {
  const t = convexTest({ schema, modules });
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected outbound request"));
  try {
    for (const path of ["/seo/about", "/seo-meta?path=/artists", "/sitemap.xml", "/sitemaps/blog.xml"]) {
      expect((await t.fetch(path)).status).toBe(410);
    }
    const robots = await t.fetch("/robots.txt");
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
  }
});
it("publishes bounded canonical shards, excludes thin history, and retains the old snapshot during refresh", async () => {
  const t = convexTest({ schema, modules, transactionLimits: true });
  await t.run(async ctx => {
    const artistId = await ctx.db.insert("artists", { name: "Artist", slug: "artist", lowerName: "artist", isActive: true });
    const venueId = await ctx.db.insert("venues", { name: "Hall", slug: "hall", city: "London", country: "GB" });
    for (let i = 0; i < 85; i++) await ctx.db.insert("shows", { artistId, venueId, date: "2027-01-01", status: "upcoming", slug: `show-${i}` });
    await ctx.db.insert("shows", { artistId, venueId, date: "2020-01-01", status: "completed", slug: "thin-history" });
    const historical = await ctx.db.insert("shows", { artistId, venueId, date: "2020-01-01", status: "completed", slug: "useful-old-setlist" });
    await ctx.db.insert("setlists", { showId: historical, songs: [], isOfficial: true, actualSetlist: [{ title: "One", setNumber: 1, encore: false }, { title: "Two", setNumber: 1, encore: false }, { title: "Three", setNumber: 1, encore: false }] });
  });
  expect((await t.query(priv.sitemaps.index, {})).ready).toBe(false);
  await t.mutation(priv.sitemaps.refresh, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const published = await t.query(priv.sitemaps.index, {});
  expect(published.ready).toBe(true);
  expect(published.states.find((s: any) => s.kind === "shows")).toMatchObject({ publishedUrlCount: 86, publishedShards: 2 });
  expect(published.xml).toContain("/sitemaps/shows-0.xml");
  expect(published.xml).not.toContain("/sitemaps/shows-1.xml");
  const group = await t.query(priv.sitemaps.publishedFile, { kind: "shows", part: 0 });
  expect(group.match(/<url>/g)).toHaveLength(86);
  expect(group.match(/<urlset /g)).toHaveLength(1);
  expect(await t.query(priv.sitemaps.publishedFile, { kind: "shows", part: 1 })).toBeNull();
  const shards = await t.run(ctx => ctx.db.query("seoSitemapShards").collect());
  const xml = shards.map(s => s.xml).join("");
  expect(xml).toContain("useful-old-setlist"); expect(xml).not.toContain("thin-history");
  vi.setSystemTime(Date.now() + 1000);
  await t.mutation(priv.sitemaps.refresh, {});
  const rebuilding = await t.query(priv.sitemaps.index, {});
  expect(rebuilding.xml).toBe(published.xml);
  expect(rebuilding.states.every((s: any) => s.building)).toBe(true);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect((await t.query(priv.sitemaps.index, {})).xml).toBe(published.xml);
  expect(await t.query(priv.sitemaps.publishedFile, { kind: "shows", part: 0 })).toBe(group);
});
it("refuses a suspiciously empty replacement without changing the last published generation", async () => {
  const t = convexTest({ schema, modules, transactionLimits: true });
  await t.run(ctx => ctx.db.insert("seoSitemapStates", { kind: "shows", generation: 2, cursor: null, building: true, updatedAt: Date.now(), nextShard: 0, urlCount: 0, publishedGeneration: 1, publishedShards: 1, publishedUrlCount: 30, publishedAt: Date.now() - 1000 }));
  await expect(t.mutation(priv.sitemaps.step, { kind: "shows", generation: 2, cursor: null })).rejects.toThrow("retaining published generation");
  const states = (await t.query(priv.sitemaps.index, {})).states;
  expect(states[0]).toMatchObject({ publishedGeneration: 1, publishedUrlCount: 30, cursor: null });
});
it("emits a shared show slug once across page boundaries, even when its first row is ineligible", async () => {
  const t = convexTest({ schema, modules, transactionLimits: true });
  await t.run(async ctx => {
    const artistId = await ctx.db.insert("artists", { name: "A", slug: "a", lowerName: "a", isActive: true });
    const venueId = await ctx.db.insert("venues", { name: "V", slug: "v", city: "London", country: "GB" });
    const show = { artistId, venueId, date: "2027-01-01", slug: "same" };
    await ctx.db.insert("shows", { ...show, status: "completed" });
    for (let i = 0; i < 82; i++) await ctx.db.insert("shows", { ...show, status: "upcoming" });
    await ctx.db.insert("shows", { ...show, slug: "unique", status: "upcoming" });
  });
  await t.mutation(priv.sitemaps.refresh, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const file = await t.query(priv.sitemaps.publishedFile, { kind: "shows", part: 0 });
  expect(file.match(/<url>/g)).toHaveLength(2);
  expect(file.match(/\/shows\/same</g)).toHaveLength(1);
  expect(file).toContain("/shows/unique<");
});
it("retires sitemap URLs from every generation", async () => {
  const t = convexTest({ schema, modules });
  const retired = await t.fetch(`/sitemaps/shows-${Date.now() - 8 * 86400_000}-15.xml`);
  expect(retired.status).toBe(410);
  expect(retired.headers.get("Cache-Control")).toContain("max-age=86400");
  expect((await t.fetch(`/sitemaps/shows-${Date.now()}-15.xml`)).status).toBe(410);
});
