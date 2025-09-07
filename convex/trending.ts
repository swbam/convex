import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Backward-compatibility shim for older clients expecting `trending`.
// Re-implements the current logic from `trending.ts` so queries can run directly.

export const getTrendingShows = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Pull from canonical shows table using precomputed trendingRank
    const candidates = await ctx.db
      .query("shows")
      .withIndex("by_trending_rank")
      .filter((q) => q.neq(q.field("trendingRank"), undefined))
      .take(limit * 5);

    // Enrich with artist and venue documents
    const enriched = await Promise.all(
      candidates.map(async (show) => {
        const [artist, venue] = await Promise.all([
          ctx.db.get(show.artistId),
          ctx.db.get(show.venueId),
        ]);
        return {
          ...show,
          artist,
          venue,
        };
      })
    );

    // Sort by trendingRank ascending (1 is top), then by soonest date
    const sorted = enriched
      .sort((a: any, b: any) => {
        const ar = a.trendingRank ?? Number.MAX_SAFE_INTEGER;
        const br = b.trendingRank ?? Number.MAX_SAFE_INTEGER;
        if (ar !== br) return ar - br;
        const at = new Date(a.date).getTime();
        const bt = new Date(b.date).getTime();
        return at - bt;
      })
      .slice(0, limit);

    return sorted;
  },
});

export const getTrendingArtists = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Query canonical artists using precomputed trendingRank
    const candidates = await ctx.db
      .query("artists")
      .withIndex("by_trending_rank")
      .filter((q) => q.neq(q.field("trendingRank"), undefined))
      .take(limit * 5);

    const sorted = candidates
      .sort((a: any, b: any) => {
        const ar = a.trendingRank ?? Number.MAX_SAFE_INTEGER;
        const br = b.trendingRank ?? Number.MAX_SAFE_INTEGER;
        return ar - br;
      })
      .slice(0, limit);

    return sorted;
  },
});

// Calculate and cache supporting fields used for trending.
export const updateArtistShowCounts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const artists = await ctx.db.query("artists").collect();
    for (const artist of artists) {
      const upcomingShows = await ctx.db
        .query("shows")
        .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
        .filter((q) => q.eq(q.field("status"), "upcoming"))
        .collect();

      await ctx.db.patch(artist._id, {
        upcomingShowsCount: upcomingShows.length,
        lastTrendingUpdate: Date.now(),
      });
    }
    return null;
  },
});

// Update artist trending scores and ranks based on simple heuristics.
export const updateArtistTrending = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const artists = await ctx.db.query("artists").collect();
    const scored = artists.map((a) => {
      // Ensure all numeric values are properly handled to prevent NaN
      const upcomingShows = typeof a.upcomingShowsCount === 'number' ? a.upcomingShowsCount : 0;
      const followers = typeof a.followers === 'number' ? a.followers : 0;
      const popularity = typeof a.popularity === 'number' ? a.popularity : 0;
      
      // Calculate score with multiple factors
      const baseScore = upcomingShows + Math.floor(followers / 1_000_000) + Math.floor(popularity / 10);
      
      return {
        artist: a,
        score: Math.max(0, baseScore), // Ensure score is never negative
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const TOP_N = 100;
    for (let i = 0; i < scored.length; i += 1) {
      const { artist, score } = scored[i];
      await ctx.db.patch(artist._id, {
        trendingScore: Number.isFinite(score) ? score : 0, // Ensure no NaN values
        trendingRank: i < TOP_N ? i + 1 : undefined,
        lastTrendingUpdate: Date.now(),
      });
    }
    return null;
  },
});

// Update show trending ranks (simple ordering: soonest upcoming first).
export const updateShowTrending = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const upcoming = await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "upcoming"))
      .collect();

    const parsed = upcoming
      .map((s) => ({ show: s, when: new Date(s.date).getTime() }))
      .filter((p) => Number.isFinite(p.when));
    parsed.sort((a, b) => a.when - b.when);

    const TOP_N = 200;
    for (let i = 0; i < parsed.length; i += 1) {
      const { show } = parsed[i];
      await ctx.db.patch(show._id, {
        trendingRank: i < TOP_N ? i + 1 : undefined,
        lastTrendingUpdate: Date.now(),
      });
    }
    return null;
  },
});
