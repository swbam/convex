// Data validation helpers for external API data

export function validateDateString(date: unknown): string | undefined {
  if (typeof date !== 'string') return undefined;

  const trimmed = date.trim();
  // ISO 8601 date format: YYYY-MM-DD
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!isoDatePattern.test(trimmed)) return undefined;

  // Verify it's a valid date
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return undefined;

  return trimmed;
}

export function validateTimeString(time: unknown): string | undefined {
  if (typeof time !== 'string') return undefined;

  const trimmed = time.trim();
  // HH:mm format
  const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

  const match = trimmed.match(timePattern);
  if (!match) return undefined;

  // Normalize to HH:mm format
  const hours = match[1].padStart(2, '0');
  const minutes = match[2];

  return `${hours}:${minutes}`;
}

export function validateNumber(value: unknown, min?: number, max?: number): number | undefined {
  const num = typeof value === 'number' ? value : parseFloat(String(value));

  if (!Number.isFinite(num)) return undefined;
  if (min !== undefined && num < min) return undefined;
  if (max !== undefined && num > max) return undefined;

  return num;
}

export function validateLatitude(value: unknown): number | undefined {
  return validateNumber(value, -90, 90);
}

export function validateLongitude(value: unknown): number | undefined {
  return validateNumber(value, -180, 180);
}

export function validateUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

export function validateEmail(email: unknown): string | undefined {
  if (typeof email !== 'string') return undefined;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email.trim()) ? email.trim().toLowerCase() : undefined;
}

export function validateNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function validatePositiveInteger(value: unknown): number | undefined {
  const num = validateNumber(value, 0);
  if (num === undefined) return undefined;
  return Number.isInteger(num) ? num : undefined;
}

export function validateSpotifyId(id: unknown): string | undefined {
  if (typeof id !== 'string') return undefined;
  // Spotify IDs are 22 character base62 strings
  const spotifyIdPattern = /^[a-zA-Z0-9]{22}$/;
  return spotifyIdPattern.test(id) ? id : undefined;
}

export function validateTicketmasterId(id: unknown): string | undefined {
  if (typeof id !== 'string') return undefined;
  // Ticketmaster IDs are alphanumeric with possible hyphens
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Rate limit tracking helpers
const apiCallTimestamps: Map<string, number[]> = new Map();

export function checkRateLimit(apiName: string, maxCalls: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = apiCallTimestamps.get(apiName) || [];

  // Remove timestamps outside the window
  const validTimestamps = timestamps.filter(ts => now - ts < windowMs);

  // Check if we're at the limit
  if (validTimestamps.length >= maxCalls) {
    console.warn(`⚠️  Rate limit reached for ${apiName}: ${validTimestamps.length}/${maxCalls} calls in ${windowMs}ms window`);
    return false;
  }

  // Record this call
  validTimestamps.push(now);
  apiCallTimestamps.set(apiName, validTimestamps);

  return true;
}

export function getRateLimitStatus(apiName: string, maxCalls: number, windowMs: number): {
  callsRemaining: number;
  resetInMs: number;
  isLimited: boolean;
} {
  const now = Date.now();
  const timestamps = apiCallTimestamps.get(apiName) || [];
  const validTimestamps = timestamps.filter(ts => now - ts < windowMs);

  const callsRemaining = Math.max(0, maxCalls - validTimestamps.length);
  const oldestTimestamp = validTimestamps[0];
  const resetInMs = oldestTimestamp ? Math.max(0, windowMs - (now - oldestTimestamp)) : 0;

  return {
    callsRemaining,
    resetInMs,
    isLimited: callsRemaining === 0,
  };
}

// Validation result type for better error handling
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export function validateVenueData(data: any): ValidationResult<{
  name: string;
  city: string;
  state?: string;
  country: string;
  address?: string;
  capacity?: number;
  lat?: number;
  lng?: number;
  postalCode?: string;
  ticketmasterId?: string;
}> {
  const name = validateNonEmptyString(data?.name);
  const city = validateNonEmptyString(data?.city);
  const country = validateNonEmptyString(data?.country);

  if (!name) return { success: false, error: 'Invalid venue name' };
  if (!city) return { success: false, error: 'Invalid city name' };
  if (!country) return { success: false, error: 'Invalid country' };

  return {
    success: true,
    data: {
      name,
      city,
      country,
      state: validateNonEmptyString(data?.state),
      address: validateNonEmptyString(data?.address),
      capacity: validatePositiveInteger(data?.capacity),
      lat: validateLatitude(data?.lat),
      lng: validateLongitude(data?.lng),
      postalCode: validateNonEmptyString(data?.postalCode),
      ticketmasterId: validateTicketmasterId(data?.ticketmasterId),
    },
  };
}

export function validateShowData(data: any): ValidationResult<{
  date: string;
  startTime?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  ticketUrl?: string;
}> {
  const date = validateDateString(data?.date);
  if (!date) return { success: false, error: 'Invalid date format' };

  const status = ['upcoming', 'completed', 'cancelled'].includes(data?.status)
    ? data.status
    : 'upcoming';

  return {
    success: true,
    data: {
      date,
      status,
      startTime: validateTimeString(data?.startTime),
      ticketUrl: validateUrl(data?.ticketUrl),
    },
  };
}
