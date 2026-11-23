import { SITE_URL, escapeHtml, graphPage, safeJson, seoTitle, socialImage, socialImageMeta, type SeoPage } from "../shared/seo";
import { hasVotingClosed } from "./lib/showTiming";
import { APP_STARTUP_MARKUP, APP_STARTUP_SCRIPT, APP_STARTUP_STYLES } from "../shared/appStartup";
export { escapeHtml };
export type { SeoPage };
const DEFAULT_IMAGE = socialImage("/");

function safeImage(value: unknown) {
  if (typeof value !== "string") return DEFAULT_IMAGE;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : DEFAULT_IMAGE;
  } catch {
    return DEFAULT_IMAGE;
  }
}

function formatDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!match) return value || "Date TBA";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`));
}

function truncate(value: string, max = 158) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function showList(shows: any[], empty: string) {
  if (!shows?.length) return `<p>${escapeHtml(empty)}</p>`;
  return `<ul>${shows.slice(0, 12).map((show) => {
    const key = show.slug || show._id;
    const label = show.artist?.name
      ? `${show.artist.name} — ${formatDate(show.date)}`
      : `${show.venue?.name || "Venue TBA"} — ${formatDate(show.date)}`;
    return `<li><a href="/shows/${encodeURIComponent(String(key))}">${escapeHtml(label)}</a></li>`;
  }).join("")}</ul>`;
}

function buildEntityPage(data: any, now: number): SeoPage {
  if (data.kind === "artist") {
    const artist = data.artist;
    const title = seoTitle(`${artist.name} Setlists & Tour Dates`, "Vote & Request Songs");
    const description = truncate(
      data.upcoming.length
        ? `Explore ${artist.name} tour dates and setlists. Request songs, vote for your favorites before each show, and see what was played at past concerts.`
        : `Explore ${artist.name} songs, concert history, and past setlists on setlists.live.`,
    );
    const canonical = `${SITE_URL}/artists/${encodeURIComponent(data.canonicalKey)}`;
    return {
      title,
      description,
      canonical,
      image: safeImage(data.hero?.heroUrl || artist.images?.[0]),
      imageAlt: `${artist.name} artist photograph`,
      imageWidth: data.hero?.heroWidth, imageHeight: data.hero?.heroHeight,
      type: "website",
      robots: data.indexable ? "index, follow" : "noindex, follow",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "MusicGroup",
        name: artist.name,
        url: canonical,
        image: safeImage(data.hero?.heroUrl || artist.images?.[0]),
        ...(artist.genres?.length ? { genre: artist.genres } : {}),
      },
      body: `
        <main class="seo-prerender">
          <p class="seo-eyebrow">Artist tour demand</p>
          <h1>${escapeHtml(artist.name)}</h1>
          <p>${escapeHtml(description)}</p>
          <section><h2>Upcoming shows</h2>${showList(data.upcoming, "No upcoming dates are currently listed.")}</section>
          <section><h2>Recent setlists</h2>${showList(data.completed, "Past setlists will appear as they are confirmed.")}</section>
        </main>`,
    };
  }

  if (data.kind === "show") {
    const artistName = data.artist.name;
    const venueName = data.venue.name;
    const location = [data.venue.city, data.venue.state || data.venue.country].filter(Boolean).join(", ");
    const date = formatDate(data.show.date);
    const isHistorical = data.show.status === "completed";
    const isCancelled = data.show.status === "cancelled";
    const votingOpen = data.show.status === "upcoming" && !hasVotingClosed(data.show, now);
    const title = seoTitle(isCancelled ? artistName : `${artistName} Setlist`,
      isCancelled ? "Cancelled" : votingOpen ? "Vote & Request Songs" : undefined,
      venueName, date);
    const songNames = data.actualSongs.slice(0, 5).map((song: any) => song.title).filter(Boolean);
    const description = truncate(
      isCancelled
        ? `${artistName} at ${venueName} on ${date} is cancelled. Song voting and requests are closed. Explore other dates and past setlists.`
        : isHistorical && songNames.length
        ? `${artistName}'s confirmed ${date} setlist at ${venueName}${location ? ` in ${location}` : ""}, including ${songNames.join(", ")}.`
        : votingOpen
        ? `Vote for your favorites and request songs for ${artistName} at ${venueName} on ${date}${location ? ` in ${location}` : ""}.`
        : `Song voting and requests are closed for ${artistName} at ${venueName} on ${date}. The confirmed setlist is not yet available.`,
    );
    const canonical = `${SITE_URL}/shows/${encodeURIComponent(data.canonicalKey)}`;
    const songs = isHistorical ? data.actualSongs : data.suggestedSongs;
    return {
      title,
      description,
      canonical,
      image: safeImage(data.hero?.heroUrl || data.show.artistImage || data.artist.images?.[0]),
      imageAlt: `${artistName} artist photograph`,
      imageWidth: data.hero?.heroWidth, imageHeight: data.hero?.heroHeight,
      type: "website",
      robots: data.indexable ? "index, follow" : "noindex, follow",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "MusicEvent",
        name: `${artistName} at ${venueName}`,
        startDate: typeof data.show.startsAt === "number" ? new Date(data.show.startsAt).toISOString() : data.show.date,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        description,
        eventStatus:
          data.show.status === "cancelled"
            ? "https://schema.org/EventCancelled"
            : "https://schema.org/EventScheduled",
        url: canonical,
        image: safeImage(data.hero?.heroUrl || data.show.artistImage || data.artist.images?.[0]),
        performer: { "@type": "MusicGroup", "@id": `${SITE_URL}/artists/${encodeURIComponent(data.artist.slug || data.artist._id)}#entity`, name: artistName, url: `${SITE_URL}/artists/${encodeURIComponent(data.artist.slug || data.artist._id)}` },
        location: {
          "@type": "MusicVenue",
          name: venueName,
          "@id": `${SITE_URL}/venues/${encodeURIComponent(data.venue.slug || data.venue._id)}#entity`,
          url: `${SITE_URL}/venues/${encodeURIComponent(data.venue.slug || data.venue._id)}`,
          address: {
            "@type": "PostalAddress",
            ...(data.venue.address ? { streetAddress: data.venue.address } : {}),
            addressLocality: data.venue.city,
            ...(data.venue.state ? { addressRegion: data.venue.state } : {}),
            addressCountry: data.venue.country,
          },
        },
        ...(data.show.ticketUrl && data.show.status === "upcoming"
          ? { offers: { "@type": "Offer", url: data.show.ticketUrl } }
          : {}),
        ...(isHistorical && data.actualSongs.length
          ? {
              workPerformed: data.actualSongs.slice(0, 40).map((song: any) => ({
                "@type": "MusicComposition",
                name: song.title,
              })),
            }
          : {}),
      },
      body: `
        <main class="seo-prerender">
          <p class="seo-eyebrow">${isCancelled ? "Cancelled show" : isHistorical && songNames.length ? "Confirmed concert setlist" : votingOpen ? "Fan setlist voting and song requests" : "Concert setlist"}</p>
          <h1>${escapeHtml(artistName)} at ${escapeHtml(venueName)}</h1>
          <p>${escapeHtml(date)}${location ? ` · ${escapeHtml(location)}` : ""}</p>
          <p>${escapeHtml(description)}</p>
          <p><a href="/artists/${encodeURIComponent(data.artist.slug || data.artist._id)}">${escapeHtml(artistName)} tour dates</a> · <a href="/venues/${encodeURIComponent(data.venue.slug || data.venue._id)}">${escapeHtml(venueName)} concerts</a></p>
          <section>
            <h2>${isHistorical ? "Songs played" : data.hasFanRequests ? "Songs fans requested" : "Suggested songs"}</h2>
            ${songs?.length
              ? `<ol>${songs.slice(0, 40).map((song: any) => `<li>${escapeHtml(song.title || song.songTitle)}</li>`).join("")}</ol>`
              : `<p>${isCancelled ? "This show was cancelled." : isHistorical ? "The confirmed setlist is still being imported from setlist.fm." : votingOpen ? "Request a song or vote for your favorites in the interactive setlist." : "Song voting and requests are closed."}</p>`}
          </section>
        </main>`,
    };
  }

  const venue = data.venue;
  const location = [venue.city, venue.state || venue.country].filter(Boolean).join(", ");
  const title = seoTitle(`${venue.name} Concerts`, "Setlists & Song Voting", location);
  const description = truncate(
    `Explore concerts and past setlists at ${venue.name}${location ? ` in ${location}` : ""}. Choose an upcoming show to request songs and vote before it starts.`,
  );
  const canonical = `${SITE_URL}/venues/${encodeURIComponent(data.canonicalKey)}`;
  return {
    title,
    description,
    canonical,
    image: safeImage(data.hero?.heroUrl),
    imageAlt: `${venue.name} in ${location}`,
    imageWidth: data.hero?.heroWidth, imageHeight: data.hero?.heroHeight,
    type: "website",
    robots: data.indexable ? "index, follow" : "noindex, follow",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "MusicVenue",
      image: safeImage(data.hero?.heroUrl),
      name: venue.name,
      url: canonical,
      address: {
        "@type": "PostalAddress",
        ...(venue.address ? { streetAddress: venue.address } : {}),
        addressLocality: venue.city,
        ...(venue.state ? { addressRegion: venue.state } : {}),
        addressCountry: venue.country,
      },
    },
    body: `
      <main class="seo-prerender">
        <p class="seo-eyebrow">Live music venue</p>
        <h1>${escapeHtml(venue.name)}</h1>
        <p>${escapeHtml(location)}${venue.address ? ` · ${escapeHtml(venue.address)}` : ""}</p>
        <section><h2>Upcoming concerts</h2>${showList(data.upcoming, "No upcoming concerts are currently listed.")}</section>
        <section><h2>Recent setlists</h2>${showList(data.completed, "Recent setlists will appear after shows are confirmed.")}</section>
      </main>`,
  };
}

export function buildSeoPage(data: any, now = Date.now()): SeoPage {
  const page = buildEntityPage(data, now);
  const label = data.kind === "artist" ? data.artist.name : data.kind === "venue" ? data.venue.name : `${data.artist.name} at ${data.venue.name}`;
  return graphPage(page, [{ name: "Home", path: "/" }, ...(data.kind === "venue" ? [] : [{ name: data.kind === "artist" ? "Artists" : "Shows", path: data.kind === "artist" ? "/artists" : "/shows" }]), { name: label, path: new URL(page.canonical).pathname }]);
}

function replaceMeta(html: string, selector: RegExp, tag: string) {
  if (selector.test(html)) return html.replace(selector, () => tag);
  return html.replace("</head>", () => `  ${tag}\n</head>`);
}

export function renderSeoDocument(shell: string, page: SeoPage, path = new URL(page.canonical).pathname) {
  let html = shell.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(page.title)}</title>`);
  const meta = [
    [/\s*<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(page.description)}" />`],
    [/\s*<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${page.robots}" />`],
    [/\s*<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(page.title)}" />`],
    [/\s*<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(page.description)}" />`],
    [/\s*<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(page.canonical)}" />`],
    [/\s*<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${escapeHtml(page.image)}" />`],
    [/\s*<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="${escapeHtml(page.type)}" />`],
    [/\s*<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`],
    [/\s*<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`],
    [/\s*<meta\s+name=["']twitter:url["'][^>]*>/i, `<meta name="twitter:url" content="${escapeHtml(page.canonical)}" />`],
    [/\s*<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${escapeHtml(page.image)}" />`],
  ] as const;
  for (const [selector, tag] of meta) html = replaceMeta(html, selector, tag);
  html = replaceMeta(
    html,
    /\s*<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(page.canonical)}" />`,
  );

  const jsonLd = safeJson(page.jsonLd);
  const imageMeta = socialImageMeta(page);
  // Clear stale shell tags before adding measured properties for this image.
  html = html.replace(/<meta\s+property=["']og:image:(?:width|height|type|alt)["'][^>]*>/gi, "");
  const extras = { ...Object.fromEntries(Object.entries(imageMeta).map(([key, value]) => [`og:${key}`, value])), "og:site_name": "setlists.live" };
  for (const [name, content] of Object.entries(extras)) html = replaceMeta(html, new RegExp(`<meta\\s+property=["']${name}["'][^>]*>`, "i"), `<meta property="${name}" content="${escapeHtml(content)}" />`);
  html = replaceMeta(html, /<meta\s+name=["']twitter:card["'][^>]*>/i, '<meta name="twitter:card" content="summary_large_image" />');
  html = replaceMeta(html, /<meta\s+name=["']twitter:image:alt["'][^>]*>/i, `<meta name="twitter:image:alt" content="${escapeHtml(imageMeta["image:alt"])}" />`);
  html = html.replace(/<script[^>]*id=["']seo-(?:jsonld|data)["'][^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(
    "</head>",
    () => `  <script id="seo-data" type="application/json">${safeJson({ path, page: { ...page, body: "" } })}</script>\n` +
    `  <script id="seo-jsonld" type="application/ld+json">${jsonLd}</script>\n` +
      `  <style id="seo-prerender-style">.seo-prerender{max-width:72rem;min-height:100vh;margin:0 auto;padding:4rem 1rem;color:hsl(var(--foreground,0 0% 96%));background:hsl(var(--background,0 0% 4%));font-family:Overpass,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.seo-prerender h1{font-size:clamp(1.75rem,4vw,3rem);line-height:1.15;letter-spacing:-.025em;margin:.5rem 0 1rem}.seo-prerender h2{font-size:1.25rem;margin:2rem 0 .75rem}.seo-prerender p,.seo-prerender li{color:hsl(var(--muted-foreground,0 0% 64%));line-height:1.6}.seo-prerender a{color:inherit;text-decoration:underline}.seo-prerender nav{display:flex;flex-wrap:wrap;gap:.5rem;font-size:.875rem;margin-bottom:1rem}.seo-prerender section{border-top:1px solid hsl(var(--border,0 0% 16%));margin-top:2rem}.seo-eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.72rem}${APP_STARTUP_STYLES}</style>\n` +
      `  <script id="app-startup-script">${APP_STARTUP_SCRIPT}</script>\n</head>`,
  );
  return html.replace(/<div\s+id=["']root["']\s*><\/div>/i, () => `${APP_STARTUP_MARKUP}<div id="root">${page.body}</div>`);
}

export function renderNotFoundDocument(shell: string) {
  const page = {
    title: "Page not found – setlists.live",
    description: "This artist, show, or venue could not be found.",
    canonical: SITE_URL,
    image: DEFAULT_IMAGE,
    type: "website",
    robots: "noindex, follow",
    jsonLd: { "@context": "https://schema.org", "@type": "WebPage", name: "Page not found" },
    body: `<main class="seo-prerender"><p class="seo-eyebrow">404</p><h1>Page not found</h1><p>Search setlists.live for another artist, show, or venue.</p></main>`,
  };
  return renderSeoDocument(shell, page);
}
