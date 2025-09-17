import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

const createShowSlug = (
  artistName: string,
  venueName: string,
  venueCity: string,
  date: string,
  startTime?: string | null
) => {
  const safeArtist = slugify(artistName || "");
  const safeVenue = slugify(venueName || "");
  const safeCity = slugify(venueCity || "");
  const parts = [safeArtist, safeVenue, safeCity, date].filter(Boolean);
  const timePart = startTime ? `-${startTime.replace(/:/g, "-")}` : "";
  return parts.join("-") + timePart;
};

const normalizeShowStatus = (status?: string) => {
  const value = (status || "").toLowerCase();
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("complete")) return "completed";
  return "upcoming";
};

// Backward-compatibility shim for older clients expecting `trending`.
// Prefers cached Ticketmaster data while falling back to Convex tables when empty.

export const getTrendingShows = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    const cached = await ctx.db
      .query("trendingShows")
      .withIndex("by_rank")
      .order("asc")
      .take(limit);

    if (cached.length > 0) {
      const hydrated = await Promise.all(
        cached.map(async (entry) => {
          let show = entry.showId ? await ctx.db.get(entry.showId) : null;
          if (!show && entry.ticketmasterId) {
            show = await ctx.db
              .query("shows")
              .withIndex("by_ticketmaster_id", (q) =>
                q.eq("ticketmasterId", entry.ticketmasterId)
              )
              .first();
          }

          let artist =
            (show ? await ctx.db.get(show.artistId) : null) ??
            (entry.artistId ? await ctx.db.get(entry.artistId) : null);

          if (!artist && entry.artistTicketmasterId) {
            artist = await ctx.db
              .query("artists")
              .withIndex("by_ticketmaster_id", (q) =>
                q.eq("ticketmasterId", entry.artistTicketmasterId!)
              )
              .first();
          }

          const venue =
            show && show.venueId ? await ctx.db.get(show.venueId) : null;

          const artistName =
            artist?.name || entry.artistName || "Unknown Artist";
          const computedSlug =
            entry.showSlug ||
            createShowSlug(
              artistName,
              entry.venueName,
              entry.venueCity,
              entry.date,
              entry.startTime
            );

          const baseShow =
            show ??
            ({
              _id: `ticketmaster:${entry.ticketmasterId}`,
              ticketmasterId: entry.ticketmasterId,
              date: entry.date,
              startTime: entry.startTime,
              status: normalizeShowStatus(entry.status),
              ticketUrl: entry.ticketUrl,
              priceRange: entry.priceRange,
              slug: computedSlug,
            } as any);

          const resolvedArtist =
            artist ??
            ({
              _id: `ticketmaster:${entry.artistTicketmasterId ?? entry.ticketmasterId}`,
              ticketmasterId:
                entry.artistTicketmasterId ?? entry.ticketmasterId,
              name: artistName,
              slug: entry.artistSlug || slugify(artistName),
              images: entry.artistImage ? [entry.artistImage] : [],
            } as any);

          const resolvedVenue =
            venue ??
            ({
              name: entry.venueName,
              city: entry.venueCity,
              country: entry.venueCountry,
            } as any);

          return {
            ...baseShow,
            slug: baseShow.slug || computedSlug,
            artist: resolvedArtist,
            venue: resolvedVenue,
            trendingRank: show?.trendingRank ?? entry.rank,
            trendingScore: show?.trendingScore,
            lastTrendingUpdate: show?.lastTrendingUpdate ?? entry.lastUpdated,
            source: show ? "database" : "ticketmaster",
          };
        })
      );

      return hydrated.slice(0, limit);
    }

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

    const cached = await ctx.db
      .query("trendingArtists")
      .withIndex("by_rank")
      .order("asc")
      .take(limit);

    if (cached.length > 0) {
      const enriched = await Promise.all(
        cached.map(async (entry) => {
          let artist = entry.artistId ? await ctx.db.get(entry.artistId) : null;
          if (!artist) {
            artist = await ctx.db
              .query("artists")
              .withIndex("by_ticketmaster_id", (q) =>
                q.eq("ticketmasterId", entry.ticketmasterId)
              )
              .first();
          }

          if (artist) {
            return {
              ...artist,
              images:
                artist.images && artist.images.length > 0
                  ? artist.images
                  : entry.images,
              upcomingShowsCount:
                artist.upcomingShowsCount ?? entry.upcomingEvents,
              trendingRank: artist.trendingRank ?? entry.rank,
              lastTrendingUpdate:
                artist.lastTrendingUpdate ?? entry.lastUpdated,
            };
          }

          const name = entry.name || "Unknown Artist";

          return {
            _id: `ticketmaster:${entry.ticketmasterId}`,
            ticketmasterId: entry.ticketmasterId,
            name,
            slug: entry.slug || slugify(name),
            genres: entry.genres,
            images: entry.images,
            upcomingShowsCount: entry.upcomingEvents,
            url: entry.url,
            trendingRank: entry.rank,
            trendingScore: entry.upcomingEvents,
            isActive: true,
          } as any;
        })
      );

      return enriched.slice(0, limit);
    }

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

export const replaceTrendingShowsCache = internalMutation({
  args: {
    fetchedAt: v.number(),
    shows: v.array(
      v.object({
        ticketmasterId: v.string(),
        artistTicketmasterId: v.optional(v.string()),
        artistName: v.optional(v.string()),
        venueName: v.string(),
        venueCity: v.string(),
        venueCountry: v.string(),
        date: v.string(),
        startTime: v.optional(v.string()),
        artistImage: v.optional(v.string()),
        ticketUrl: v.optional(v.string()),
        priceRange: v.optional(v.string()),
        status: v.string(),
        rank: v.number(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("trendingShows").collect();
    const existingMap = new Map(existing.map((doc) => [doc.ticketmasterId, doc]));
    const keep = new Set(args.shows.map((show) => show.ticketmasterId));

    for (const doc of existing) {
      if (!keep.has(doc.ticketmasterId)) {
        await ctx.db.delete(doc._id);
      }
    }

    for (const show of args.shows) {
      const linkedShow = await ctx.db
        .query("shows")
        .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", show.ticketmasterId))
        .first();

      const linkedArtist = linkedShow
        ? await ctx.db.get(linkedShow.artistId)
        : show.artistTicketmasterId
        ? await ctx.db
            .query("artists")
            .withIndex("by_ticketmaster_id", (q) =>
              q.eq("ticketmasterId", show.artistTicketmasterId!)
            )
            .first()
        : null;

      const artistName = linkedArtist?.name || show.artistName || "Unknown Artist";
      const payload = {
        showId: linkedShow?._id,
        showSlug:
          linkedShow?.slug ||
          createShowSlug(
            artistName,
            show.venueName,
            show.venueCity,
            show.date,
            show.startTime
          ),
        artistTicketmasterId: show.artistTicketmasterId,
        artistId: linkedArtist?._id,
        artistSlug: linkedArtist?.slug || slugify(artistName),
        artistName,
        venueName: show.venueName,
        venueCity: show.venueCity,
        venueCountry: show.venueCountry,
        date: show.date,
        startTime: show.startTime,
        artistImage: show.artistImage,
        ticketUrl: show.ticketUrl,
        priceRange: show.priceRange,
        status: show.status,
        rank: show.rank,
        lastUpdated: args.fetchedAt,
      };

      const existingDoc = existingMap.get(show.ticketmasterId);
      if (existingDoc) {
        await ctx.db.patch(existingDoc._id, payload);
        existingMap.delete(show.ticketmasterId);
      } else {
        await ctx.db.insert("trendingShows", {
          ticketmasterId: show.ticketmasterId,
          ...payload,
        });
      }
    }

    return null;
  },
});

export const replaceTrendingArtistsCache = internalMutation({
  args: {
    fetchedAt: v.number(),
    artists: v.array(
      v.object({
        ticketmasterId: v.string(),
        name: v.string(),
        genres: v.array(v.string()),
        images: v.array(v.string()),
        upcomingEvents: v.number(),
        url: v.optional(v.string()),
        rank: v.number(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("trendingArtists").collect();
    const existingMap = new Map(existing.map((doc) => [doc.ticketmasterId, doc]));
    const keep = new Set(args.artists.map((artist) => artist.ticketmasterId));

    for (const doc of existing) {
      if (!keep.has(doc.ticketmasterId)) {
        await ctx.db.delete(doc._id);
      }
    }

    for (const artist of args.artists) {
      const linkedArtist = await ctx.db
        .query("artists")
        .withIndex("by_ticketmaster_id", (q) =>
          q.eq("ticketmasterId", artist.ticketmasterId)
        )
        .first();

      const name = linkedArtist?.name || artist.name || "Unknown Artist";
      const genres =
        linkedArtist?.genres && linkedArtist.genres.length > 0
          ? linkedArtist.genres
          : artist.genres;
      const images =
        linkedArtist?.images && linkedArtist.images.length > 0
          ? linkedArtist.images
          : artist.images;
      const upcomingEvents = Number.isFinite(artist.upcomingEvents)
        ? artist.upcomingEvents
        : 0;

      const payload = {
        artistId: linkedArtist?._id,
        slug: linkedArtist?.slug || slugify(name),
        name,
        genres,
        images,
        upcomingEvents,
        url: artist.url,
        rank: artist.rank,
        lastUpdated: args.fetchedAt,
      };

      const existingDoc = existingMap.get(artist.ticketmasterId);
      if (existingDoc) {
        await ctx.db.patch(existingDoc._id, payload);
        existingMap.delete(artist.ticketmasterId);
      } else {
        await ctx.db.insert("trendingArtists", {
          ticketmasterId: artist.ticketmasterId,
          ...payload,
        });
      }
    }

    return null;
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
