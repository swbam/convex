import { normalizeMusicName } from "./setlistMatch";
import { hasVotingClosed, type ShowTiming } from "./showTiming";

// Keep meaningful subtitles; only remove provider version/featured-artist metadata.
export function songKey(title: string): string {
  return normalizeMusicName(title
    .replace(/\s*\((?:feat\.?|ft\.?|featuring)\s+[^)]*\)/gi, "")
    .replace(/\s*[-–—]\s*(?:(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?|(?:radio|single)\s+(?:edit|version))\s*$/gi, ""));
}

export const MIN_COMMUNITY_VOTES = 5;
export const MIN_COMMUNITY_SONGS = 3;

export function summarizeRequests(rows: { songTitle: string; upvotes: number }[], actual: { title: string }[] = []) {
  const requested = new Map<string, { songTitle: string; upvotes: number }>();
  for (const row of rows) {
    const key = songKey(row.songTitle);
    if (!key || row.upvotes <= 0) continue;
    const previous = requested.get(key);
    requested.set(key, { songTitle: previous?.songTitle ?? row.songTitle, upvotes: (previous?.upvotes ?? 0) + row.upvotes });
  }
  const played = new Set(actual.map(song => songKey(song.title)).filter(Boolean));
  const matched = [...requested.keys()].filter(key => played.has(key)).length;
  const totalVotes = [...requested.values()].reduce((sum, row) => sum + row.upvotes, 0);
  return {
    requested, totalVotes, requestedSongs: requested.size, matched,
    accuracy: requested.size && played.size ? Math.round(matched / requested.size * 100) : null,
    hasCommunityData: totalVotes >= MIN_COMMUNITY_VOTES && requested.size >= MIN_COMMUNITY_SONGS,
  };
}

export function isEligiblePrediction(vote: { songTitle: string; createdAt: number }, setlist: {
  isOfficial: boolean; songs: { title: string }[];
}, show: ShowTiming): boolean {
  const key = songKey(vote.songTitle);
  return !setlist.isOfficial && !!key && !hasVotingClosed(show, vote.createdAt) &&
    setlist.songs.some(song => songKey(song.title) === key);
}
