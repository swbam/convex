/**
 * Ticketmaster Affiliate Tracking Utilities
 * 
 * Build proper affiliate URLs for commission tracking
 */

// Your Ticketmaster affiliate parameters from Impact Radius
const AFFILIATE_CONFIG = {
  impradid: '6463123',           // Your Impact Radius Ad ID
  impradname: 'setlists.live',   // Your site name
  camefrom: 'CFC_BUYAT_6463123', // Campaign source
  REFERRAL_ID: 'tmfeedbuyat6463123',
  wtMcId: 'aff_BUYAT_6463123',   // Web tracking marketing campaign ID
  utmSource: '6463123-setlists.live',
  utmMedium: 'affiliate',
  ircid: '4272',                 // Impact Radius Campaign ID
};

const TICKETMASTER_HOME = 'https://www.ticketmaster.com/';
const TICKETMASTER_DOMAIN_SUFFIXES = [
  'at',
  'be',
  'ca',
  'ch',
  'co.nz',
  'co.uk',
  'co.za',
  'com',
  'com.au',
  'com.br',
  'com.mx',
  'cz',
  'de',
  'dk',
  'es',
  'fi',
  'fr',
  'ie',
  'it',
  'nl',
  'no',
  'pl',
  'se',
  'sg',
];

function isTrustedTicketmasterUrl(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  const hostname = url.hostname.toLowerCase();
  return TICKETMASTER_DOMAIN_SUFFIXES.some(
    (suffix) =>
      hostname === `ticketmaster.${suffix}` ||
      hostname.endsWith(`.ticketmaster.${suffix}`)
  );
}

function addAffiliateParameters(url: URL): URL {
  // Impact click IDs must come from the network. Preserve a genuine incoming
  // identifier; never fabricate a value that looks like tracked attribution.
  url.searchParams.set('camefrom', AFFILIATE_CONFIG.camefrom);
  url.searchParams.set('impradid', AFFILIATE_CONFIG.impradid);
  url.searchParams.set('REFERRAL_ID', AFFILIATE_CONFIG.REFERRAL_ID);
  url.searchParams.set('wt.mc_id', AFFILIATE_CONFIG.wtMcId);
  url.searchParams.set('utm_source', AFFILIATE_CONFIG.utmSource);
  url.searchParams.set('impradname', AFFILIATE_CONFIG.impradname);
  url.searchParams.set('utm_medium', AFFILIATE_CONFIG.utmMedium);
  url.searchParams.set('ircid', AFFILIATE_CONFIG.ircid);
  return url;
}

/**
 * Build Ticketmaster affiliate URL with proper tracking
 * 
 * @param ticketUrl - Base Ticketmaster event URL
 * @returns URL with affiliate tracking parameters for commission
 */
export function buildTicketmasterAffiliateUrl(ticketUrl?: string): string {
  let url = new URL(TICKETMASTER_HOME);

  if (ticketUrl) {
    try {
      const candidate = new URL(ticketUrl);
      if (isTrustedTicketmasterUrl(candidate)) {
        url = candidate;
      }
    } catch {
      // Keep the safe Ticketmaster fallback for malformed provider data.
    }
  }

  return addAffiliateParameters(url).toString();
}

/**
 * Get artist image URL, preferring high-quality landscape images
 */
export function getArtistCoverImage(images?: string[]): string | undefined {
  // For Ticketmaster/Spotify, first image is usually highest quality
  return images?.[0];
}

/**
 * Get blurred version of image for background
 */
export function getBlurredBackground(imageUrl?: string): string {
  if (!imageUrl) return '';
  // For now, use the same image (browsers will blur it with CSS)
  // In production, you could use an image service to pre-blur
  return imageUrl;
}

export interface TicketTracking {
  origin?: string;
  showId?: string;
  placement?: string;
  impactLink?: string;
}

type TicketDestination = {
  href: string;
  provider: string;
  affiliateTagged: boolean;
  tracking: "impact" | "direct_tags" | "provider";
};

function approvedImpactLink(raw?: string): URL | undefined {
  if (!raw) return;
  try {
    const url = new URL(raw);
    // An operator-supplied public tracking link may use an Impact branded domain.
    if (url.protocol === "https:" && !url.username && !url.password && !url.port &&
        !isTrustedTicketmasterUrl(url) && /^\/c\/\d+\/\d+\/\d+\/?$/.test(url.pathname)) return url;
  } catch { /* Incomplete configuration retains the existing event link. */ }
}

function addReportingIds(url: URL, tracking: TicketTracking) {
  for (const [key, value] of [["subId1", tracking.origin], ["subId2", tracking.showId], ["subId3", tracking.placement]] as const) {
    if (value && /^[a-z0-9_-]{1,64}$/i.test(value) && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return url.toString();
}

// Festival providers may supply their own ticketing or official website URL.
export function resolveTicketLink(raw?: string, tracking: TicketTracking = {}): TicketDestination | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const base = approvedImpactLink(tracking.impactLink ?? import.meta.env.VITE_TICKETMASTER_US_IMPACT_LINK);
    if (base) {
      if (url.origin === base.origin && url.pathname === base.pathname) {
        return { href: addReportingIds(url, tracking), provider: "ticketmaster", affiliateTagged: true, tracking: "impact" };
      }
      // Keep network-issued click IDs intact. The US agreement applies only to US event destinations.
      const isUsEvent = /^(www\.)?ticketmaster\.com$/.test(url.hostname) && /\/event\/[^/]+/i.test(url.pathname);
      const networkClick = ["irclickid", "clickid", "irgwc"].some(key => url.searchParams.has(key));
      if (isUsEvent && !networkClick) {
        base.searchParams.set("u", url.toString());
        return { href: addReportingIds(base, tracking), provider: "ticketmaster", affiliateTagged: true, tracking: "impact" };
      }
    }
    if (isTrustedTicketmasterUrl(url)) {
      return { href: addAffiliateParameters(url).toString(), provider: "ticketmaster", affiliateTagged: true, tracking: "direct_tags" };
    }
    return { href: url.toString(), provider: url.hostname.replace(/^www\./, ""), affiliateTagged: false, tracking: "provider" };
  } catch {
    return null;
  }
}
