import { songKey } from "./predictions";

// Explicit, reviewed repertoire relationships, never inferred from shared members
// or a fuzzy artist-name search. Source: https://open.spotify.com/artist/68xuC1qXRhCUvGd4SSM655
export const RELATED_REPERTOIRE: Record<string, { id: string; name: string }[]> = {
  "0hEurMDQu99nJRq8pTxO14": [{ id: "68xuC1qXRhCUvGd4SSM655", name: "John Mayer Trio" }],
};

// Strip recording metadata only after an explicit delimiter; keep meaningful
// titles such as Live Forever and Slow Dancing in a Burning Room intact.
export function repertoireTitle(name: string): string | null {
  const title = name
    .replace(/\s*[-–—]\s*(?:live(?:\s.*)?|acoustic(?:\s.*)?|unplugged(?:\s.*)?|(?:home\s+)?demo(?:\s.*)?|instrumental|acapella|a cappella|(?:\d{4}\s+)?remaster(?:ed)?(?:\s.*)?|(?:radio|single)\s+(?:edit|version))$/i, "")
    .replace(/\s*[([](?:live(?:\s[^)\]]*)?|acoustic(?:\s[^)\]]*)?|unplugged|(?:home\s+)?demo|instrumental|acapella|a cappella|(?:\d{4}\s+)?remaster(?:ed)?(?:\s[^)\]]*)?)[)\]]/gi, "")
    .trim();
  if (!title || title.length > 200 || title.includes(" / ")) return null;
  if (/^(intro|outro|interlude|skit|prelude|segue)$/i.test(title) || /\b(?:intro|medley)$/i.test(title)) return null;
  if (/\b(?:commentary|interview|karaoke|backing track|voice memo)\b/i.test(name)) return null;
  if (/(?:[-–—]|[([]).*\b(?:remix|rmx)\b/i.test(name)) return null;
  return title;
}

export function selectRepertoireTracks(tracks: any[], artistIds: Set<string>): any[] {
  const unique = new Map<string, any>();
  // Studio recordings first; live-only songs and bonus material remain eligible.
  const ranked = [...tracks].sort((a, b) =>
    Number(/\blive\b/i.test(a.name + " " + a.album_info.name)) -
    Number(/\blive\b/i.test(b.name + " " + b.album_info.name)));
  for (const track of ranked) {
    if (!track.id || !track.artists?.some((a: any) => artistIds.has(a.id))) continue;
    const title = repertoireTitle(track.name);
    if (!title) continue;
    const key = songKey(title);
    if (!unique.has(key)) unique.set(key, { ...track, repertoireTitle: title });
  }
  return [...unique.values()];
}
