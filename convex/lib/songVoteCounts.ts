import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { isEligiblePrediction, songKey, summarizeRequests } from "./predictions";

type VoteCount = { songTitle: string; upvotes: number };

export async function getRequestCounts(ctx: QueryCtx, setlist: Doc<"setlists">, maxRows?: number): Promise<VoteCount[]> {
  const show = await ctx.db.get(setlist.showId);
  if (!show || setlist.isOfficial) return [];
  if (setlist.voteCountsReady && setlist.voteCountsSchedule === scheduleKey(show)) {
    const query = ctx.db.query("songVoteCounts").withIndex("by_setlist", q => q.eq("setlistId", setlist._id));
    const rows = maxRows ? await query.take(maxRows + 1) : await query.collect();
    if (maxRows && rows.length > maxRows) throw new Error("Request snapshot exceeds its bounded limit");
    return rows;
  }
  // Legacy fallback until the idempotent backfill runs. Never silently truncate totals.
  const votes = await ctx.db.query("songVotes").withIndex("by_setlist", q => q.eq("setlistId", setlist._id)).take(3001);
  if (votes.length > 3000) throw new Error("Vote totals are being updated. Please try again shortly.");
  const seen = new Set<string>();
  const rows = votes.filter(vote => {
    const key = `${vote.userId}:${songKey(vote.songTitle)}`;
    if (seen.has(key) || !isEligiblePrediction(vote, setlist, show)) return false;
    seen.add(key);
    return true;
  }).map(vote => ({ songTitle: vote.songTitle, upvotes: 1 }));
  return [...summarizeRequests(rows).requested.values()];
}

export async function initializeVoteCounts(ctx: MutationCtx, setlist: Doc<"setlists">) {
  const show = await ctx.db.get(setlist.showId);
  if (!show) return;
  if (setlist.voteCountsReady && setlist.voteCountsSchedule === scheduleKey(show)) return;
  const counts = await getRequestCounts(ctx, setlist);
  const existing = await ctx.db.query("songVoteCounts").withIndex("by_setlist", q => q.eq("setlistId", setlist._id)).collect();
  for (const row of existing) await ctx.db.delete(row._id);
  for (const row of counts) await ctx.db.insert("songVoteCounts", { setlistId: setlist._id, songKey: songKey(row.songTitle), ...row });
  await ctx.db.patch(setlist._id, { voteCountsReady: true, voteCountsSchedule: scheduleKey(show), songVoteCount: counts.reduce((sum, row) => sum + row.upvotes, 0) });
}

export async function updateVoteCount(ctx: MutationCtx, setlistId: Id<"setlists">, title: string, delta: number) {
  const key = songKey(title);
  const row = await ctx.db.query("songVoteCounts").withIndex("by_setlist_song_key", q => q.eq("setlistId", setlistId).eq("songKey", key)).first();
  const next = Math.max(0, (row?.upvotes ?? 0) + delta);
  if (row) {
    if (next === 0) await ctx.db.delete(row._id);
    else await ctx.db.patch(row._id, { upvotes: next });
  } else if (next > 0) await ctx.db.insert("songVoteCounts", { setlistId, songKey: key, songTitle: title, upvotes: next });
  const setlist = await ctx.db.get(setlistId);
  if (setlist) await ctx.db.patch(setlistId, { songVoteCount: Math.max(0, (setlist.songVoteCount ?? 0) + delta) });
}

export async function calculateFanAccuracy(ctx: QueryCtx, setlist: Doc<"setlists">, actual: { title: string }[]) {
  return summarizeRequests(await getRequestCounts(ctx, setlist), actual).accuracy;
}

export async function getUserPredictionStats(ctx: QueryCtx, votes: Doc<"songVotes">[]) {
  const lists = new Map<Id<"setlists">, Doc<"setlists"> | null>();
  const shows = new Map<Id<"shows">, Doc<"shows"> | null>();
  const actualByShow = new Map<Id<"shows">, Set<string>>();
  let correct = 0, evaluated = 0;
  const seen = new Set<string>();
  for (const vote of votes) {
    if (!lists.has(vote.setlistId)) lists.set(vote.setlistId, await ctx.db.get(vote.setlistId));
    const list = lists.get(vote.setlistId);
    if (!list) continue;
    if (!shows.has(list.showId)) shows.set(list.showId, await ctx.db.get(list.showId));
    const show = shows.get(list.showId);
    const key = `${list.showId}:${songKey(vote.songTitle)}`;
    if (!show || seen.has(key) || !isEligiblePrediction(vote, list, show)) continue;
    if (!actualByShow.has(list.showId)) {
      const official = await ctx.db.query("setlists").withIndex("by_show", q => q.eq("showId", list.showId)).filter(q => q.eq(q.field("isOfficial"), true)).first();
      const actual = official?.actualSetlist?.length ? official.actualSetlist : list.actualSetlist ?? [];
      actualByShow.set(list.showId, new Set(actual.map(song => songKey(song.title))));
    }
    const actual = actualByShow.get(list.showId)!;
    if (!actual.size) continue;
    seen.add(key);
    evaluated++;
    if (actual.has(songKey(vote.songTitle))) correct++;
  }
  return { correct, evaluated, accuracy: evaluated ? correct / evaluated : null };
}

function scheduleKey(show: { date: string; startsAt?: number; timeZone?: string }) {
  return `${show.date}|${show.startsAt ?? ""}|${show.timeZone ?? ""}`;
}
