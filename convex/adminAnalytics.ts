import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./admin";

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function fillDays(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export const getDashboard = query({
  args: { days: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const days = Math.max(1, Math.min(90, args.days ?? 30));
    const endMs = Date.now();
    const startMs = endMs - days * 24 * 60 * 60 * 1000;

    const dayKeys = fillDays(days);

    const signupsByDay: Record<string, { total: number; spotifyConnected: number }> = {};
    const votesByDay: Record<string, number> = {};
    const songVotesByDay: Record<string, number> = {};
    const cronByDay: Record<string, { success: number; failure: number; skipped: number }> = {};
    const errorsByDay: Record<string, { error: number; warning: number; info: number }> = {};

    for (const k of dayKeys) {
      signupsByDay[k] = { total: 0, spotifyConnected: 0 };
      votesByDay[k] = 0;
      songVotesByDay[k] = 0;
      cronByDay[k] = { success: 0, failure: 0, skipped: 0 };
      errorsByDay[k] = { error: 0, warning: 0, info: 0 };
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_created_at", (q) => q.gte("createdAt", startMs))
      .order("asc")
      .collect();

    for (const u of users) {
      const k = dayKey(u.createdAt);
      if (!signupsByDay[k]) continue;
      signupsByDay[k].total += 1;
      if (u.spotifyId) signupsByDay[k].spotifyConnected += 1;
    }

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_created_at", (q) => q.gte("createdAt", startMs))
      .order("asc")
      .collect();

    for (const vte of votes) {
      const k = dayKey(vte.createdAt);
      if (!votesByDay[k]) continue;
      votesByDay[k] += 1;
    }

    const svs = await ctx.db
      .query("songVotes")
      .withIndex("by_created_at", (q) => q.gte("createdAt", startMs))
      .order("asc")
      .collect();

    for (const sv of svs) {
      const k = dayKey(sv.createdAt);
      if (!songVotesByDay[k]) continue;
      songVotesByDay[k] += 1;
    }

    const cronRuns = await ctx.db
      .query("cronRuns")
      .withIndex("by_started_at", (q) => q.gte("startedAt", startMs))
      .order("asc")
      .take(1000);

    for (const run of cronRuns) {
      const k = dayKey(run.startedAt);
      if (!cronByDay[k]) continue;
      if (run.status === "success") cronByDay[k].success += 1;
      else if (run.status === "failure") cronByDay[k].failure += 1;
      else if (run.status === "skipped") cronByDay[k].skipped += 1;
    }

    const errors = await ctx.db
      .query("errorLogs")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", startMs))
      .order("asc")
      .take(1000);

    for (const e of errors) {
      const k = dayKey(e.timestamp);
      if (!errorsByDay[k]) continue;
      if (e.severity === "error") errorsByDay[k].error += 1;
      else if (e.severity === "warning") errorsByDay[k].warning += 1;
      else errorsByDay[k].info += 1;
    }

    const topArtistsRaw = await ctx.db
      .query("artists")
      .withIndex("by_trending_rank")
      .order("asc")
      .take(20);

    const topArtists = topArtistsRaw
      .filter((a: any) => typeof a.trendingRank === "number" && a.trendingRank > 0)
      .slice(0, 10)
      .map((a: any) => ({
        _id: a._id,
        slug: a.slug,
        name: a.name,
        trendingRank: a.trendingRank,
        trendingScore: a.trendingScore,
        upcomingShowsCount: a.upcomingShowsCount,
        images: a.images,
      }));

    const topShowsRaw = await ctx.db
      .query("shows")
      .withIndex("by_trending_rank")
      .order("asc")
      .take(30);

    const topShowsFiltered = topShowsRaw
      .filter((s: any) => typeof s.trendingRank === "number" && s.trendingRank > 0)
      .slice(0, 10);

    const topShows = await Promise.all(
      topShowsFiltered.map(async (s: any) => {
        // Cast to any to avoid Convex deep type instantiation issues in analytics code.
        const [artist, venue] = (await Promise.all([
          ctx.db.get(s.artistId as any),
          ctx.db.get(s.venueId as any),
        ])) as any[];
        return {
          _id: s._id,
          slug: s.slug,
          date: s.date,
          status: s.status,
          trendingRank: s.trendingRank,
          trendingScore: s.trendingScore,
          voteCount: s.voteCount,
          setlistCount: s.setlistCount,
          artist: artist ? { _id: artist._id, name: artist.name, slug: artist.slug, images: artist.images } : null,
          venue: venue ? { _id: venue._id, name: venue.name, city: venue.city, state: venue.state } : null,
        };
      }),
    );

    const series = (m: Record<string, any>, mapFn: (k: string, v: any) => any) =>
      dayKeys.map((k) => mapFn(k, m[k]));

    return {
      range: { days, startMs, endMs },
      signups: {
        total: users.length,
        spotifyConnected: users.filter((u) => !!u.spotifyId).length,
        byDay: series(signupsByDay, (day, v) => ({ day, ...v })),
      },
      engagement: {
        votes: { total: votes.length, byDay: series(votesByDay, (day, v) => ({ day, count: v })) },
        songVotes: { total: svs.length, byDay: series(songVotesByDay, (day, v) => ({ day, count: v })) },
      },
      ops: {
        cronRuns: {
          total: cronRuns.length,
          byDay: series(cronByDay, (day, v) => ({ day, ...v })),
        },
        errors: {
          total: errors.length,
          byDay: series(errorsByDay, (day, v) => ({ day, ...v })),
        },
      },
      top: {
        artists: topArtists,
        shows: topShows,
      },
    };
  },
});

