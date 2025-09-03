import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Backward-compatibility shim for older clients expecting `trending`.
// Re-implements the current logic from `trending.ts` so queries can run directly.

export const getTrendingShows = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // First try to get from cache table
    let shows = await ctx.db
      .query("trendingShows")
      .withIndex("by_last_updated")
      .order("desc")
      .take(limit);

    // If cache is empty, fetch from main shows table
    if (shows.length === 0) {
      const mainShows = await ctx.db
        .query("shows")
        .withIndex("by_trending_rank")
        .filter((q) => q.neq(q.field("trendingRank"), undefined))
        .take(limit);

      // Enrich with artist and venue data
      const enrichedMainShows = await Promise.all(
        mainShows.map(async (show) => {
          const [artist, venue] = await Promise.all([
            ctx.db.get(show.artistId),
            ctx.db.get(show.venueId),
          ]);

          if (!artist || !venue) return null;

          return {
            ticketmasterId: show.ticketmasterId || "",
            artistTicketmasterId: artist.ticketmasterId,
            artistName: artist.name,
            artistId: artist._id,
            venueName: venue.name,
            venueCity: venue.city,
            venueCountry: venue.country,
            date: show.date,
            startTime: show.startTime,
            artistImage: artist.images?.[0],
            ticketUrl: show.ticketUrl,
            priceRange: show.priceRange,
            status: show.status,
            lastUpdated: show.lastTrendingUpdate || Date.now(),
            _id: show._id,
            slug: show.slug,
            artist: {
              _id: artist._id,
              name: artist.name,
              slug: artist.slug,
              images: artist.images,
              genres: artist.genres,
            },
          };
        })
      );

      return enrichedMainShows.filter(show => show !== null);
    }

    // Enrich cache data with actual records
    const enrichedShows = await Promise.all(
      shows.map(async (show) => {
        if (show.artistId) {
          const artist = await ctx.db.get(show.artistId);
          if (artist) {
            return {
              ...show,
              artist: {
                _id: artist._id,
                name: artist.name,
                slug: artist.slug,
                images: artist.images,
                genres: artist.genres,
              },
            };
          }
        }
        return show;
      })
    );

    return enrichedShows;
  },
});

export const getTrendingArtists = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // First try to get from the cache table
    let artists = await ctx.db
      .query("trendingArtists")
      .withIndex("by_last_updated")
      .order("desc")
      .take(limit);

    // If cache is empty or stale, fetch from main artists table
    if (artists.length === 0) {
      const mainArtists = await ctx.db
        .query("artists")
        .withIndex("by_trending_rank")
        .filter((q) => q.neq(q.field("trendingRank"), undefined))
        .take(limit);

      // Map to match the expected format
      return mainArtists.map(artist => ({
        ticketmasterId: artist.ticketmasterId || "",
        name: artist.name,
        artistId: artist._id,
        genres: artist.genres || [],
        images: artist.images || [],
        upcomingEvents: artist.upcomingShowsCount || 0,
        url: undefined,
        lastUpdated: artist.lastTrendingUpdate || Date.now(),
        artist: {
          _id: artist._id,
          name: artist.name,
          slug: artist.slug,
          images: artist.images,
          genres: artist.genres,
          followers: artist.followers,
          upcomingShowsCount: artist.upcomingShowsCount,
        }
      }));
    }

    // Enrich cache data with actual artist records
    const enrichedArtists = await Promise.all(
      artists.map(async (cached) => {
        if (cached.artistId) {
          const artist = await ctx.db.get(cached.artistId);
          if (artist) {
            return {
              ...cached,
              artist: {
                _id: artist._id,
                name: artist.name,
                slug: artist.slug,
                images: artist.images || cached.images,
                genres: artist.genres || cached.genres,
                followers: artist.followers,
                upcomingShowsCount: artist.upcomingShowsCount,
              }
            };
          }
        }
        return cached;
      })
    );

    return enrichedArtists;
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

// Populate trending artists cache table
export const populateTrendingArtistsCache = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("📊 Populating trending artists cache...");
    
    // Clear old cache
    const oldCache = await ctx.db.query("trendingArtists").collect();
    for (const item of oldCache) {
      await ctx.db.delete(item._id);
    }

    // Get top trending artists from main table
    const topArtists = await ctx.db
      .query("artists")
      .withIndex("by_trending_rank")
      .filter((q) => q.neq(q.field("trendingRank"), undefined))
      .take(50);

    // Insert into cache table
    for (const artist of topArtists) {
      await ctx.db.insert("trendingArtists", {
        ticketmasterId: artist.ticketmasterId || "",
        name: artist.name,
        artistId: artist._id,
        genres: artist.genres || [],
        images: artist.images || [],
        upcomingEvents: artist.upcomingShowsCount || 0,
        url: undefined,
        lastUpdated: Date.now(),
      });
    }

    console.log(`✅ Populated trending artists cache with ${topArtists.length} artists`);
    return null;
  },
});

// Populate trending shows cache table
export const populateTrendingShowsCache = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("📊 Populating trending shows cache...");
    
    // Clear old cache
    const oldCache = await ctx.db.query("trendingShows").collect();
    for (const item of oldCache) {
      await ctx.db.delete(item._id);
    }

    // Get top trending shows from main table
    const topShows = await ctx.db
      .query("shows")
      .withIndex("by_trending_rank")
      .filter((q) => q.neq(q.field("trendingRank"), undefined))
      .take(50);

    // Insert into cache table with enriched data
    for (const show of topShows) {
      const [artist, venue] = await Promise.all([
        ctx.db.get(show.artistId),
        ctx.db.get(show.venueId),
      ]);

      if (artist && venue) {
        await ctx.db.insert("trendingShows", {
          ticketmasterId: show.ticketmasterId || "",
          artistTicketmasterId: artist.ticketmasterId,
          artistName: artist.name,
          artistId: artist._id,
          venueName: venue.name,
          venueCity: venue.city,
          venueCountry: venue.country,
          date: show.date,
          startTime: show.startTime,
          artistImage: artist.images?.[0],
          ticketUrl: show.ticketUrl,
          priceRange: show.priceRange,
          status: show.status,
          lastUpdated: Date.now(),
        });
      }
    }

    console.log(`✅ Populated trending shows cache with ${topShows.length} shows`);
    return null;
  },
});
