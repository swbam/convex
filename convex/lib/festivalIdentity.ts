export function normalizeFestivalText(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/\b20\d{2}\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchesFestivalEvent(festival: { name: string; location: string; startDate: string; endDate: string }, event: any) {
  const name = normalizeFestivalText(festival.name);
  const eventName = normalizeFestivalText(String(event.name ?? ""));
  const date = event.dates?.start?.localDate;
  const venue = event._embedded?.venues?.[0];
  const [city, state] = festival.location.split(",").map(normalizeFestivalText);
  return name.length >= 3 && (` ${eventName} `).includes(` ${name} `) &&
    typeof date === "string" && date >= festival.startDate && date <= festival.endDate &&
    !!city && city === normalizeFestivalText(venue?.city?.name ?? "") &&
    (!state || state === normalizeFestivalText(venue?.state?.stateCode ?? ""));
}

export function festivalDay(start: string, date: string) {
  return Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000) + 1;
}

const KNOWN_FESTIVAL_PATTERNS = [
  /\brailbird\b/i,
  /\bcoachella\b/i,
  /\bbonnaroo\b/i,
  /\blollapalooza\b/i,
  /\bstagecoach\b/i,
  /\bbottlerock\b/i,
  /\belectric forest\b/i,
  /\bedc\b/i,
  /\bultra\s+(music\s+)?festival\b/i,
  /\bgovernors\s+ball\b/i,
  /\bfirefly\s+(music\s+)?festival\b/i,
  /\boutside\s+lands\b/i,
  /\brolling\s+loud\b/i,
  /\bsummerfest\b/i,
  /\briot\s+fest\b/i,
  /\bshaky\s+knees\b/i,
  /\bhangout\s+(music\s+)?fest/i,
  /\bpitchfork\s+(music\s+)?fest/i,
  /\blife\s+is\s+beautiful\b/i,
  /\bwhen\s+we\s+were\s+young\b/i,
  /\bacl\s+fest/i,
  /\baustin\s+city\s+limits\b/i,
  /\bsxsw\b/i,
];

/**
 * Detect if a Ticketmaster event is a music festival
 */
export function isFestivalEvent(event: any): boolean {
  const eventName = String(event.name || "").toLowerCase();
  // A venue name is not evidence that every concert there is a festival.
  if (/after.?party|after.?show|fest nights|late night|festival energy|benefit concert|parking|shuttle|hotel|camping|festival of lights/i.test(eventName)) return false;
  if (/^(shaky knees|riot fest|coachella|lollapalooza|bonnaroo)\s+presents\b/i.test(eventName)) return false;
  const segments = (event.classifications || []).map((c: any) => String(c.segment?.name || "").toLowerCase()).filter(Boolean);
  if (segments.length && !segments.includes("music")) return false;

  // Check for "festival" in the name (common pattern)
  if (/\bfestival\b/i.test(eventName) || /\bfest\b/i.test(eventName)) {
    // Exclude false positives like "Festival of Lights" or non-music
    const isNonMusic = /\b(lights?|food|beer|wine|film|comedy|chicken)\s*(festival|fest)\b/i.test(eventName);
    if (!isNonMusic) return true;
  }

  // Check against known festival patterns
  for (const pattern of KNOWN_FESTIVAL_PATTERNS) {
    if (pattern.test(eventName)) {
      return true;
    }
  }

  // Check Ticketmaster classifications
  const classifications = event.classifications || [];
  for (const classification of classifications) {
    const genreName = String(classification.genre?.name || "").toLowerCase();
    const subGenreName = String(classification.subGenre?.name || "").toLowerCase();
    const segmentName = String(classification.segment?.name || "").toLowerCase();

    if (genreName === "festival" || subGenreName === "festival") {
      return true;
    }

    // Music segment with festival in type
    if (segmentName === "music" && /festival/i.test(String(classification.type?.name || ""))) {
      return true;
    }
  }

  return false;
}


export function isFestivalListed(f: { name: string; discoveryState?: string }) {
  return f.discoveryState ? f.discoveryState === "listed" : isFestivalEvent({ name: f.name });
}
