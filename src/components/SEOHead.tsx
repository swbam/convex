import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const SITE_URL = "https://www.setlists.live";
const DEFAULT_TITLE = "setlists.live – Concert Setlists, Predictions, and Voting";
const DEFAULT_DESCRIPTION =
  "Discover artists, browse shows, predict setlists, and vote in real time. setlists.live is the modern hub for concert setlists.";
const DEFAULT_IMAGE = `${SITE_URL}/og-preview.png`;
const JSONLD_ID = "seo-jsonld";

/** Path prefixes that must never be indexed by search engines. */
const NOINDEX_PREFIXES = [
  "/for-artists",
  "/profile",
  "/admin",
  "/sso-callback",
  "/spotify-connect",
  "/signin",
  "/signup",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format "YYYY-MM-DD" as "Mon D, YYYY" without timezone drift. */
function formatShowDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || "");
  if (!m) return isoDate || "";
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Maintain a single <script type="application/ld+json" id="seo-jsonld">; remove it when there is no data. */
function upsertJsonLd(json: string | null) {
  const existing = document.getElementById(JSONLD_ID);
  if (!json) {
    existing?.remove();
    return;
  }
  let script: HTMLScriptElement;
  if (existing instanceof HTMLScriptElement) {
    script = existing;
  } else {
    existing?.remove();
    script = document.createElement("script");
    script.id = JSONLD_ID;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = json;
}

export interface SEOHeadProps {
  /** Explicit page title. Wins over route-derived titles. Keep ≤ 60 chars where possible. */
  title?: string;
  /** Explicit meta description (aim for 150–160 chars). Wins over route-derived copy. */
  description?: string;
  /** Absolute URL (or site-relative path) for og:image / twitter:image. */
  image?: string;
  /** og:type, e.g. "website" | "article" | "profile". */
  type?: string;
  /** Force robots "noindex, nofollow" for this page. */
  noindex?: boolean;
  /** Arbitrary JSON-LD object (or array) — replaces any route-derived structured data. */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function SEOHead({ title, description, image, type, noindex, jsonLd }: SEOHeadProps = {}) {
  const location = useLocation();
  const params = useParams();
  const { artistSlug, showSlug, venueSlug } = params;

  const artist = useQuery(api.artists.getBySlugOrId, artistSlug ? { key: artistSlug } : "skip");
  const show = useQuery(api.shows.getBySlugOrId, showSlug ? { key: showSlug } : "skip");
  const venue = useQuery(api.venues.getBySlugOrId, venueSlug ? { key: venueSlug } : "skip");
  const venueShows = useQuery(api.shows.getByVenue, venue ? { venueId: venue._id, limit: 10 } : "skip");
  const showSetlists = useQuery(api.setlists.getByShow, show ? { showId: show._id } : "skip");

  // Stable string for effect deps (objects are re-created each render)
  const jsonLdString = jsonLd != null ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    const pathname = location.pathname;
    const canonicalUrl = SITE_URL + pathname;
    const year = new Date().getFullYear();

    let computedTitle = DEFAULT_TITLE;
    let computedDescription = DEFAULT_DESCRIPTION;
    let computedImage = DEFAULT_IMAGE;
    let computedType = "website";
    let routeJsonLd: Record<string, unknown> | null = null;

    if (artistSlug && artist) {
      computedTitle = `${artist.name} Tour ${year}: Setlists, Shows & Song Votes`;
      const showCount: number | undefined = artist.upcomingShowsCount;
      computedDescription =
        showCount && showCount > 0
          ? `${artist.name} tour ${year}: ${showCount} upcoming ${showCount === 1 ? "show" : "shows"}. Vote on the songs you want live and see fan-predicted setlists, dates, and venues for every stop.`
          : `Explore ${artist.name} setlists, tour dates, and song votes. Predict what ${artist.name} plays next and compare picks with the real setlist after the show.`;
      if (artist.images?.[0]) computedImage = artist.images[0];
      computedType = "profile";
      routeJsonLd = {
        "@context": "https://schema.org",
        "@type": "MusicGroup",
        name: artist.name,
        ...(artist.images?.[0] ? { image: artist.images[0] } : {}),
        ...(artist.genres?.length ? { genre: artist.genres } : {}),
        url: canonicalUrl,
      };
    } else if (showSlug && show) {
      const artistName = show.artist?.name ?? "Artist";
      const venueName = show.venue?.name ?? "TBA";
      const city = show.venue?.city ?? "";
      const dateStr = formatShowDate(show.date);
      computedTitle = `${artistName} Setlist – ${venueName}${city ? `, ${city}` : ""} (${dateStr})`;
      computedDescription = `See the songs fans are voting for at ${artistName}'s ${dateStr} show at ${venueName}${city ? `, ${city}` : ""}. Predict the setlist and compare with what gets played.`;
      if (show.artist?.images?.[0]) computedImage = show.artist.images[0];
      routeJsonLd = {
        "@context": "https://schema.org",
        "@type": "MusicEvent",
        name: `${artistName} at ${venueName}`,
        startDate: show.date,
        eventStatus:
          show.status === "cancelled"
            ? "https://schema.org/EventCancelled"
            : "https://schema.org/EventScheduled",
        url: canonicalUrl,
        ...(show.artist?.images?.[0] ? { image: show.artist.images[0] } : {}),
        location: {
          "@type": "MusicVenue",
          name: venueName,
          ...(city
            ? {
                address: {
                  "@type": "PostalAddress",
                  addressLocality: city,
                  ...(show.venue?.state ? { addressRegion: show.venue.state } : {}),
                  ...(show.venue?.country ? { addressCountry: show.venue.country } : {}),
                },
              }
            : {}),
        },
        performer: { "@type": "MusicGroup", name: artistName },
        ...(show.ticketUrl ? { offers: { "@type": "Offer", url: show.ticketUrl } } : {}),
      };
    } else if (venueSlug && venue) {
      const location = [venue.city, venue.state || venue.country].filter(Boolean).join(", ");
      computedTitle = `${venue.name} Concerts & Setlists${location ? ` – ${location}` : ""}`;
      computedDescription = `Browse upcoming concerts and recent setlists at ${venue.name}${location ? ` in ${location}` : ""}. Open a show to vote for the songs you want to hear.`;
      routeJsonLd = {
        "@context": "https://schema.org",
        "@type": "MusicVenue",
        name: venue.name,
        url: canonicalUrl,
        address: {
          "@type": "PostalAddress",
          ...(venue.address ? { streetAddress: venue.address } : {}),
          addressLocality: venue.city,
          ...(venue.state ? { addressRegion: venue.state } : {}),
          addressCountry: venue.country,
        },
      };
    }

    const finalTitle = title ?? computedTitle;
    const finalDescription = description ?? computedDescription;
    const rawImage = image ?? computedImage;
    const finalImage = /^https?:\/\//.test(rawImage) ? rawImage : SITE_URL + rawImage;
    const finalType = type ?? computedType;

    document.title = finalTitle;
    upsertMeta("name", "description", finalDescription);
    upsertCanonical(canonicalUrl);

    upsertMeta("property", "og:title", finalTitle);
    upsertMeta("property", "og:description", finalDescription);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:image", finalImage);
    upsertMeta("property", "og:type", finalType);

    upsertMeta("name", "twitter:title", finalTitle);
    upsertMeta("name", "twitter:description", finalDescription);
    upsertMeta("name", "twitter:image", finalImage);
    upsertMeta("name", "twitter:url", canonicalUrl);

    const isNoindexPath = NOINDEX_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    const showIsThin = Boolean(
      show && (
        show.status === "cancelled" ||
        (show.status === "completed" && !showSetlists?.some((setlist) => (setlist.actualSetlist?.length ?? 0) >= 3))
      ),
    );
    const venueIsThin = Boolean(venue && venueShows && venueShows.length === 0);
    upsertMeta("name", "robots", noindex || isNoindexPath || showIsThin || venueIsThin ? "noindex, follow" : "index, follow");

    upsertJsonLd(jsonLdString ?? (routeJsonLd ? JSON.stringify(routeJsonLd) : null));
  }, [
    location.pathname,
    artistSlug,
    showSlug,
    venueSlug,
    artist,
    show,
    venue,
    venueShows,
    showSetlists,
    title,
    description,
    image,
    type,
    noindex,
    jsonLdString,
  ]);

  // On unmount, restore defaults so routes without an SEOHead mount (/, /about,
  // /privacy, …) don't keep the previous page's canonical/OG/JSON-LD. At cleanup
  // time window.location already reflects the destination route, so the
  // canonical stays truthful there.
  useEffect(() => {
    return () => {
      const path = window.location.pathname;
      const url = SITE_URL + path;
      document.title = DEFAULT_TITLE;
      upsertMeta("name", "description", DEFAULT_DESCRIPTION);
      upsertCanonical(url);
      upsertMeta("property", "og:title", DEFAULT_TITLE);
      upsertMeta("property", "og:description", DEFAULT_DESCRIPTION);
      upsertMeta("property", "og:url", url);
      upsertMeta("property", "og:image", DEFAULT_IMAGE);
      upsertMeta("property", "og:type", "website");
      upsertMeta("name", "twitter:title", DEFAULT_TITLE);
      upsertMeta("name", "twitter:description", DEFAULT_DESCRIPTION);
      upsertMeta("name", "twitter:image", DEFAULT_IMAGE);
      upsertMeta("name", "twitter:url", url);
      const isNoindexPath = NOINDEX_PREFIXES.some((prefix) => path.startsWith(prefix));
      upsertMeta("name", "robots", isNoindexPath ? "noindex, nofollow" : "index, follow");
      upsertJsonLd(null);
    };
  }, []);

  return null;
}
