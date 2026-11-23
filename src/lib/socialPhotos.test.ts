// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import { buildSeoPage, renderSeoDocument } from "../../convex/seoHtml";
import { resolveSeoPage } from "../../convex/seoRoutes";
import { selectHeroImage } from "../../convex/lib/heroImages";
import { basicSeoPage, graphPage, socialImageMeta } from "../../shared/seo";
const modules = import.meta.glob("../../convex/**/*.{ts,js}");
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const hero = { heroUrl: "https://s1.ticketm.net/banner.jpg", heroWidth: 2048, heroHeight: 1152 };
const data = { canonicalKey: "example", artist: { _id: "artist", name: "Artist", images: ["https://images.example/avatar.jpg"] }, venue: { _id: "venue", name: "Venue", city: "Chicago", country: "US" }, show: { status: "upcoming", date: "2026-10-04" }, actualSongs: [], suggestedSongs: [], upcoming: [], completed: [], indexable: true, hero };

describe("photographic social previews", () => {
  it.each(["artist", "show", "venue"])("keeps the %s header photo through graph and initial HTML generation", kind => {
    const page = buildSeoPage({ ...data, kind });
    expect(page.image).toBe(hero.heroUrl);
    const html = renderSeoDocument('<html><head><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"></head><body><div id="root"></div></body></html>', page);
    expect(html).toContain('property="og:image" content="https://s1.ticketm.net/banner.jpg"');
    expect(html).toContain('name="twitter:image" content="https://s1.ticketm.net/banner.jpg"');
    expect(html).toContain('property="og:image:width" content="2048"');
    expect(html).toContain('property="og:image:type" content="image/jpeg"');
    expect(html).not.toContain('property="og:image:type" content="image/png"');
  });
  it("does not invent dimensions or content types for an unmeasured artist photo", () => {
    const page = buildSeoPage({ ...data, kind: "artist", hero: undefined, artist: { name: "Artist", images: ["https://i.scdn.co/image/image-id"] } });
    expect(socialImageMeta(page)).toEqual({ "image:alt": "Artist artist photograph" });
  });
  it("preserves festival and article artwork instead of overriding it with a text card", async () => {
    const festival = await resolveSeoPage({ runQuery: async () => ({ festival: { name: "Festival", imageUrl: hero.heroUrl, startDate: "2026-10-01", endDate: "2026-10-02", location: "Austin" }, shows: [], roster: [] }) }, "/festivals/festival");
    expect(festival.page.image).toBe(hero.heroUrl);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ result: { title: "Story", image: hero.heroUrl, body: [] } })));
    expect((await resolveSeoPage({}, "/blog/story")).page.image).toBe(hero.heroUrl);
  });
  it("uses the same media action for metadata and keeps a usable fallback during outages", async () => {
    const ctx = { runQuery: async () => ({ ...data, kind: "show", hero: undefined }), runAction: vi.fn(async () => hero) };
    expect((await resolveSeoPage(ctx, "/shows/example")).page.image).toBe(hero.heroUrl);
    expect(ctx.runAction).toHaveBeenCalledWith(expect.anything(), { artistId: "artist" });
    ctx.runAction.mockRejectedValueOnce(new Error("Provider unavailable"));
    expect((await resolveSeoPage(ctx, "/shows/example")).page.image).toBe("https://images.example/avatar.jpg");
    expect(graphPage(basicSeoPage("/")).image).toContain("&v=3");
  });
  it("prefers a large landscape image and rejects provider placeholders and unsafe URLs", () => {
    expect(selectHeroImage([{ url: "http://unsafe/image.jpg", width: 3000, height: 1688 }, { url: "https://example.com/default.jpg", width: 4000, height: 2250, fallback: true }, { url: "https://example.com/square.jpg", width: 3000, height: 3000 }, { url: hero.heroUrl, width: 2048, height: 1152 }])).toEqual({ url: hero.heroUrl, width: 2048, height: 1152 });
  });
  it("uses the provider's optimized landscape rendition ahead of a larger original", () => {
    const optimized = { url: "https://s1.ticketm.net/photo_TABLET_LANDSCAPE_LARGE_16_9.jpg", width: 2048, height: 1152 };
    expect(selectHeroImage([{ url: "https://s1.ticketm.net/photo_SOURCE", width: 2426, height: 1365 }, optimized])).toEqual(optimized);
  });
  it("caches header photos across requests and keeps the last good photo when a refresh fails", async () => {
    const t = convexTest({ schema, modules });
    const artistId = await t.run(ctx => ctx.db.insert("artists", { name: "Artist", slug: "artist", isActive: true, ticketmasterId: "tm-artist" }));
    vi.stubEnv("TICKETMASTER_API_KEY", "test-only");
    const fetcher = vi.fn(async () => Response.json({ images: [{ url: hero.heroUrl, width: 2048, height: 1152 }] }));
    vi.stubGlobal("fetch", fetcher);
    expect(await t.action(api.media.getArtistImages, { artistId })).toMatchObject(hero);
    expect(await t.action(api.media.getArtistImages, { artistId })).toMatchObject(hero);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await t.run(async ctx => { const row = await ctx.db.query("heroImageCache").first(); await ctx.db.patch(row!._id, { refreshAfter: 0 }); });
    fetcher.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    expect(await t.action(api.media.getArtistImages, { artistId })).toMatchObject(hero);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("negative-caches venues without photos instead of repeatedly calling the API", async () => {
    const t = convexTest({ schema, modules });
    const venueId = await t.run(ctx => ctx.db.insert("venues", { name: "Venue", city: "Austin", country: "US", ticketmasterId: "tm-venue" }));
    vi.stubEnv("TICKETMASTER_API_KEY", "test-only");
    const fetcher = vi.fn(async () => Response.json({ images: [] })); vi.stubGlobal("fetch", fetcher);
    expect(await t.action(api.media.getVenueImage, { venueId })).toEqual({});
    expect(await t.action(api.media.getVenueImage, { venueId })).toEqual({});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
