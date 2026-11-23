import { describe, expect, it } from "vitest";
import { buildSeoPage, renderSeoDocument } from "../../convex/seoHtml";
import { basicSeoPage, escapeHtml } from "../../shared/seo";

const shell = `<!doctype html><html><head><title>Default</title><meta name="description" content="Default"><meta name="robots" content="index, follow"><link rel="canonical" href="https://www.setlists.live/"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>`;

describe("search titles and voting availability", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const show = { kind: "show", canonicalKey: "john-mayer-sphere-las-vegas-2027-04-08",
    show: { status: "upcoming", date: "2027-04-08", startsAt: Date.parse("2027-04-09T03:00:00Z") },
    artist: { name: "John Mayer", slug: "john-mayer", images: ["https://example.com/hero.jpg"] },
    venue: { name: "Sphere", city: "Las Vegas", state: "NV", country: "US" }, actualSongs: [], suggestedSongs: [], indexable: true };
  it("keeps event identity and request intent consistent in HTML, social titles and the client bootstrap", () => {
    const page = buildSeoPage(show, now);
    expect(page.title).toBe("John Mayer Setlist | Vote & Request Songs | Sphere | Apr 8, 2027");
    const html = renderSeoDocument(shell, page);
    expect(html).toContain(`<title>${escapeHtml(page.title)}</title>`);
    expect(html).toContain(`property="og:title" content="${escapeHtml(page.title)}"`);
    expect(html).toContain(`name="twitter:title" content="${escapeHtml(page.title)}"`);
    expect(JSON.parse(html.match(/id="seo-data" type="application\/json">([\s\S]*?)<\/script>/)![1]).page.title).toBe(page.title);
    expect(page.image).toBe("https://example.com/hero.jpg");
    expect(page.description).toContain("request songs");
    expect(page.body).toContain(escapeHtml(page.description));
    const anotherDate = buildSeoPage({ ...show, show: { ...show.show, date: "2027-04-10" } }, now);
    expect(anotherDate.title).not.toBe(page.title);
  });
  it("removes the voting call to action at the actual voting deadline without waiting for status sync", () => {
    const before = buildSeoPage(show, show.show.startsAt - 1);
    const after = buildSeoPage(show, show.show.startsAt);
    expect(before.title).toContain("Vote & Request Songs");
    expect(after.title).toBe("John Mayer Setlist | Sphere | Apr 8, 2027");
    expect(after.description).toContain("requests are closed");
    expect(after.body).not.toContain("interactive setlist");
  });
  it.each(["completed", "cancelled"])("does not advertise open voting for a %s show", status => {
    const page = buildSeoPage({ ...show, show: { ...show.show, status } }, now);
    expect(page.title).not.toContain("Vote & Request");
    expect(page.title).not.toMatch(/[()–]/);
    expect(page.description).toContain("closed");
    if (status === "cancelled") {
      expect(page.title).toContain("| Cancelled |");
      expect((page.jsonLd["@graph"] as any[]).find(x => x["@type"] === "MusicEvent").eventStatus).toBe("https://schema.org/EventCancelled");
    }
  });
  it("uses pipes on artist and venue pages without removing punctuation from real names", () => {
    const artist = buildSeoPage({ kind: "artist", canonicalKey: "artist", artist: { name: "Artist (Live)" }, upcoming: [], completed: [], indexable: true }, now);
    expect(artist.title).toBe("Artist (Live) Setlists & Tour Dates | Vote & Request Songs");
    const venue = buildSeoPage({ kind: "venue", canonicalKey: "venue", venue: { name: "The Hall", city: "Austin", state: "TX" }, upcoming: [], completed: [], indexable: true }, now);
    expect(venue.title).toBe("The Hall Concerts | Setlists & Song Voting | Austin, TX");
    for (const path of ["/", "/artists", "/shows"]) expect(basicSeoPage(path).title).toContain("| Vote & Request Songs |");
  });
});

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

it("uses real instants, valid status values and stable entity links", () => {
  const page = buildSeoPage({ kind: "show", canonicalKey: "example", show: { date: "2027-02-26", startTime: "18:30", startsAt: Date.parse("2027-02-26T18:30:00Z"), status: "completed" }, artist: { name: "Artist", slug: "artist" }, venue: { name: "Venue", slug: "venue", city: "London", country: "GB", address: "Arena Square" }, actualSongs: [{ title: "Song" }], suggestedSongs: [], indexable: true });
  const graph = page.jsonLd["@graph"] as any[];
  const event = graph.find(node => node["@type"] === "MusicEvent");
  expect(event.startDate).toBe("2027-02-26T18:30:00.000Z");
  expect(event.eventStatus).toBe("https://schema.org/EventScheduled");
  expect(event.location.address.streetAddress).toBe("Arena Square");
  expect(event.performer["@id"]).toBe("https://www.setlists.live/artists/artist#entity");
  expect(event.workPerformed).toEqual([{ "@type": "MusicComposition", name: "Song" }]);
  expect(page.image).toContain("/api/og?path=");
  expect(page.body).toContain('href="/venues/venue"');
});

it("does not invent fan demand or a total from a capped artist sample", () => {
  const artist = buildSeoPage({ kind: "artist", canonicalKey: "artist", artist: { name: "Artist" }, upcoming: Array.from({ length: 12 }, (_, i) => ({ slug: `show-${i}`, date: "2027-01-01" })), completed: [], indexable: true });
  expect(artist.description).not.toContain("12 upcoming");
  const show = buildSeoPage({ kind: "show", canonicalKey: "example", show: { date: "2027-01-01", startTime: "19:00", status: "upcoming" }, artist: { name: "Artist", slug: "artist" }, venue: { name: "Venue", slug: "venue" }, actualSongs: [], suggestedSongs: [{ title: "Seeded song" }], hasFanRequests: false, indexable: true });
  expect(show.body).toContain("Suggested songs");
  expect((show.jsonLd["@graph"] as any[]).find(n => n["@type"] === "MusicEvent").startDate).toBe("2027-01-01");
});

it("escapes HTML and JSON script boundaries and embeds the identical head model", () => {
  const page = buildSeoPage({ kind: "artist", canonicalKey: "evil", artist: { name: '</script><script>alert("x")</script>' }, upcoming: [], completed: [], indexable: true });
  const html = renderSeoDocument(shell, page);
  expect(html).not.toContain('<script>alert("x")</script>');
  const bootstrap = JSON.parse(html.match(/id="seo-data" type="application\/json">([\s\S]*?)<\/script>/)![1]);
  expect(bootstrap.page.title).toBe(page.title);
  expect(bootstrap.page.jsonLd).toEqual(page.jsonLd);
  expect(html).toContain('property="og:image:width" content="1200"');
});
