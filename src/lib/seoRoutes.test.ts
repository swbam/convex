// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSeoPage } from "../../convex/seoRoutes";
import { STATIC_PAGES } from "../../shared/seo";
const ctx = { runQuery: vi.fn(async () => ({ artists: [] })) };
afterEach(() => vi.unstubAllGlobals());
describe("route metadata and status", () => {
  it("gives every static route its own canonical and initial HTML", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ result: [] })));
    for (const path of Object.keys(STATIC_PAGES)) {
      const { page, status } = await resolveSeoPage(ctx, path);
      expect(status).toBe(200); expect(page.canonical).toBe(`https://www.setlists.live${path}`);
      expect(page.robots).toBe("index, follow"); expect(page.body).toContain("<h1>");
    }
  });
  it("noindexes internal pages without leaking invitation tokens", async () => {
    for (const path of ["/search?q=secret", "/dashboard", "/docs", "/for-artists/invite/secret-token"]) {
      const result = await resolveSeoPage(ctx, path);
      expect(result.page.robots).toContain("noindex"); expect(JSON.stringify(result)).not.toContain("secret");
    }
  });
  it("returns real missing-page statuses and permanent legacy redirects", async () => {
    expect((await resolveSeoPage(ctx, "/missing-page")).status).toBe(404);
    expect(await resolveSeoPage(ctx, "/studio/old-id")).toMatchObject({ status: 308, redirect: "https://www.setlists.live/for-artists" });
    const missing = { runQuery: async () => null };
    expect((await resolveSeoPage(missing, "/festivals/missing")).status).toBe(404);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ result: null })));
    expect((await resolveSeoPage(ctx, "/blog/missing")).status).toBe(404);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unavailable", { status: 503 })));
    await expect(resolveSeoPage(ctx, "/blog/known")).rejects.toThrow("Blog unavailable");
  });
});
