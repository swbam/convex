import { describe, expect, it } from "vitest";
import { buildSeoPage, renderSeoDocument } from "../../convex/seoHtml";

const shell = `<!doctype html><html><head><title>Default</title><meta name="description" content="Default"><meta name="robots" content="index, follow"><link rel="canonical" href="https://www.setlists.live/"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>`;

describe("public SEO renderer", () => {
  it("renders useful historical setlist HTML and structured data", () => {
    const page = buildSeoPage({
      kind: "show",
      canonicalKey: "artist-at-venue-2026",
      show: { date: "2026-08-03", status: "completed" },
      artist: { name: "Artist <Live>", images: ["https://images.example/artist.jpg"] },
      venue: { name: "The Venue", city: "Chicago", state: "IL", country: "US" },
      actualSongs: [{ title: "First Song" }, { title: "Second Song" }, { title: "Encore" }],
      suggestedSongs: [],
      indexable: true,
    });
    const html = renderSeoDocument(shell, page);

    expect(html).toContain("Songs played");
    expect(html).toContain("First Song");
    expect(html).toContain("Artist &lt;Live&gt;");
    expect(html).not.toContain("Artist <Live>");
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('/assets/app.js');
    expect(html).toContain('content="index, follow"');
  });

  it("marks thin historical pages as noindex", () => {
    const page = buildSeoPage({
      kind: "show",
      canonicalKey: "thin-show",
      show: { date: "2026-08-03", status: "completed" },
      artist: { name: "Artist", images: [] },
      venue: { name: "Venue", city: "Austin", state: "TX", country: "US" },
      actualSongs: [],
      suggestedSongs: [],
      indexable: false,
    });

    expect(renderSeoDocument(shell, page)).toContain('content="noindex, follow"');
  });
});
