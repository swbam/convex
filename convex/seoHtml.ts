const SITE_URL = "https://www.setlists.live";
const DEFAULT_IMAGE = `${SITE_URL}/og-preview.png`;

export interface SeoPage {
  title: string;
  description: string;
  canonical: string;
  image: string;
  type: string;
  robots: string;
  jsonLd: Record<string, unknown>;
  body: string;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function safeImage(value: unknown) {
  if (typeof value !== "string") return DEFAULT_IMAGE;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : DEFAULT_IMAGE;
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

export function buildSeoPage(data: any): SeoPage {
  if (data.kind === "artist") {
    const artist = data.artist;
    const title = `${artist.name} Tour Dates, Setlists & Song Voting`;
    const description = truncate(
      data.upcoming.length
        ? `${artist.name} has ${data.upcoming.length} upcoming shows on setlists.live. Browse tour dates, vote for songs, and compare fan picks with past setlists.`
        : `Explore ${artist.name} songs, concert history, and past setlists on setlists.live.`,
    );
    const canonical = `${SITE_URL}/artists/${encodeURIComponent(data.canonicalKey)}`;
    return {
      title,
      description,
      canonical,
      image: safeImage(artist.images?.[0]),
      type: "profile",
      robots: data.indexable ? "index, follow" : "noindex, follow",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "MusicGroup",
        name: artist.name,
        url: canonical,
        image: safeImage(artist.images?.[0]),
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
    const title = `${artistName} Setlist – ${venueName} (${date})`;
    const songNames = data.actualSongs.slice(0, 5).map((song: any) => song.title).filter(Boolean);
    const description = truncate(
      isHistorical && songNames.length
        ? `${artistName}'s confirmed ${date} setlist at ${venueName}${location ? ` in ${location}` : ""}, including ${songNames.join(", ")}.`
        : `Vote for the songs you want ${artistName} to play at ${venueName}${location ? ` in ${location}` : ""} on ${date}.`,
    );
    const canonical = `${SITE_URL}/shows/${encodeURIComponent(data.canonicalKey)}`;
    const songs = isHistorical ? data.actualSongs : data.suggestedSongs;
    return {
      title,
      description,
      canonical,
      image: safeImage(data.artist.images?.[0]),
      type: "website",
      robots: data.indexable ? "index, follow" : "noindex, follow",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "MusicEvent",
        name: `${artistName} at ${venueName}`,
        startDate: data.show.startTime ? `${data.show.date}T${data.show.startTime}` : data.show.date,
        eventStatus:
          data.show.status === "cancelled"
            ? "https://schema.org/EventCancelled"
            : data.show.status === "completed"
              ? "https://schema.org/EventCompleted"
              : "https://schema.org/EventScheduled",
        url: canonical,
        image: safeImage(data.artist.images?.[0]),
        performer: { "@type": "MusicGroup", name: artistName },
        location: {
          "@type": "MusicVenue",
          name: venueName,
          address: {
            "@type": "PostalAddress",
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
          <p class="seo-eyebrow">${isHistorical ? "Confirmed concert setlist" : "Fan setlist voting"}</p>
          <h1>${escapeHtml(artistName)} at ${escapeHtml(venueName)}</h1>
          <p>${escapeHtml(date)}${location ? ` · ${escapeHtml(location)}` : ""}</p>
          <section>
            <h2>${isHistorical ? "Songs played" : "Songs fans want to hear"}</h2>
            ${songs?.length
              ? `<ol>${songs.slice(0, 40).map((song: any) => `<li>${escapeHtml(song.title || song.songTitle)}</li>`).join("")}</ol>`
              : `<p>${isHistorical ? "The confirmed setlist is still being imported from setlist.fm." : "Open the interactive voting page to make the first pick."}</p>`}
          </section>
        </main>`,
    };
  }

  const venue = data.venue;
  const location = [venue.city, venue.state || venue.country].filter(Boolean).join(", ");
  const title = `${venue.name} Concerts & Setlists – ${location}`;
  const description = truncate(
    `Browse upcoming concerts and recent setlists at ${venue.name} in ${location}. Open any show to vote for songs before doors open.`,
  );
  const canonical = `${SITE_URL}/venues/${encodeURIComponent(data.canonicalKey)}`;
  return {
    title,
    description,
    canonical,
    image: DEFAULT_IMAGE,
    type: "place",
    robots: data.indexable ? "index, follow" : "noindex, follow",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "MusicVenue",
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

function replaceMeta(html: string, selector: RegExp, tag: string) {
  if (selector.test(html)) return html.replace(selector, tag);
  return html.replace("</head>", `  ${tag}\n</head>`);
}

export function renderSeoDocument(shell: string, page: SeoPage) {
  let html = shell.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`);
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

  const jsonLd = JSON.stringify(page.jsonLd)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  html = html.replace(
    "</head>",
    `  <script id="seo-jsonld" type="application/ld+json">${jsonLd}</script>\n` +
      `  <style id="seo-prerender-style">.seo-prerender{max-width:72rem;margin:0 auto;padding:7rem 1.25rem 4rem;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.seo-prerender h1{font-size:clamp(2.25rem,6vw,4.75rem);line-height:1.02;letter-spacing:-.04em;margin:.5rem 0 1rem}.seo-prerender h2{font-size:1.25rem;margin:2rem 0 .75rem}.seo-prerender p,.seo-prerender li{color:#a1a1aa;line-height:1.6}.seo-prerender a{color:#f4f4f5}.seo-prerender section{border-top:1px solid #27272a;margin-top:2rem}.seo-eyebrow{text-transform:uppercase;letter-spacing:.18em;font-size:.72rem;color:#facc15!important}@media(max-width:640px){.seo-prerender{padding-top:5.5rem}}body{background:#02040a}</style>\n</head>`,
  );
  return html.replace(/<div\s+id=["']root["']\s*><\/div>/i, `<div id="root">${page.body}</div>`);
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
