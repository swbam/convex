// Prefer the most recently updated official import. Older records also copied
// confirmed songs onto the shared prediction; that is a legacy fallback only.
export function selectOfficialSetlist<T extends { isOfficial: boolean; actualSetlist?: unknown[]; lastUpdated?: number; _creationTime: number }>(lists: T[]): T | null {
  const candidates = lists.filter(list => list.actualSetlist?.length);
  return candidates.sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial) || (b.lastUpdated ?? b._creationTime) - (a.lastUpdated ?? a._creationTime))[0] ?? null;
}
