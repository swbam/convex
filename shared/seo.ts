export const SITE_URL = "https://www.setlists.live";
export const STATIC_PAGES: Record<string, { title: string; description: string }> = {
  "/": { title: "Concert Setlists | Vote & Request Songs | setlists.live", description: "Find concert setlists and upcoming tour dates. Vote for your favorites, request songs for your next show, and see what artists played at past concerts." },
  "/artists": { title: "Artists & Tour Dates | Vote & Request Songs | setlists.live", description: "Explore artists, upcoming concerts and past setlists. Find your favorite artist, request songs, and vote for what you want to hear live." },
  "/shows": { title: "Concert Setlists & Shows | Vote & Request Songs | setlists.live", description: "Find upcoming concerts, request songs and vote for your favorites. Browse confirmed setlists to see what artists played at past shows." },
  "/trending": { title: "Trending Artists & Concerts | setlists.live", description: "Discover trending artists and concerts on setlists.live. Explore tour dates, recent setlists and fan song voting." },
  "/festivals": { title: "Music Festivals, Lineups & Setlists | setlists.live", description: "Explore music festival lineups, dates and artist setlists. Find festival performances and vote for the songs you want to hear." },
  "/blog": { title: "Concert & Music Festival Guides | setlists.live", description: "Read concert guides, festival coverage and setlist stories from setlists.live. Plan your next live music experience." },
  "/about": { title: "How It Works | Setlist Voting & Song Requests | setlists.live", description: "Find your concert, request songs and vote for your favorites. Learn how fan voting works and explore confirmed setlists after the show." },
  "/privacy": { title: "Privacy Policy | setlists.live", description: "Learn how setlists.live handles account information, analytics, cookies and your privacy choices." },
  "/terms": { title: "Terms of Service | setlists.live", description: "Read the terms for using setlists.live, including accounts, fan voting, user content and third-party ticket links." },
};
const STATIC_HEADINGS: Record<string, string> = {
  "/": "See what fans want to hear — before doors open",
  "/artists": "Artists", "/shows": "Shows", "/trending": "Trending",
  "/festivals": "Festivals", "/blog": "The Setlist Blog",
  "/about": "How it works", "/privacy": "Privacy Policy", "/terms": "Terms of Service",
};
export const PRIVATE_PREFIXES = ["signin", "signup", "profile", "dashboard", "activity", "admin", "docs", "test", "search", "for-artists", "sso-callback", "spotify-connect"];
// Keep real artist/venue names intact, including punctuation within a name.
// Only the separators between metadata sections are standardized.
export function seoTitle(...sections: (string | undefined)[]) {
  return sections.map(section => section?.trim()).filter(Boolean).join(" | ");
}
export function normalizePath(path: string) {
  return (path.split(/[?#]/)[0].replace(/\/+$/, "") || "/");
}
export function isPrivatePath(path: string) { return PRIVATE_PREFIXES.includes(normalizePath(path).split("/")[1]); }
export function canonicalPath(path: string) {
  path = normalizePath(path);
  // Never put invitation secrets or internal identifiers into head markup.
  return isPrivatePath(path) ? `/${path.split("/")[1]}` : path;
}
export interface SeoPage {
  title: string; description: string; canonical: string; image: string;
  imageAlt?: string; imageWidth?: number; imageHeight?: number;
  type: string; robots: string; jsonLd: Record<string, unknown>; body: string;
}
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]!);
}
export function safeJson(value: unknown) { return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029"); }
export function socialImage(path: string) { return `${SITE_URL}/api/og?path=${encodeURIComponent(canonicalPath(path))}&v=3`; }
export function basicSeoPage(path: string, missing = false): SeoPage {
  path = canonicalPath(path);
  const config = STATIC_PAGES[path];
  const privateTitles: Record<string, string> = { signin: "Sign in", signup: "Create an account", profile: "Your profile", dashboard: "Your dashboard", activity: "Activity", admin: "Administration", docs: "API documentation", test: "Test suite", search: "Search artists, songs & shows", "for-artists": "Artist portal", "sso-callback": "Completing sign in", "spotify-connect": "Connect Spotify" };
  const privateTitle = privateTitles[path.split("/")[1]];
  const isEntity = /^\/(artists|shows|venues|festivals|blog)\/[^/]+$/.test(path);
  const title = missing ? "Page not found | setlists.live" : config?.title || `${privateTitle || "Concert setlists"} | setlists.live`;
  const description = missing ? "This page could not be found. Explore artists, concert dates and setlists on setlists.live." : config?.description || (isEntity ? "Explore this concert, its artists and setlists on setlists.live." : "Sign in to manage your setlists.live account.");
  const canonical = `${SITE_URL}${path}`;
  const heading = missing ? "Page not found" : STATIC_HEADINGS[path] || privateTitle || "Concert setlists";
  return { title, description, canonical, image: socialImage(path), type: "website", robots: missing || (!config && !isEntity) ? "noindex, follow" : "index, follow", jsonLd: { "@context": "https://schema.org", "@type": "WebPage", "@id": `${canonical}#webpage`, url: canonical, name: title, description }, body: `<main class="seo-prerender"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p></main>` };
}
export function graphPage(page: SeoPage, crumbs: { name: string; path: string }[] = []): SeoPage {
  const { "@context": _context, ...entity } = page.jsonLd;
  const entityId = String(entity["@id"] || `${page.canonical}#entity`);
  const isPage = ["WebPage", "CollectionPage"].includes(String(entity["@type"]));
  const webPageId = `${page.canonical}#webpage`;
  const graph: Record<string, unknown>[] = [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "setlists.live", url: SITE_URL },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: "setlists.live", publisher: { "@id": `${SITE_URL}/#organization` } },
    { ...(isPage ? entity : {}), "@type": isPage ? entity["@type"] : "WebPage", "@id": webPageId, url: page.canonical, name: page.title, description: page.description, isPartOf: { "@id": `${SITE_URL}/#website` }, ...(isPage ? {} : { mainEntity: { "@id": entityId } }), ...(crumbs.length ? { breadcrumb: { "@id": `${page.canonical}#breadcrumbs` } } : {}) },
    ...(!isPage ? [{ ...entity, "@id": entityId, mainEntityOfPage: { "@id": webPageId } }] : []),
  ];
  if (crumbs.length) graph.push({ "@type": "BreadcrumbList", "@id": `${page.canonical}#breadcrumbs`, itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE_URL}${c.path}` })) });
  const nav = `<nav aria-label="Main navigation">${["/", "/artists", "/shows", "/festivals", "/blog"].map(path => `<a href="${path}">${path === "/" ? "Home" : path.slice(1)}</a>`).join(" · ")}</nav>`;
  const breadcrumb = crumbs.length ? `<nav aria-label="Breadcrumb">${crumbs.map(c => `<a href="${escapeHtml(c.path)}">${escapeHtml(c.name)}</a>`).join(" / ")}</nav>` : "";
  return { ...page, jsonLd: { "@context": "https://schema.org", "@graph": graph }, body: page.body.replace(/(<main[^>]*>)/, `$1${nav}${breadcrumb}`) };
}

// Only publish dimensions we actually know. Provider JPEGs must not be labelled
// as 1200×630 PNGs; omit optional properties for unmeasured source photographs.
export function socialImageMeta(page: SeoPage): Record<string, string> {
  const fallback = page.image.startsWith(`${SITE_URL}/api/og?`);
  const width = fallback ? 1200 : page.imageWidth;
  const height = fallback ? 630 : page.imageHeight;
  const path = new URL(page.image).pathname.toLowerCase();
  const type = fallback || path.endsWith(".png") ? "image/png" : /\.jpe?g$/.test(path) ? "image/jpeg" : path.endsWith(".webp") ? "image/webp" : undefined;
  return { "image:alt": fallback ? "Live music sound wave" : page.imageAlt || "Live music photograph",
    ...(width ? { "image:width": String(width) } : {}), ...(height ? { "image:height": String(height) } : {}),
    ...(type ? { "image:type": type } : {}) };
}
