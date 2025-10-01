import { query, internalMutation, internalAction } from "./_generated/server";
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
    
    // Try trending ranked shows first
    let shows = await ctx.db
      .query("shows")
      .withIndex("by_trending_rank")
      .order("asc")
      .filter(q => q.neq(q.field("trendingRank"), undefined))
      .take(limit * 2);

    // FALLBACK: If no trending ranks, get upcoming shows by date
    if (shows.length === 0) {
      console.log("⚠️ No trending ranks found for shows, falling back to date sort");
      shows = await ctx.db
        .query("shows")
        .withIndex("by_status", (q) => q.eq("status", "upcoming"))
        .order("desc")
        .take(limit * 2);
    }

    // Hydrate with full artist + venue data
    const hydrated = await Promise.all(shows.map(async (show) => {
      const artist = await ctx.db.get(show.artistId);
      const venue = await ctx.db.get(show.venueId);
      
      return {
        ...show,
        artist,
        venue,
      };
    }));

    // PREMIUM FILTERING: Show quality shows
    const filtered = hydrated.filter(show => {
      const artist = show.artist;
      if (!artist) return false;
      
      const hasImage = artist.images && artist.images.length > 0;
      const isUpcoming = show.status === "upcoming";
      const notUnknown = !artist.name.toLowerCase().includes("unknown");
      const hasSpotifyData = artist.spotifyId && artist.popularity;
      
      // Premium filter: Spotify-verified artists with images
      return hasImage && isUpcoming && notUnknown && hasSpotifyData;
    }).slice(0, limit);

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
    
    // Try trending ranked artists first
    let artists = await ctx.db
      .query("artists")
      .withIndex("by_trending_rank")
      .order("asc")
      .filter(q => q.neq(q.field("trendingRank"), undefined))
      .take(limit * 2);

    // FALLBACK: If no trending ranks exist yet, get by popularity
    if (artists.length === 0) {
      console.log("⚠️ No trending ranks found, falling back to popularity sort");
      const allArtists = await ctx.db
        .query("artists")
        .filter(q => q.eq(q.field("isActive"), true))
        .collect();
      
      // Sort by popularity descending
      artists = allArtists
        .filter(a => a.popularity !== undefined)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, limit * 2);
    }

    // PREMIUM FILTERING: Show quality artists
    const filtered = artists.filter(artist => {
      const hasImage = artist.images && artist.images.length > 0;
      const notUnknown = !artist.name.toLowerCase().includes("unknown");
      const notGeneric = !artist.name.toLowerCase().match(/^(various|tba|tbd|tribute|cover|film|movie)/);
      const hasSpotifyData = artist.spotifyId && artist.popularity;
      const hasRealId = artist._id.startsWith('j');
      
      // Premium filter: Must have Spotify data + image + real name
      return hasImage && notUnknown && notGeneric && hasSpotifyData && hasRealId;
    }).slice(0, limit);

    return { 
      page: filtered, 
      isDone: filtered.length < limit, 
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
        trendingRank: i < TOP_N ? i + 1 : undefined,
        lastTrendingUpdate: Date.now(),
      });
    }
    return null;
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
  // FIXED: Use attractions API, not events API!
  const response = await fetch("https://app.ticketmaster.com/discovery/v2/attractions.json?classificationName=music&size=20&apikey=" + process.env.TICKETMASTER_API_KEY);
  if (!response.ok) {
    console.error("Failed to fetch trending artists:", response.status);
    return { artists: [] };
  }
  const data = await response.json();
  const attractions = data._embedded?.attractions || [];

  // Return in expected format with artists array
  return {
    artists: attractions.map((attraction: any) => ({
      id: attraction.id,
      name: attraction.name,
      genres: attraction.classifications?.[0]?.genre?.name ? [attraction.classifications[0].genre.name] : [],
      images: attraction.images?.map((img: any) => img.url) || [],
      popularity: attraction.upcomingEvents?._total || 0,
    }))
  };
}

async function fetchTicketmasterTrendingShows() {
  const response = await fetch("https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&size=20&sort=date,asc&apikey=" + process.env.TICKETMASTER_API_KEY);
  if (!response.ok) {
    console.error("Failed to fetch trending shows:", response.status);
    return { shows: [] };
  }
  const data = await response.json();
  const events = data._embedded?.events || [];

  // Return in expected format with shows array
  return {
    shows: events.map((event: any) => ({
      id: event.id,
      name: event.name,
      date: event.dates?.start?.localDate,
      venue: event._embedded?.venues?.[0],
      artist: event._embedded?.attractions?.[0],
    }))
  };
}
