import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Get trending artists - now directly from artists table!
export const getTrendingArtists = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    // Super efficient: Just query by trending rank index
    return await ctx.db
      .query("artists")
      .withIndex("by_trending_rank")
      .filter((q) => q.neq(q.field("trendingRank"), undefined))
      .take(limit);
  },
});

// Get trending shows - now directly from shows table!
export const getTrendingShows = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    // Get trending shows with artist/venue data
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_trending_rank")
      .filter((q) => q.neq(q.field("trendingRank"), undefined))
      .take(limit);
    
    // Enrich with artist and venue data
    return await Promise.all(
      shows.map(async (show) => {
        const [artist, venue] = await Promise.all([
          ctx.db.get(show.artistId),
          ctx.db.get(show.venueId),
        ]);
        return { ...show, artist, venue };
      })
    );
  },
});

// Update trending scores for artists (called by cron)
export const updateArtistTrending = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const artists = await ctx.db
      .query("artists")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    // Calculate scores for all artists
    const scoredArtists = await Promise.all(
      artists.map(async (artist) => {
        let score = 0;
        
        // Base score from Spotify popularity
        score += (artist.popularity || 0) * 0.5;
        
        // Follower score (logarithmic)
        if (artist.followers) {
          score += Math.log10(artist.followers + 1) * 5;
        }
        
        // Upcoming shows count (cached)
        const upcomingShows = artist.upcomingShowsCount || 0;
        score += upcomingShows * 10;
        
        // Recent sync bonus
        if (artist.lastSynced && artist.lastSynced > oneWeekAgo) {
          score += 20;
        }
        
        return { artist, score };
      })
    );
    
    // Sort by score and assign ranks
    scoredArtists.sort((a, b) => b.score - a.score);
    
    // Update top 20 with ranks, clear ranks for others
    for (let i = 0; i < scoredArtists.length; i++) {
      const { artist, score } = scoredArtists[i];
      
      if (i < 20) {
        // Top 20 get ranks
        await ctx.db.patch(artist._id, {
          trendingScore: score,
          trendingRank: i + 1,
          lastTrendingUpdate: now,
        });
      } else {
        // Others lose their rank
        await ctx.db.patch(artist._id, {
          trendingScore: score,
          trendingRank: undefined,
          lastTrendingUpdate: now,
        });
      }
    }
    
    return null;
  },
});

// Update trending scores for shows (called by cron)
export const updateShowTrending = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "upcoming"))
      .collect();
    
    const now = Date.now();
    const oneMonthFromNow = now + (30 * 24 * 60 * 60 * 1000);
    
    // Calculate scores for all shows
    const scoredShows = await Promise.all(
      shows.map(async (show) => {
        let score = 0;
        
        // Get artist for popularity scoring
        const artist = await ctx.db.get(show.artistId);
        if (!artist) return { show, score: 0 };
        
        // Artist popularity contributes to show score
        score += (artist.popularity || 0) * 0.3;
        score += (artist.followers || 0) / 10000;
        
        // Shows happening soon score higher
        const showDate = new Date(show.date).getTime();
        if (showDate < oneMonthFromNow) {
          const daysUntil = (showDate - now) / (24 * 60 * 60 * 1000);
          score += Math.max(0, 30 - daysUntil) * 2;
        }
        
        // Price range indicates demand
        if (show.priceRange) {
          score += 20;
        }
        
        // Venue prestige (basic heuristic)
        const venue = await ctx.db.get(show.venueId);
        if (venue?.name && /stadium|arena|center/i.test(venue.name)) {
          score += 15;
        }
        
        return { show, score };
      })
    );
    
    // Sort by score and assign ranks
    scoredShows.sort((a, b) => b.score - a.score);
    
    // Update top 20 with ranks
    for (let i = 0; i < scoredShows.length; i++) {
      const { show, score } = scoredShows[i];
      
      if (i < 20) {
        await ctx.db.patch(show._id, {
          trendingScore: score,
          trendingRank: i + 1,
          lastTrendingUpdate: now,
        });
      } else {
        await ctx.db.patch(show._id, {
          trendingScore: score,
          trendingRank: undefined,
          lastTrendingUpdate: now,
        });
      }
    }
    
    return null;
  },
});

// Update cached show counts for artists
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
      });
    }
    
    return null;
  },
});