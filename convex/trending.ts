import { query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { internalRef } from "./adminHelpers";

// Helper to filter out non-concert content (secondary filter after API segmentId filtering)
// The API now uses segmentId=KZFzniwnSyZfZ7v7nJ which is Music-only
// This is a lightweight fallback filter for edge cases that slip through
const isRealConcert = (name: string, genres?: string[]): boolean => {
  const lowerName = (name || '').toLowerCase();

  // Reject patterns for non-concert content that might still appear in Music segment
  const rejectPatterns = [
    // Orchestral performances (often tagged as Music but aren't pop/rock concerts)
    'orchestra', 'symphony', 'philharmonic', 'chamber',
    'ensemble', 'chorale', 'choir',
    // Classical music soloists
    'recital', 'concerto',
    // Film/video game music performances (tagged as Music but are soundtrack screenings)
    'film with', '- film', 'in concert film', 'live to film',
    'video games live', 'festival of seasons',
    // Soundtrack/score performances (Hans Zimmer, John Williams, etc.)
    'music of hans zimmer', 'hans zimmer', 'john williams',
    'movie scores', 'film scores', 'soundtrack',
    // Documentary/tribute screenings (sometimes tagged as Music)
    'documentary', 'at the max', 'making sense',
    // Tribute bands (detected by common patterns)
    'smells like nirvana', 'tribute', 'experience featuring',
    // Award ceremonies and non-performance events
    'hall of fame', 'induction ceremony', 'awards', 'gala',
    // Opera (sometimes leaks into Music segment)
    'opera', 'la traviata', 'rigoletto', 'carmen', 'tosca',
    // Kids entertainment (sometimes tagged as Music)
    'sesame street', 'paw patrol', 'peppa pig', 'bluey', 'baby shark',
    // Party / novelty events that slip into Music segment
    'bingo', 'bingo loco', 'dance party', 'silent disco', 'karaoke',
    'trivia', 'game night', 'line dancing', 'brunch', 'drag brunch',
    'drag show', 'burlesque',
    // Other non-concert event types that sometimes leak into Music
    'wrestling', 'ufc', 'boxing', 'esports', 'podcast', 'lecture', 'speaker',
    'stand-up', 'standup', 'comedy show', 'comedy night'
  ];

  if (rejectPatterns.some(p => lowerName.includes(p))) return false;

  // Check genres - reject classical/opera/other non-concert genres
  if (genres && genres.length > 0) {
    const lowerGenres = genres.map(g => g.toLowerCase());
    const nonConcertGenres = [
      'classical', 'opera', 'chamber music', 'choral', 'other', 'undefined'
    ];
    if (lowerGenres.some(g => nonConcertGenres.some(ng => g.includes(ng)))) return false;
  }

  return true;
};



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
  // NO TIME IN URL for cleaner SEO
  return parts.join("-");
};

const normalizeShowStatus = (status?: string) => {
  const value = (status || "").toLowerCase();
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("complete")) return "completed";
  // Map common Ticketmaster status codes to our normalized state
  const tmActiveCodes = [
    "onsale",
    "onsale_soon",
    "offsale",
    "rescheduled",
    "postponed",
    "scheduled",
    "moved",
    "time_tbd",
    "date_tbd",
    "date_tba",
    "event_rescheduled",
    "event_postponed",
    "event_scheduled",
  ];
  if (tmActiveCodes.some((k) => value.includes(k))) return "upcoming";
  return "upcoming";
};

const toKey = (value: string | null | undefined) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim().toLowerCase() : undefined;

const dedupeByKey = <T>(items: T[], keyFn: (item: T) => string | null | undefined, limit?: number) => {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = toKey(keyFn(item));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (typeof limit === "number" && result.length >= limit) break;
  }
  return result;
};

// Backward-compatibility shim for older clients expecting `trending`.
// Prefers cached Ticketmaster data while falling back to Convex tables when empty.

export const getTrendingShows = query({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
    source: v.union(v.literal("ticketmaster_cache"), v.literal("db_fallback")),
    isFallback: v.boolean(),
    lastUpdated: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Primary source: curated trending cache - ONLY return shows that have been imported
    const cached = await ctx.db
      .query("trendingShows")
      .withIndex("by_rank")
      .order("asc")
      // Read the full bounded discovery cache before deduping. Ticketmaster can
      // rank many dates from one residency ahead of every other artist.
      .take(Math.max(limit * 10, 200));

    // CRITICAL FIX: Process cache but fallback if no valid shows after filtering
    let validShows: any[] = [];

    if (cached.length > 0) {
      const hydrated = await Promise.all(
        cached.map(async (row) => {
          // CRITICAL FIX: Only return shows that have been imported into main database
          if (row.showId) {
            const showDoc = await ctx.db.get(row.showId);
            if (showDoc) {
              const [artist, venue] = await Promise.all([
                ctx.db.get(showDoc.artistId),
                ctx.db.get(showDoc.venueId),
              ]);
              if (artist && venue) {
                return {
                  ...showDoc,
                  artist,
                  venue,
                  cachedTrending: row,
                };
              }
            }
          }
          // CRITICAL: Return null for cache-only shows (not imported yet)
          // This prevents "Not Found" errors when users click them
          return null;
        })
      );

      // Filter out null values (cache-only shows)
      validShows = hydrated.filter((show): show is NonNullable<typeof show> => show !== null);

      // CRITICAL: Only use cache if we have valid shows after filtering
      if (validShows.length > 0) {
        const uniqueShows = dedupeByKey(
          validShows,
          (show: any) =>
            show?.slug ||
            show?.ticketmasterId ||
            show?.cachedTrending?.showSlug ||
            show?.cachedTrending?.ticketmasterId ||
            `${show?.artist?.name ?? show?.cachedTrending?.artistName ?? "unknown"}::${show?.venue?.name ?? show?.cachedTrending?.venueName ?? "unknown"}::${show?.date ?? show?.cachedTrending?.date ?? "unknown"}`,
          limit * 2
        );

        const artistScoped = dedupeByKey(
          uniqueShows,
          (show: any) =>
            show?.artist?._id ||
            show?.artist?.slug ||
            show?.cachedTrending?.artistSlug ||
            show?.cachedTrending?.artistTicketmasterId ||
            show?.artist?.ticketmasterId ||
            show?.artist?.name ||
            show?.cachedTrending?.artistName,
          limit
        );

        // final cleanup to avoid Unknown entries, non-upcoming items, and non-concerts
        const today = new Date().toISOString().slice(0, 10);
        const cleaned = artistScoped.filter((s: any) => {
          const name = s?.artist?.name || s?.cachedTrending?.artistName || "";
          const venue = s?.venue?.name || s?.cachedTrending?.venueName || "";
          const status = normalizeShowStatus(s?.status || s?.cachedTrending?.status);
          const genres = s?.artist?.genres || s?.cachedTrending?.genres || [];
          return (
            typeof name === "string" && name.length > 0 &&
            !name.toLowerCase().includes("unknown") &&
            typeof venue === "string" && venue.length > 0 &&
            status === "upcoming" &&
            typeof s?.date === "string" && s.date >= today &&
            isRealConcert(name, genres) // Filter out plays, musicals, film screenings
          );
        });

        // This surface is explicitly "Upcoming Shows", so nearest dates win
        // after popularity curation and artist-level deduplication.
        cleaned.sort((a: any, b: any) => {
          const dateOrder = String(a?.date || "").localeCompare(String(b?.date || ""));
          if (dateOrder !== 0) return dateOrder;
          return (a?.cachedTrending?.rank ?? 9999) - (b?.cachedTrending?.rank ?? 9999);
        });

        const lastUpdated = cached.reduce((max, row) => Math.max(max, row.lastUpdated || 0), 0) || undefined;
        return {
          page: cleaned.slice(0, limit),
          isDone: cleaned.length < limit,
          continueCursor: undefined,
          source: "ticketmaster_cache" as const,
          isFallback: false,
          lastUpdated,
        };
      }
    }

    // Fallback: derive from upcoming shows (no engagement-based ranking)
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_status_and_date", (q) => q.eq("status", "upcoming"))
      .order("asc")
      .take(limit * 3);

    // Hydrate with full artist + venue data with null checks
    const hydrated = await Promise.all(shows.map(async (show) => {
      try {
        const artist = await ctx.db.get(show.artistId);
        const venue = await ctx.db.get(show.venueId);

        return {
          ...show,
          artist,
          venue,
        };
      } catch (error) {
        console.error(`❌ Failed to hydrate show ${show._id}:`, error);
        return null;
      }
    }));

    // Filter out null results from failed hydrations
    const fallbackShows = hydrated.filter((show): show is NonNullable<typeof show> => show !== null);

    // Sort purely by date ascending (next upcoming first)
    fallbackShows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // PRODUCTION FILTER: Balance quality with availability + filter non-concerts
    const eligible = fallbackShows.filter(show => {
      const artist = show.artist;
      const venue = show.venue;
      if (!artist || !venue) return false;

      const isUpcoming = show.status === "upcoming";
      const notUnknown = !artist.name.toLowerCase().includes("unknown");
      const hasBasicData = artist.name && artist.name.length > 0 && venue.name;
      const isConcert = isRealConcert(artist.name, artist.genres);

      // Require upcoming + valid names + must be a real concert (no plays/musicals)
      return isUpcoming && notUnknown && hasBasicData && isConcert;
    });

    // DEDUPE: only one show per artist on homepage
    const deduped = dedupeByKey(
      eligible,
      (show: any) =>
        show?.slug ||
        show?.ticketmasterId ||
        `${show?.artist?.name ?? "unknown"}::${show?.venue?.name ?? "unknown"}::${show?.date}`,
      limit * 2
    );

    const filtered = dedupeByKey(
      deduped,
      (show: any) =>
        show?.artist?._id ||
        show?.artist?.slug ||
        show?.artist?.ticketmasterId ||
        show?.artist?.name,
      limit
    );

    if (filtered.length < limit / 2) {
      console.warn(`Trending filtered to ${filtered.length} items—check data population (popularity/images missing). Run syncs.`);
    }

    return {
      page: filtered.slice(0, limit),
      isDone: filtered.length < limit,
      continueCursor: undefined,
      source: "db_fallback" as const,
      isFallback: true,
      lastUpdated: undefined,
    };
  },
});



export const getTrendingArtists = query({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
    source: v.union(v.literal("ticketmaster_cache"), v.literal("db_fallback")),
    isFallback: v.boolean(),
    lastUpdated: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Primary source: cached trending artists populated by maintenance syncs.
    const cached = await ctx.db
      .query("trendingArtists")
      .withIndex("by_rank")
      .order("asc")
      // Take significantly more than we display so we can drop non-touring / filtered items
      // (e.g., globally popular artists with 0 upcoming shows).
      .take(Math.max(limit * 10, 200));

    if (cached.length > 0) {
      const hydrated = await Promise.all(
        cached.map(async (row) => {
          if (row.artistId) {
            const artistDoc = await ctx.db.get(row.artistId);
            if (artistDoc) {
              // Use the HIGHER of doc count vs cached count (cached is from Ticketmaster, more current)
              const docShows = artistDoc.upcomingShowsCount ?? 0;
              const cachedShows = row.upcomingEvents ?? 0;
              return {
                ...artistDoc,
                upcomingShowsCount: Math.max(docShows, cachedShows),
                trendingRank: artistDoc.trendingRank ?? row.rank,
                cachedTrending: row,
              };
            }
          }

          return {
            _id: row._id,
            name: row.name,
            slug: row.slug,
            images: row.images,
            genres: row.genres,
            upcomingShowsCount: row.upcomingEvents,
            ticketmasterId: row.ticketmasterId,
            trendingRank: row.rank,
            cachedTrending: row,
          };
        })
      );

      // ENHANCED: Deduplicate using unique artist ID first, then fallback to other identifiers
      const seen = new Set<string>();
      const unique = hydrated.filter((artist: any) => {
        // Priority order: _id, slug, ticketmasterId, name (lowercase)
        const key =
          artist?._id?.toString() ||
          artist?.slug ||
          artist?.ticketmasterId ||
          artist?.cachedTrending?.artistId?.toString() ||
          artist?.cachedTrending?.slug ||
          artist?.cachedTrending?.ticketmasterId ||
          artist?.name?.toLowerCase().trim();

        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, limit * 3);

      // STRICT filter: REQUIRE upcoming shows for "Trending Artists"
      // Also filter out non-concerts (plays, musicals, film screenings)
      const massive = unique.filter((a: any) => {
        // Check BOTH artist doc and cached data - use the higher value
        // (artist doc may be stale, cached data from Ticketmaster is more current)
        const docShows = a?.upcomingShowsCount ?? 0;
        const cachedShows = a?.cachedTrending?.upcomingEvents ?? 0;
        const upcoming = Math.max(docShows, cachedShows);
        const name = a?.name || '';
        const genres = a?.genres || [];

        // CRITICAL: Must have upcoming shows - this section is "artists WITH upcoming shows"
        if (upcoming <= 0) return false;

        // Must be a real concert (not a play, musical, or film screening)
        if (!isRealConcert(name, genres)) return false;

        // All artists with shows pass - songs will be fetched on demand
        return true;
      });

      const lastUpdated = cached.reduce((max, row) => Math.max(max, row.lastUpdated || 0), 0) || undefined;
      return {
        page: massive.slice(0, limit),
        isDone: massive.length < limit,
        continueCursor: undefined,
        source: "ticketmaster_cache" as const,
        isFallback: false,
        lastUpdated,
      };
    }

    // Fallback to artists ordered by trendingRank.
    const rankedArtists = await ctx.db
      .query("artists")
      .withIndex("by_trending_rank")
      .order("asc")
      .take(limit * 3);

    const filteredRanked = rankedArtists.filter(
      (artist) => artist.isActive !== false
    );

    // STRICT filter: REQUIRE upcoming shows + filter non-concerts
    const massiveRanked = filteredRanked.filter((a: any) => {
      const upcoming = a?.upcomingShowsCount ?? 0;
      const name = a?.name || '';
      const genres = a?.genres || [];

      // CRITICAL: Must have upcoming shows
      if (upcoming <= 0) return false;

      // Must be a real concert (not a play, musical, or film screening)
      if (!isRealConcert(name, genres)) return false;

      return true;
    });

    if (massiveRanked.length > 0) {
      return {
        page: massiveRanked.slice(0, limit),
        isDone: massiveRanked.length < limit,
        continueCursor: undefined,
        source: "db_fallback" as const,
        isFallback: true,
        lastUpdated: undefined,
      };
    }

    // Final fallback: active artists with upcoming shows, scored by show count + popularity
    const activeArtists = await ctx.db
      .query("artists")
      .filter((q) => q.eq(q.field("isActive"), true))
      .take(200);

    // CRITICAL: Only include artists with upcoming shows
    const withShows = activeArtists.filter((a: any) => {
      const upcoming = a?.upcomingShowsCount ?? 0;
      return upcoming > 0 && isRealConcert(a.name, a.genres);
    });

    const scored = withShows
      .map((artist) => ({
        artist,
        score:
          (typeof artist.upcomingShowsCount === "number"
            ? artist.upcomingShowsCount
            : 0) *
          10 +
          (typeof artist.popularity === "number" ? artist.popularity : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.artist)
      .slice(0, limit);

    return {
      page: scored,
      isDone: scored.length < limit,
      continueCursor: undefined,
      source: "db_fallback" as const,
      isFallback: true,
      lastUpdated: undefined,
    };
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
        venueState: v.optional(v.string()),
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
    // CRITICAL: Filter to US-only shows AND real concerts before processing
    const usShows = args.shows.filter((show) => {
      const country = (show.venueCountry || '').toLowerCase();
      const isUS = country === 'united states of america' ||
        country === 'united states' ||
        country === 'usa' ||
        country === 'us';

      // Also filter out non-concert events
      const artistName = (show.artistName || '').toLowerCase();
      const isConcert = isRealConcert(artistName, []);

      return isUS && isConcert;
    });

    // Defense in depth: even if the upstream API returns dozens of dates from
    // one residency, the homepage cache stores one representative event per act.
    const seenArtists = new Set<string>();
    const diverseShows = [...usShows]
      .sort((a, b) => a.rank - b.rank)
      .filter((show) => {
        const key = slugify(show.artistName || show.artistTicketmasterId || "");
        if (!key || seenArtists.has(key)) return false;
        seenArtists.add(key);
        return true;
      })
      .slice(0, 60);

    console.log(`📊 Processing ${diverseShows.length} artist-diverse US concerts from ${args.shows.length} Ticketmaster events`);

    const existing = await ctx.db.query("trendingShows").collect();
    const existingMap = new Map(existing.map((doc) => [doc.ticketmasterId, doc]));
    const keep = new Set(diverseShows.map((show) => show.ticketmasterId));

    for (const doc of existing) {
      if (!keep.has(doc.ticketmasterId)) {
        await ctx.db.delete(doc._id);
      }
    }

    for (const show of diverseShows) {
      const linkedShow = await ctx.db
        .query("shows")
        .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", show.ticketmasterId))
        .first();

      // CRITICAL FIX: Add error recovery for missing artists
      let linkedArtist = null;
      try {
        linkedArtist = linkedShow
          ? await ctx.db.get(linkedShow.artistId)
          : show.artistTicketmasterId
            ? await ctx.db
              .query("artists")
              .withIndex("by_ticketmaster_id", (q) =>
                q.eq("ticketmasterId", show.artistTicketmasterId!)
              )
              .first()
            : null;
      } catch (error) {
        console.error(`❌ Failed to get artist for trending show ${show.ticketmasterId}:`, error);
      }

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
        venueState: show.venueState,
        venueCountry: show.venueCountry,
        date: show.date,
        startTime: show.startTime,
        artistImage: show.artistImage,
        ticketUrl: show.ticketUrl,
        priceRange: show.priceRange,
        status: normalizeShowStatus(show.status),
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
    // CRITICAL: Filter to real concerts only (no orchestras, film screenings, etc.)
    // Also filter out residencies (50+ shows = Vegas residency, not a real tour)
    const MAX_EVENTS_FOR_TOUR = 200;
    const realConcertArtists = args.artists.filter((artist) => {
      // Must have upcoming events (this cache is specifically "artists with upcoming concerts")
      if (!Number.isFinite(artist.upcomingEvents) || artist.upcomingEvents <= 0) {
        return false;
      }
      // Residency filter: 50+ events = not a touring act
      if (artist.upcomingEvents > MAX_EVENTS_FOR_TOUR) {
        console.log(`🚫 Skipping residency: ${artist.name} (${artist.upcomingEvents} events)`);
        return false;
      }
      return isRealConcert(artist.name, artist.genres);
    });

    console.log(`📊 Processing ${realConcertArtists.length} real concert artists out of ${args.artists.length} total (filtered residencies with 50+ events)`);

    const existing = await ctx.db.query("trendingArtists").collect();
    const existingMap = new Map(existing.map((doc) => [doc.ticketmasterId, doc]));
    const keep = new Set(realConcertArtists.map((artist) => artist.ticketmasterId));

    for (const doc of existing) {
      if (!keep.has(doc.ticketmasterId)) {
        await ctx.db.delete(doc._id);
      }
    }

    // STEP 1: Build enriched artist data with Spotify popularity
    const enrichedArtists: Array<{
      ticketmasterId: string;
      linkedArtist: any;
      artist: typeof realConcertArtists[0];
      spotifyPopularity: number;
    }> = [];

    for (const artist of realConcertArtists) {
      const linkedArtist = await ctx.db
        .query("artists")
        .withIndex("by_ticketmaster_id", (q) =>
          q.eq("ticketmasterId", artist.ticketmasterId)
        )
        .first();

      // Get Spotify popularity (0-100) if available
      const spotifyPopularity = linkedArtist?.popularity || 0;

      enrichedArtists.push({
        ticketmasterId: artist.ticketmasterId,
        linkedArtist,
        artist,
        spotifyPopularity,
      });
    }

    // STEP 2: Sort by Spotify popularity (DESC), then upcomingEvents as tiebreaker
    // This ensures artists like Beyonce (popularity 90+) rank higher than Barry Manilow
    enrichedArtists.sort((a, b) => {
      // Primary: Spotify popularity (higher = more popular currently)
      if (a.spotifyPopularity !== b.spotifyPopularity) {
        return b.spotifyPopularity - a.spotifyPopularity;
      }
      // Secondary: Upcoming events (more events = bigger tour)
      return b.artist.upcomingEvents - a.artist.upcomingEvents;
    });

    console.log(`🎵 Top 5 by Spotify popularity: ${enrichedArtists.slice(0, 5).map(a => `${a.artist.name}(${a.spotifyPopularity})`).join(', ')}`);

    // STEP 3: Update cache with new rankings
    for (let i = 0; i < enrichedArtists.length; i++) {
      const { ticketmasterId, linkedArtist, artist } = enrichedArtists[i];
      const newRank = i + 1; // 1-based rank

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
        rank: newRank, // Use Spotify-sorted rank instead of Ticketmaster rank
        lastUpdated: args.fetchedAt,
      };

      const existingDoc = existingMap.get(ticketmasterId);
      if (existingDoc) {
        await ctx.db.patch(existingDoc._id, payload);
        existingMap.delete(ticketmasterId);
      } else {
        await ctx.db.insert("trendingArtists", {
          ticketmasterId,
          ...payload,
        });
      }
    }

    return null;
  },
});

// Calculate and cache supporting fields used for trending.
// FIXED: Use .collect() instead of .paginate() to avoid "multiple paginated queries" error
// Convex only supports a single paginated query per function
export const updateArtistShowCounts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔄 Updating artist show counts...");

    // Build a map of upcoming show counts per artist.
    // Bounded read: unbounded .collect() exceeds Convex's read limits at prod
    // scale (~45k shows). Counts are capped — computed from at most the first
    // 5000 upcoming shows.
    const upcomingShows = await ctx.db
      .query("shows")
      .withIndex("by_status_and_date", (q) => q.eq("status", "upcoming"))
      .order("asc")
      .take(5000);

    const artistShowCounts = new Map<string, number>();
    for (const show of upcomingShows) {
      const artistKey = show.artistId.toString();
      artistShowCounts.set(
        artistKey,
        (artistShowCounts.get(artistKey) || 0) + 1
      );
    }

    // Get artists and update counts where they differ.
    // Bounded read: artists is ~1.1k rows today; cap so growth can't blow
    // Convex's read limits.
    const artists = await ctx.db.query("artists").take(3000);
    const now = Date.now();
    let updated = 0;

    for (const artist of artists) {
      const key = artist._id.toString();
      const newCount = artistShowCounts.get(key) || 0;
      const currentCount =
        typeof artist.upcomingShowsCount === "number"
          ? artist.upcomingShowsCount
          : 0;

      if (currentCount !== newCount) {
        await ctx.db.patch(artist._id, {
          upcomingShowsCount: newCount,
          lastTrendingUpdate: now,
        });
        updated++;
      }
    }

    console.log(`✅ Updated show counts for ${updated} artists (${upcomingShows.length} upcoming shows)`);
    return null;
  },
});

// Update artist trending scores and ranks based on simple heuristics.
export const updateArtistTrending = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Bounded like updateShowTrending: .collect() on a growing table
    // eventually hits Convex's 4096-document read limit.
    const artists = await ctx.db.query("artists").take(3000);
    const scored = artists.map((a) => {
      // Ensure all numeric values are properly handled to prevent NaN
      const upcomingShows = typeof a.upcomingShowsCount === 'number' ? a.upcomingShowsCount : 0;
      const followers = typeof a.followers === 'number' ? a.followers : 0;
      const popularity = typeof a.popularity === 'number' ? a.popularity : 0;

      // Calculate score with multiple factors
      const baseScore = upcomingShows + Math.floor(followers / 1_000_000) + Math.floor(popularity / 10);

      return {
        artist: a,
        score: Math.max(1, baseScore), // FIXED: Minimum score 1 to ensure ranks set
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const TOP_N = 100;
    for (let i = 0; i < scored.length; i += 1) {
      const { artist, score } = scored[i];
      const newScore = Number.isFinite(score) ? score : 1; // Minimum score 1
      const newRank = i < TOP_N ? i + 1 : 0;
      // Scores are integers here, so most runs change nothing — skipping
      // no-op patches avoids OCC conflicts with sync mutations that touch
      // the same artist documents.
      if (artist.trendingScore === newScore && artist.trendingRank === newRank) {
        continue;
      }
      await ctx.db.patch(artist._id, {
        trendingScore: newScore,
        trendingRank: newRank,
        lastTrendingUpdate: Date.now(),
      });
    }
    return null;
  },
});

export const updateShowTrending = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    // Start the window one day back (UTC): a show dated "yesterday" in UTC is
    // still the same evening in US timezones and remains status "upcoming"
    // until autoTransitionStatuses completes it the day after. Starting at the
    // UTC "today" boundary would drop these "tonight" shows from trending —
    // and the demotion loop below would zero them out — during peak pre-show
    // hours. Non-upcoming shows in that extra day are filtered out below.
    const windowStart = new Date(now - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    // Shows more than 30 days out decay to score 0, so only the 30-day window
    // affects ranking. Bounding the scan keeps reads well under Convex's
    // 4096-document limit even on large production datasets.
    const horizon = new Date(now + 31 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const upcoming = (await ctx.db
      .query("shows")
      .withIndex("by_date", (q) => q.gte("date", windowStart).lte("date", horizon))
      .order("asc")
      .take(2000))
      .filter((show) => show.status === "upcoming");

    const parsed = upcoming
      .map((s) => {
        const showDate = new Date(s.date).getTime();
        const daysUntil = (showDate - now) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 1 - (daysUntil / 30)); // Decay over 30 days, 1 for today
        const voteCount = typeof s.voteCount === 'number' ? s.voteCount : 0;
        const setlistCount = typeof s.setlistCount === 'number' ? s.setlistCount : 0;
        const engagement = voteCount + setlistCount * 2; // Weight setlists higher
        const totalScore = recencyScore * (1 + engagement / 10); // Boost by engagement
        return { show: s, score: totalScore, when: showDate };
      })
      .filter((p) => Number.isFinite(p.when) && Number.isFinite(p.score));

    // Sort by score descending, then by date ascending for ties
    parsed.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.when - b.when;
    });

    const TOP_N = 200;
    const rankedShowIds = new Set<string>();

    for (let i = 0; i < Math.min(parsed.length, TOP_N); i += 1) {
      const { show, score } = parsed[i];
      rankedShowIds.add(show._id);
      // Store scores at coarse precision so unchanged rankings become no-op
      // writes. Vote mutations patch these same documents concurrently; every
      // skipped patch here is one less OCC conflict.
      const newScore = Number.isFinite(score) ? Math.round(score * 100) / 100 : 0;
      const newRank = i + 1;
      if (show.trendingRank === newRank && show.trendingScore === newScore) {
        continue;
      }
      await ctx.db.patch(show._id, {
        trendingScore: newScore,
        trendingRank: newRank,
        lastTrendingUpdate: now,
      });
    }

    const previouslyRanked = await ctx.db
      .query("shows")
      .withIndex("by_trending_rank", (q) => q.gt("trendingRank", 0))
      .take(TOP_N * 2);

    for (const show of previouslyRanked) {
      if (rankedShowIds.has(show._id)) continue;
      await ctx.db.patch(show._id, {
        trendingScore: 0,
        trendingRank: 0,
        lastTrendingUpdate: now,
      });
    }

    return null;
  },
});

// Internal queries to fetch top-ranked artists and shows for cache refresh
export const getTopRankedArtists = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const rows = await ctx.db
      .query("artists")
      .withIndex("by_trending_rank")
      .order("asc")
      .take(limit * 2);
    return rows.filter((a: any) => typeof a.trendingRank === "number" && a.trendingRank > 0).slice(0, limit);
  },
});

export const getTopRankedShows = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const rows = await ctx.db
      .query("shows")
      .withIndex("by_trending_rank")
      .order("asc")
      .take(limit * 2);
    return rows.filter((s: any) => typeof s.trendingRank === "number" && s.trendingRank > 0).slice(0, limit);
  },
});

// Update engagement counts (voteCount and setlistCount) for shows.
// REWORKED: the previous version full-table-scanned setlists, votes,
// songVotes, AND shows (~45k rows) — that hard-fails Convex's per-function
// read limits at prod scale. Instead we bound the recompute to shows in a
// recent window (last 90 days + future) via the by_date index, then read each
// show's setlists (by_show) and per-setlist votes/songVotes (by_setlist) with
// bounded takes. Counts are capped by the per-item takes below; shows outside
// the window (or beyond the per-run cap) keep their existing counts.
export const updateEngagementCounts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔄 Updating show engagement counts...");

    // Shows in window: last 90 days + future (dates are "YYYY-MM-DD" strings).
    const now = Date.now();
    const windowStart = new Date(now - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const windowShows = await ctx.db
      .query("shows")
      .withIndex("by_date", (q) => q.gte("date", windowStart))
      .take(2000);

    // Per-show sub-reads (setlists + votes + songVotes) for 2000 shows would
    // exceed read limits, so process at most 300 shows per invocation,
    // prioritizing shows closest to today (most trending-relevant).
    const MAX_SHOWS_PER_RUN = 300;
    const byProximity = [...windowShows].sort((a, b) => {
      const aMs = new Date(a.date).getTime();
      const bMs = new Date(b.date).getTime();
      const aDist = Number.isFinite(aMs) ? Math.abs(aMs - now) : Infinity;
      const bDist = Number.isFinite(bMs) ? Math.abs(bMs - now) : Infinity;
      return aDist - bDist;
    });
    const showsToProcess = byProximity.slice(0, MAX_SHOWS_PER_RUN);
    const skipped = windowShows.length - showsToProcess.length;

    let updated = 0;
    let setlistsSeen = 0;
    let votesSeen = 0;

    for (const show of showsToProcess) {
      // Bounded per-show reads; counts cap at the take() sizes.
      const setlists = await ctx.db
        .query("setlists")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .take(20);

      let voteCount = 0;
      for (const setlist of setlists) {
        const [votes, songVotes] = await Promise.all([
          ctx.db
            .query("votes")
            .withIndex("by_setlist", (q) => q.eq("setlistId", setlist._id))
            .take(500),
          ctx.db
            .query("songVotes")
            .withIndex("by_setlist", (q) => q.eq("setlistId", setlist._id))
            .take(500),
        ]);
        voteCount += votes.length + songVotes.length;
      }

      setlistsSeen += setlists.length;
      votesSeen += voteCount;

      const newSetlistCount = setlists.length;
      // Patch only when changed — no-op patches cause OCC conflicts.
      if (
        show.setlistCount !== newSetlistCount ||
        show.voteCount !== voteCount
      ) {
        await ctx.db.patch(show._id, {
          setlistCount: newSetlistCount,
          voteCount,
        });
        updated++;
      }
    }

    if (skipped > 0) {
      console.log(
        `⚠️ Engagement recompute is partial: ${skipped} of ${windowShows.length} in-window shows skipped this run (cap ${MAX_SHOWS_PER_RUN}/invocation).`
      );
    }
    console.log(
      `✅ Updated engagement counts for ${updated}/${showsToProcess.length} processed shows (${setlistsSeen} setlists, ${votesSeen} votes counted)`
    );
    return null;
  },
});

export const updateAll = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("📊 Updating trending data...");

    // Update artists: Fetch TM trending, compute scores
    const tmResponse = await fetchTicketmasterTrendingArtists();
    if (tmResponse?.artists) {
      const artists = tmResponse.artists.slice(0, 20);
      const updated = [];
      for (let i = 0; i < artists.length; i++) {
        const tmArtist = artists[i];
        let artist = await ctx.runQuery(internalRef.artists.getByTicketmasterIdInternal, { ticketmasterId: tmArtist.id });

        if (!artist) {
          const newArtistId = await ctx.runMutation(internalRef.artists.createFromTicketmaster, {
            ticketmasterId: tmArtist.id,
            name: tmArtist.name,
            genres: tmArtist.genres,
            images: tmArtist.images,
          });
          // Skip if null (non-musical artist like festival or theatrical)
          if (!newArtistId) {
            console.log(`⏭️ Skipping non-artist from trending: ${tmArtist.name}`);
            continue;
          }
          artist = await ctx.runQuery(internalRef.artists.getByIdInternal, { id: newArtistId });
        }

        if (!artist) continue; // Skip if creation failed

        const upcomingCount = await ctx.runQuery(internalRef.shows.getUpcomingCountByArtist, { artistId: artist._id });
        const score = (tmArtist.popularity || 0) * (upcomingCount || 1) * (artist.followers || 1) / 1000000;

        // Update via mutations
        await ctx.runMutation(internalRef.trending.updateTrendingArtist, {
          artistId: artist._id,
          ticketmasterId: tmArtist.id,
          name: tmArtist.name,
          slug: artist.slug,
          genres: tmArtist.genres || [],
          images: tmArtist.images || [],
          upcomingEvents: upcomingCount,
          rank: i + 1,
          score,
        });

        updated.push({ name: tmArtist.name, score });
      }

      console.log(`✅ Updated ${updated.length} trending artists`);
    }

    console.log("✅ Updated trending data");
    return null;
  },
});

export const updateTrendingArtist = internalMutation({
  args: {
    artistId: v.id("artists"),
    ticketmasterId: v.string(),
    name: v.string(),
    slug: v.string(),
    genres: v.array(v.string()),
    images: v.array(v.string()),
    upcomingEvents: v.number(),
    rank: v.number(),
    score: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Update cache table
    const existing = await ctx.db
      .query("trendingArtists")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        rank: args.rank,
        lastUpdated: Date.now(),
        upcomingEvents: args.upcomingEvents,
      });
    } else {
      await ctx.db.insert("trendingArtists", {
        artistId: args.artistId,
        ticketmasterId: args.ticketmasterId,
        name: args.name,
        slug: args.slug,
        genres: args.genres,
        images: args.images,
        upcomingEvents: args.upcomingEvents,
        rank: args.rank,
        lastUpdated: Date.now(),
      });
    }

    // Patch canonical artist
    await ctx.db.patch(args.artistId, {
      trendingScore: args.score,
      trendingRank: args.rank,
      lastTrendingUpdate: Date.now(),
    });

    return null;
  },
});

// Public helper: fetch cached trending show row by Ticketmaster ID
export const getCachedShowByTicketmasterId = query({
  args: { ticketmasterId: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("trendingShows")
      .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", args.ticketmasterId))
      .first();
    return row ?? null;
  },
});

// Public helper: fetch cached trending artist row by Ticketmaster ID
export const getCachedArtistByTicketmasterId = query({
  args: { ticketmasterId: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("trendingArtists")
      .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", args.ticketmasterId))
      .first();
    return row ?? null;
  },
});

async function fetchTicketmasterTrendingArtists() {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.error("❌ TICKETMASTER_API_KEY not configured");
    return { artists: [] };
  }

  try {
    const response = await fetch(`https://app.ticketmaster.com/discovery/v2/attractions.json?classificationName=music&size=20&apikey=${apiKey}`);

    if (!response.ok) {
      const errorMsg = `Ticketmaster API error: ${response.status}`;
      console.error(`❌ ${errorMsg}`);
      if (response.status === 429) {
        console.error("⚠️  Rate limited by Ticketmaster API");
      }
      return { artists: [] };
    }

    const data = await response.json();
    const attractions = data._embedded?.attractions || [];

    return {
      artists: attractions.map((attraction: any) => ({
        id: attraction.id,
        name: attraction.name,
        genres: attraction.classifications?.[0]?.genre?.name ? [attraction.classifications[0].genre.name] : [],
        images: attraction.images?.map((img: any) => img.url) || [],
        popularity: attraction.upcomingEvents?._total || 0,
      }))
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Failed to fetch trending artists: ${errorMsg}`);
    return { artists: [] };
  }
}

async function fetchTicketmasterTrendingShows() {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.error("❌ TICKETMASTER_API_KEY not configured");
    return { shows: [] };
  }

  try {
    const response = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&size=20&sort=date,asc&apikey=${apiKey}`);

    if (!response.ok) {
      const errorMsg = `Ticketmaster API error: ${response.status}`;
      console.error(`❌ ${errorMsg}`);
      if (response.status === 429) {
        console.error("⚠️  Rate limited by Ticketmaster API");
      }
      return { shows: [] };
    }

    const data = await response.json();
    const events = data._embedded?.events || [];

    return {
      shows: events.map((event: any) => ({
        id: event.id,
        name: event.name,
        date: event.dates?.start?.localDate,
        venue: event._embedded?.venues?.[0],
        artist: event._embedded?.attractions?.[0],
      }))
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Failed to fetch trending shows: ${errorMsg}`);
    return { shows: [] };
  }
}
