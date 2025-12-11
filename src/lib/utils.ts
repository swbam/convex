import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useEffect, useState } from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useDebounce<T extends (...args: any[]) => any>(callback: T, delay: number) {
  const [debouncedCallback, setDebouncedCallback] = useState(callback);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCallback(() => callback);
    }, delay);

    return () => clearTimeout(handler);
  }, [callback, delay]);

  return debouncedCallback;
}

// ============================================================================
// LOCATION FORMATTING - US-only, show City, ST format
// ============================================================================

// US State abbreviations mapping
const STATE_ABBREVIATIONS: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
  // Common alternate names
  'washington dc': 'DC', 'washington d.c.': 'DC', 'd.c.': 'DC',
};

/**
 * Convert state name to abbreviation
 * Already abbreviated states (2 chars) are returned as-is
 */
export function getStateAbbreviation(state: string | undefined | null): string {
  if (!state) return '';
  const trimmed = state.trim();
  
  // Already abbreviated (2 chars uppercase)
  if (trimmed.length === 2 && trimmed === trimmed.toUpperCase()) {
    return trimmed;
  }
  
  // Look up in mapping
  const abbrev = STATE_ABBREVIATIONS[trimmed.toLowerCase()];
  return abbrev || trimmed; // Fallback to original if not found
}

/**
 * Format location as "City, ST" for US venues
 * Falls back to "City" if no state available
 */
export function formatLocation(
  city: string | undefined | null,
  state: string | undefined | null,
  _country?: string | undefined | null // Ignored since US-only
): string {
  if (!city) return 'TBA';
  
  const stateAbbrev = getStateAbbreviation(state);
  if (stateAbbrev) {
    return `${city}, ${stateAbbrev}`;
  }
  
  return city;
}

// ============================================================================
// TIME FORMATTING - Show 7:00pm CT format
// ============================================================================

// US Timezone abbreviations by state (approximate, uses most common timezone for each state)
const STATE_TIMEZONES: Record<string, { abbrev: string; offset: number }> = {
  // Eastern Time (ET) - UTC-5 / UTC-4 DST
  'CT': { abbrev: 'ET', offset: -5 }, 'DE': { abbrev: 'ET', offset: -5 },
  'FL': { abbrev: 'ET', offset: -5 }, 'GA': { abbrev: 'ET', offset: -5 },
  'IN': { abbrev: 'ET', offset: -5 }, 'KY': { abbrev: 'ET', offset: -5 },
  'ME': { abbrev: 'ET', offset: -5 }, 'MD': { abbrev: 'ET', offset: -5 },
  'MA': { abbrev: 'ET', offset: -5 }, 'MI': { abbrev: 'ET', offset: -5 },
  'NH': { abbrev: 'ET', offset: -5 }, 'NJ': { abbrev: 'ET', offset: -5 },
  'NY': { abbrev: 'ET', offset: -5 }, 'NC': { abbrev: 'ET', offset: -5 },
  'OH': { abbrev: 'ET', offset: -5 }, 'PA': { abbrev: 'ET', offset: -5 },
  'RI': { abbrev: 'ET', offset: -5 }, 'SC': { abbrev: 'ET', offset: -5 },
  'VT': { abbrev: 'ET', offset: -5 }, 'VA': { abbrev: 'ET', offset: -5 },
  'WV': { abbrev: 'ET', offset: -5 }, 'DC': { abbrev: 'ET', offset: -5 },
  
  // Central Time (CT) - UTC-6 / UTC-5 DST
  'AL': { abbrev: 'CT', offset: -6 }, 'AR': { abbrev: 'CT', offset: -6 },
  'IL': { abbrev: 'CT', offset: -6 }, 'IA': { abbrev: 'CT', offset: -6 },
  'KS': { abbrev: 'CT', offset: -6 }, 'LA': { abbrev: 'CT', offset: -6 },
  'MN': { abbrev: 'CT', offset: -6 }, 'MS': { abbrev: 'CT', offset: -6 },
  'MO': { abbrev: 'CT', offset: -6 }, 'NE': { abbrev: 'CT', offset: -6 },
  'ND': { abbrev: 'CT', offset: -6 }, 'OK': { abbrev: 'CT', offset: -6 },
  'SD': { abbrev: 'CT', offset: -6 }, 'TN': { abbrev: 'CT', offset: -6 },
  'TX': { abbrev: 'CT', offset: -6 }, 'WI': { abbrev: 'CT', offset: -6 },
  
  // Mountain Time (MT) - UTC-7 / UTC-6 DST
  'AZ': { abbrev: 'MT', offset: -7 }, 'CO': { abbrev: 'MT', offset: -7 },
  'ID': { abbrev: 'MT', offset: -7 }, 'MT': { abbrev: 'MT', offset: -7 },
  'NM': { abbrev: 'MT', offset: -7 }, 'UT': { abbrev: 'MT', offset: -7 },
  'WY': { abbrev: 'MT', offset: -7 },
  
  // Pacific Time (PT) - UTC-8 / UTC-7 DST
  'CA': { abbrev: 'PT', offset: -8 }, 'NV': { abbrev: 'PT', offset: -8 },
  'OR': { abbrev: 'PT', offset: -8 }, 'WA': { abbrev: 'PT', offset: -8 },
  
  // Alaska Time (AKT) - UTC-9
  'AK': { abbrev: 'AKT', offset: -9 },
  
  // Hawaii Time (HT) - UTC-10
  'HI': { abbrev: 'HT', offset: -10 },
};

/**
 * Format time from 24h format (e.g., "19:00") to 12h format with timezone
 * Returns "7:00pm ET" format
 */
export function formatShowTime(
  startTime: string | undefined | null,
  state?: string | undefined | null
): string | null {
  if (!startTime) return null;
  
  // Parse the time (expected format: "HH:MM" or "HH:MM:SS")
  const parts = startTime.split(':');
  if (parts.length < 2) return startTime; // Return original if can't parse
  
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  
  if (isNaN(hours)) return startTime;
  
  // Convert to 12-hour format
  const isPM = hours >= 12;
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = isPM ? 'pm' : 'am';
  
  // Get timezone abbreviation from state
  const stateAbbrev = getStateAbbreviation(state);
  const tzInfo = stateAbbrev ? STATE_TIMEZONES[stateAbbrev] : null;
  const tz = tzInfo?.abbrev || '';
  
  // Format: "7:00pm ET" or "7:00pm" if no timezone
  const timeStr = `${displayHour}:${minutes}${ampm}`;
  return tz ? `${timeStr} ${tz}` : timeStr;
}

/**
 * Format time without timezone (for compact displays)
 * Returns "7:00pm" format
 */
export function formatTimeCompact(startTime: string | undefined | null): string | null {
  if (!startTime) return null;
  
  const parts = startTime.split(':');
  if (parts.length < 2) return startTime;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  
  if (isNaN(hours)) return startTime;
  
  const isPM = hours >= 12;
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = isPM ? 'pm' : 'am';
  
  return `${displayHour}:${minutes}${ampm}`;
}
