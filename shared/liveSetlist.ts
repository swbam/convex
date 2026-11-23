// Performance metadata belongs to a performance, never to the artist's song catalog.
export const DMB_MBID = "07e748f1-075e-428d-85dc-ce3be434e906";
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const LIVE_REQUEST_CAP = 120;
export type Performance = {
  title: string; setNumber: number; encore: boolean;
  guest?: string; cover?: string; notes?: string;
};
export function isDmb(artist: { slug?: string; setlistfmMbid?: string; name?: string } | null) {
  return !!artist && artist.slug === "dave-matthews-band" && artist.setlistfmMbid === DMB_MBID;
}
export function parsePerformances(data: unknown): Performance[] {
  const value = data as { sets?: { set?: unknown }; set?: unknown } | null;
  const sets = value?.sets?.set ?? value?.set;
  if (!Array.isArray(sets) || sets.length > 30) throw new Error("Invalid performance sections");
  const rows: Performance[] = [];
  const text = (s: unknown, max = 500) => typeof s === "string" && s.trim() ? s.trim().slice(0, max) : undefined;
  for (const [index, section] of sets.entries()) {
    if (!section || !Array.isArray(section.song)) throw new Error("Invalid performance songs");
    for (const song of section.song) {
      if (song.tape === true || song.tape === "true") continue;
      const title = text(song.name);
      if (!title) throw new Error("Missing performance title");
      rows.push({ title, setNumber: index + 1,
        encore: Number(section.encore) > 0 || section.encore === true || section.encore === "true",
        ...(text(song.with?.name) ? { guest: text(song.with.name) } : {}),
        ...(text(song.cover?.name) ? { cover: text(song.cover.name) } : {}),
        ...(text(song.info, 2000) ? { notes: text(song.info, 2000) } : {}),
      });
      if (rows.length > 200) throw new Error("Performance exceeds safety limit");
    }
  }
  return rows;
}
// Fixed follow-up slots prevent delayed jobs from starting another long polling window.
export function nextLiveCheck(start: number, now: number, lastChangedAt: number | undefined, failures = 0): number | undefined {
  const end = start + 4 * HOUR;
  if (now < start - 30 * MINUTE) return start - 30 * MINUTE;
  if (now < start) return Math.min(start, now + 10 * MINUTE);
  if (now < end) {
    const delay = failures ? Math.min(30, 5 * 2 ** Math.min(failures - 1, 3)) * MINUTE
      : lastChangedAt !== undefined && now - lastChangedAt < 15 * MINUTE ? 3 * MINUTE : 5 * MINUTE;
    return Math.min(end, now + delay);
  }
  return [end + 30 * MINUTE, end + 2 * HOUR, start + 24 * HOUR, start + 72 * HOUR].find(at => at > now);
}
export function providerRetryAt(now: number, retryAfter: string | null): number {
  const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : 0;
  const date = retryAfter && !seconds ? Date.parse(retryAfter) : 0;
  return Math.max(now + 15 * MINUTE, seconds ? now + seconds : Number.isFinite(date) ? date : 0);
}
