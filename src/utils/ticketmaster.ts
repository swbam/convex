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

/**
 * Generate a unique click ID for tracking
 * Format similar to Impact Radius: UCkVKfRd9xycR4LzAlwNlWiaUkp3wT2PISiJ280
 */
function generateClickId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 40; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Build Ticketmaster affiliate URL with proper tracking
 * 
 * @param ticketUrl - Base Ticketmaster event URL
 * @returns URL with affiliate tracking parameters for commission
 */
export function buildTicketmasterAffiliateUrl(ticketUrl?: string): string {
  if (!ticketUrl) {
    return `https://www.ticketmaster.com/?irgwc=1&clickid=${generateClickId()}&camefrom=${AFFILIATE_CONFIG.camefrom}&impradid=${AFFILIATE_CONFIG.impradid}&REFERRAL_ID=${AFFILIATE_CONFIG.REFERRAL_ID}&wt.mc_id=${AFFILIATE_CONFIG.wtMcId}&utm_source=${AFFILIATE_CONFIG.utmSource}&impradname=${AFFILIATE_CONFIG.impradname}&utm_medium=${AFFILIATE_CONFIG.utmMedium}&ircid=${AFFILIATE_CONFIG.ircid}`;
  }
  
  // Parse existing URL
  const url = new URL(ticketUrl);
  
  // Add affiliate tracking parameters
  url.searchParams.set('irgwc', '1');
  url.searchParams.set('clickid', generateClickId());
  url.searchParams.set('camefrom', AFFILIATE_CONFIG.camefrom);
  url.searchParams.set('impradid', AFFILIATE_CONFIG.impradid);
  url.searchParams.set('REFERRAL_ID', AFFILIATE_CONFIG.REFERRAL_ID);
  url.searchParams.set('wt.mc_id', AFFILIATE_CONFIG.wtMcId);
  url.searchParams.set('utm_source', AFFILIATE_CONFIG.utmSource);
  url.searchParams.set('impradname', AFFILIATE_CONFIG.impradname);
  url.searchParams.set('utm_medium', AFFILIATE_CONFIG.utmMedium);
  url.searchParams.set('ircid', AFFILIATE_CONFIG.ircid);
  
  return url.toString();
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
