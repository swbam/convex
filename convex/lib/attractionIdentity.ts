import { isFestivalEvent } from "./festivalIdentity";

// Bump when decisions change, so previously reviewed provider metadata can be retried.
export const ATTRACTION_POLICY_VERSION = 2;
export const attractionFingerprint = (name: string, genres: string[] = []) =>
  JSON.stringify([name.trim().toLowerCase(), [...new Set(genres.map(g => g.trim().toLowerCase()))].sort()]);

export function classifyAttraction(name: string, genres: string[] = []): {
  decision: "artist" | "festival" | "excluded" | "review"; reason: string;
} {
  if (isFestivalEvent({ name }) || /\bfest(?:ival)?\b/i.test(name))
    return { decision: "festival", reason: "Festival editions use the festival directory." };
  // Match explicit event formats, not performer names or musical genres.
  const eventFormat = /\b(film with live|film screening|movie screening|live to film|twilight in concert|dance party|silent disco|drag brunch|comedy night|comedy show|game night|on ice|magic show)\b/i;
  const nonMusic = new Set(["comedy", "theatre", "theater", "broadway", "spoken word", "podcast", "sports", "wrestling"]);
  const normalized = genres.map(g => g.trim().toLowerCase()).filter(g => !["", "undefined", "other"].includes(g));
  if (eventFormat.test(name) || (normalized.length > 0 && normalized.every(g => nonMusic.has(g))))
    return { decision: "excluded", reason: "Provider metadata identifies a non-artist event format." };
  if (!normalized.length)
    return { decision: "review", reason: "Provider genre evidence is missing; confirm the performer identity." };
  return { decision: "artist", reason: "Musical performer; classical, orchestral and holiday repertoire are supported." };
}

export function isConcertDiscoveryCandidate(name: string, genres: string[] = []) {
  const decision = classifyAttraction(name, genres).decision;
  // Existing named performers may have incomplete metadata; identity creation is stricter.
  return decision === "artist" || decision === "review";
}

