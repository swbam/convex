export function normalizeMusicName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function venueNamesMatch(a: string, b: string): boolean {
  const left = normalizeMusicName(a), right = normalizeMusicName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const [short, long] = left.length < right.length ? [left, right] : [right, left];
  return short.length >= 5 && (` ${long} `).includes(` ${short} `);
}

// Do not attach the adjacent night's concert or the first fuzzy search result.
export function selectSetlistMatch(candidates: any[], expected: {
  artistName: string; artistMbid?: string; venueName: string; city: string; date: string;
}): any | null {
  const [year, month, day] = expected.date.split("-");
  const matches = candidates.filter(candidate => {
    const artistMatches = expected.artistMbid && candidate.artist?.mbid
      ? expected.artistMbid === candidate.artist.mbid
      : normalizeMusicName(candidate.artist?.name ?? "") === normalizeMusicName(expected.artistName);
    return artistMatches && candidate.eventDate === `${day}-${month}-${year}` &&
      normalizeMusicName(candidate.venue?.city?.name ?? "") === normalizeMusicName(expected.city) &&
      venueNamesMatch(candidate.venue?.name ?? "", expected.venueName);
  });
  return matches.length === 1 ? matches[0] : null;
}
