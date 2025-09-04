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
      .take(limit * 10); // Get way more candidates for proper deduplication

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

    // Filter out shows with missing data
    const valid = enriched.filter(show => show.artist && show.venue);

    // Sort all shows first by artist trending rank
    const sortedShows = valid.sort((a, b) => {
      // Primary: Artist trending rank (lower is better)
      const aArtistRank = a.artist?.trendingRank ?? Number.MAX_SAFE_INTEGER;
      const bArtistRank = b.artist?.trendingRank ?? Number.MAX_SAFE_INTEGER;
      if (aArtistRank !== bArtistRank) return aArtistRank - bArtistRank;
      
      // Secondary: Show trending rank (lower is better)
      const aShowRank = a.trendingRank ?? Number.MAX_SAFE_INTEGER;
      const bShowRank = b.trendingRank ?? Number.MAX_SAFE_INTEGER;
      if (aShowRank !== bShowRank) return aShowRank - bShowRank;
      
      // Tertiary: Soonest date first
      const at = new Date(a.date).getTime();
      const bt = new Date(b.date).getTime();
      return at - bt;
    });
    
    // MANUAL deduplication with explicit string conversion
    const result = [];
    const seenArtistIds = [];
    
    for (let i = 0; i < sortedShows.length && result.length < limit; i++) {
      const show = sortedShows[i];
      const artistIdStr = String(show.artistId); // Convert to string explicitly
      
      // Check if we've seen this artist before using manual loop
      let alreadySeen = false;
      for (let j = 0; j < seenArtistIds.length; j++) {
        if (seenArtistIds[j] === artistIdStr) {
          alreadySeen = true;
          break;
        }
      }
      
      if (!alreadySeen) {
        seenArtistIds.push(artistIdStr);
        result.push(show);
      }
    }

    return result;
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
      .take(limit * 10); // Get more candidates for thorough deduplication

    // Sort candidates by trending rank first
    const sortedCandidates = candidates.sort((a, b) => {
      const ar = a.trendingRank ?? 999999;
      const br = b.trendingRank ?? 999999;
      return ar - br;
    });
    
    // MANUAL deduplication for artists
    const result = [];
    const seenSpotifyIds = [];
    const seenNames = [];
    
    for (let i = 0; i < sortedCandidates.length && result.length < limit; i++) {
      const artist = sortedCandidates[i];
      let isDuplicate = false;
      
      // Check Spotify ID duplicates
      if (artist.spotifyId) {
        for (let j = 0; j < seenSpotifyIds.length; j++) {
          if (seenSpotifyIds[j] === artist.spotifyId) {
            isDuplicate = true;
            break;
          }
        }
        if (!isDuplicate) {
          seenSpotifyIds.push(artist.spotifyId);
        }
      }
      
      // Check name duplicates
      if (!isDuplicate) {
        const normalizedName = artist.name.toLowerCase()
          .replace(/tribute/g, '')
          .replace(/band/g, '')
          .replace(/the /g, '')
          .replace(/[^a-z0-9]/g, '');
        
        for (let j = 0; j < seenNames.length; j++) {
          if (seenNames[j] === normalizedName) {
            isDuplicate = true;
            break;
          }
        }
        if (!isDuplicate) {
          seenNames.push(normalizedName);
        }
      }
      
      if (!isDuplicate) {
        result.push(artist);
      }
    }
    
    return result;
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
    const scored = artists.map((a) => ({
      artist: a,
      score: (a.upcomingShowsCount || 0) + Math.floor((a.followers || 0) / 1_000_000),
    }));

    scored.sort((a, b) => b.score - a.score);

    const TOP_N = 100;
    for (let i = 0; i < scored.length; i += 1) {
      const { artist, score } = scored[i];
      await ctx.db.patch(artist._id, {
        trendingScore: score,
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

    const parsed = upcoming.map((s) => ({
      show: s,
      when: new Date(s.date).getTime(),
    }));
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
