import { query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";

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
  returns: v.object({
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Get upcoming shows and filter by trending rank
    let shows = await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "upcoming"))
      .order("asc") // Chronological order
      .take(limit * 2);

    // Filter for shows with valid trending ranks
    shows = shows.filter(show => 
      show.trendingRank && 
      typeof show.trendingRank === "number" && 
      show.trendingRank > 0
    );

    if (shows.length === 0) {
      console.log("⚠️ No trending ranks found for shows, falling back to upcoming by date");
      shows = await ctx.db
        .query("shows")
        .withIndex("by_status", (q) => q.eq("status", "upcoming"))
        .order("asc")
        .take(limit * 2);
    }

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
    const validShows = hydrated.filter((show): show is NonNullable<typeof show> => show !== null);

    // PRODUCTION FILTER: Balance quality with availability
    const filtered = validShows.filter(show => {
      const artist = show.artist;
      const venue = show.venue;
      if (!artist || !venue) return false;

      const isUpcoming = show.status === "upcoming";
      const notUnknown = !artist.name.toLowerCase().includes("unknown");
      const hasBasicData = artist.name && artist.name.length > 0 && venue.name;

      // Relaxed: Require only upcoming status + valid artist/venue names
      // Images/Spotify are nice-to-have but not required for display
      return isUpcoming && notUnknown && hasBasicData;
    }).slice(0, limit);

    if (filtered.length < limit / 2) {
      console.warn(`Trending filtered to ${filtered.length} items—check data population (popularity/images missing). Run syncs.`);
    }

    return { page: filtered, isDone: filtered.length < limit, continueCursor: undefined };
  },
});



export const getTrendingArtists = query({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Query artists by trending rank (ascending = rank 1, 2, 3...)
    const trending = await ctx.db
      .query("artists")
      .withIndex("by_trending_rank")
      .order("asc")
      .take(limit * 2);
    
    // Filter for artists with valid ranks
    const withRanks = trending.filter(artist => 
      artist.trendingRank && 
      artist.trendingRank > 0 &&
      artist.isActive !== false
    );
    
    if (withRanks.length > 0) {
      console.log(`✅ getTrendingArtists returning ${withRanks.length} artists`);
      return { 
        page: withRanks.slice(0, limit), 
        isDone: withRanks.length < limit, 
        continueCursor: undefined 
      };
    }
    
    // Fallback: Get by popularity if no trending ranks
    console.log("⚠️ No trending ranks found, falling back to popularity");
    const allActive = await ctx.db
      .query("artists")
      .filter(q => q.eq(q.field("isActive"), true))
      .take(200);
    
    const byPopularity = allActive
      .filter(a => a.popularity && a.popularity > 0)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, limit);
    
    return { 
      page: byPopularity, 
      isDone: byPopularity.length < limit, 
      continueCursor: undefined 
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
        score: Math.max(1, baseScore), // FIXED: Minimum score 1 to ensure ranks set
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const TOP_N = 100;
    for (let i = 0; i < scored.length; i += 1) {
      const { artist, score } = scored[i];
      await ctx.db.patch(artist._id, {
        trendingScore: Number.isFinite(score) ? score : 1, // FIXED: Minimum score 1
        trendingRank: i < TOP_N ? i + 1 : 0,
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
    const upcoming = await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "upcoming"))
      .collect();

    const now = Date.now();
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
    for (let i = 0; i < parsed.length; i += 1) {
      const { show } = parsed[i];
      await ctx.db.patch(show._id, {
        trendingScore: Number.isFinite(parsed[i].score) ? parsed[i].score : 0,
        trendingRank: i < TOP_N ? i + 1 : 0,
        lastTrendingUpdate: Date.now(),
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

// Update engagement counts (voteCount and setlistCount) for shows
export const updateEngagementCounts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔄 Updating show engagement counts...");
    
    // Update setlistCount: count setlists per show
    const setlists = await ctx.db.query("setlists").collect();
    const setlistCounts = new Map();
    for (const setlist of setlists) {
      if (setlist.showId) {
        setlistCounts.set(setlist.showId.toString(), (setlistCounts.get(setlist.showId.toString()) || 0) + 1);
      }
    }
    
    // Update voteCount: count votes per show via setlists
    const votes = await ctx.db.query("votes").collect();
    const voteCounts = new Map();
    for (const vote of votes) {
      if (vote.setlistId) {
        // Get showId from setlist
        const setlist = await ctx.db.get(vote.setlistId);
        if (setlist && setlist.showId) {
          voteCounts.set(setlist.showId.toString(), (voteCounts.get(setlist.showId.toString()) || 0) + 1);
        }
      }
    }
    
    // Apply updates to shows
    const shows = await ctx.db.query("shows").collect();
    let updated = 0;
    for (const show of shows) {
      const newSetlistCount = setlistCounts.get(show._id.toString()) || 0;
      const newVoteCount = voteCounts.get(show._id.toString()) || 0;
      if (show.setlistCount !== newSetlistCount || show.voteCount !== newVoteCount) {
        await ctx.db.patch(show._id, {
          setlistCount: newSetlistCount,
          voteCount: newVoteCount,
        });
        updated++;
      }
    }
    
    console.log(`✅ Updated engagement counts for ${updated} shows`);
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
        let artist = await ctx.runQuery(internal.artists.getByTicketmasterIdInternal, { ticketmasterId: tmArtist.id });

        if (!artist) {
          const newArtistId = await ctx.runMutation(internal.artists.createFromTicketmaster, {
            ticketmasterId: tmArtist.id,
            name: tmArtist.name,
            genres: tmArtist.genres,
            images: tmArtist.images,
          });
          artist = await ctx.runQuery(internal.artists.getByIdInternal, { id: newArtistId });
        }

        if (!artist) continue; // Skip if creation failed

        const upcomingCount = await ctx.runQuery(internal.shows.getUpcomingCountByArtist, { artistId: artist._id });
        const score = (tmArtist.popularity || 0) * (upcomingCount || 1) * (artist.followers || 1) / 1000000;

        // Update via mutations
        await ctx.runMutation(internal.trending.updateTrendingArtist, {
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
