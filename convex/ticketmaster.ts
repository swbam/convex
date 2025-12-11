"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

// ============================================================================
// FESTIVAL DETECTION HELPERS
// ============================================================================

/**
 * Known major festival name patterns for detection
 */
const KNOWN_FESTIVAL_PATTERNS = [
  /\brailbird\b/i,
  /\bcoachella\b/i,
  /\bbonnaroo\b/i,
  /\blollapalooza\b/i,
  /\bstagecoach\b/i,
  /\bbottlerock\b/i,
  /\belectric forest\b/i,
  /\bedc\b/i,
  /\bultra\s+(music\s+)?festival\b/i,
  /\bgovernors\s+ball\b/i,
  /\bfirefly\s+(music\s+)?festival\b/i,
  /\boutside\s+lands\b/i,
  /\brolling\s+loud\b/i,
  /\bsummerfest\b/i,
  /\briot\s+fest\b/i,
  /\bshaky\s+knees\b/i,
  /\bangout\s+(music\s+)?fest/i,
  /\bpitchfork\s+(music\s+)?fest/i,
  /\blife\s+is\s+beautiful\b/i,
  /\bwhen\s+we\s+were\s+young\b/i,
  /\bacl\s+fest/i,
  /\baustin\s+city\s+limits\b/i,
  /\bsxsw\b/i,
];

/**
 * Detect if a Ticketmaster event is a music festival
 */
function isFestivalEvent(event: any): boolean {
  const eventName = String(event.name || "").toLowerCase();
  const venueName = String(event._embedded?.venues?.[0]?.name || "").toLowerCase();
  
  // Check for "festival" in the name (common pattern)
  if (/\bfestival\b/i.test(eventName) || /\bfest\b/i.test(eventName)) {
    // Exclude false positives like "Festival of Lights" or non-music
    const isNonMusic = /\b(lights?|food|beer|wine|art|film|comedy|dance)\s*(festival|fest)\b/i.test(eventName);
    if (!isNonMusic) return true;
  }
  
  // Check against known festival patterns
  for (const pattern of KNOWN_FESTIVAL_PATTERNS) {
    if (pattern.test(eventName) || pattern.test(venueName)) {
      return true;
    }
  }
  
  // Check Ticketmaster classifications
  const classifications = event.classifications || [];
  for (const classification of classifications) {
    const genreName = String(classification.genre?.name || "").toLowerCase();
    const subGenreName = String(classification.subGenre?.name || "").toLowerCase();
    const segmentName = String(classification.segment?.name || "").toLowerCase();
    
    if (genreName === "festival" || subGenreName === "festival") {
      return true;
    }
    
    // Music segment with festival in type
    if (segmentName === "music" && /festival/i.test(String(classification.type?.name || ""))) {
      return true;
    }
  }
  
  return false;
}

const TICKETMASTER_HTTP_TIMEOUT_MS = 30_000;
const TICKETMASTER_MAX_ATTEMPTS = 3;

async function tmFetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = TICKETMASTER_HTTP_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function tmFetchWithRetry(
  url: string,
  init: RequestInit = {},
  maxAttempts: number = TICKETMASTER_MAX_ATTEMPTS
): Promise<Response> {
  let attempt = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastError: any;
  while (attempt < maxAttempts) {
    try {
      return await tmFetchWithTimeout(url, init);
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= maxAttempts) {
        console.error(`Ticketmaster fetch failed after ${attempt} attempts for ${url}:`, error);
        throw error;
      }
      const backoffMs = 500 * attempt;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError ?? new Error("Ticketmaster tmFetchWithRetry failed");
}

// Ticketmaster API integration for artist search
export const searchArtists = action({
  args: { 
    query: v.string(),
    limit: v.optional(v.number())
  },
  returns: v.array(v.object({
    ticketmasterId: v.string(),
    name: v.string(),
    genres: v.array(v.string()),
    images: v.array(v.string()),
    url: v.optional(v.string()),
    upcomingEvents: v.number(),
  })),
  handler: async (ctx, args) => {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      throw new Error("Ticketmaster API key not configured");
    }

    const limit = args.limit || 20;
    const url = `https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=${encodeURIComponent(args.query)}&classificationName=music&size=${limit}&apikey=${apiKey}`;

    try {
      const response = await tmFetchWithRetry(url);
      if (!response.ok) {
        throw new Error(`Ticketmaster API error: ${response.status}`);
      }

      const data = await response.json();
      const attractions = data._embedded?.attractions || [];

      return attractions.map((attraction: any) => ({
        ticketmasterId: String(attraction.id || ''),
        name: String(attraction.name || ''),
        genres: attraction.classifications?.[0]?.genre?.name ? [String(attraction.classifications[0].genre.name)] : [],
        images: (attraction.images?.map((img: any) => String(img.url)) || []),
        url: attraction.url ? String(attraction.url) : undefined,
        upcomingEvents: (() => {
          const events = Number(attraction.upcomingEvents?._total || 0);
          return Number.isFinite(events) ? events : 0;
        })()
      }));
    } catch (error) {
      console.error("Ticketmaster search failed:", error);
      throw new Error("Failed to search artists");
    }
  },
});

// OPTIMIZED: Non-blocking artist sync with progressive loading
// Returns artistId immediately, imports run in background
// Also handles festivals - returns festival info if detected
// AUTO-OUTRANKING: Passes upcomingEvents for immediate trending score calculation
export const triggerFullArtistSync = action({
  args: {
    ticketmasterId: v.string(),
    artistName: v.string(),
    genres: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    upcomingEvents: v.optional(v.number()), // For auto-ranking massive artists
  },
  returns: v.object({
    type: v.union(v.literal("artist"), v.literal("festival")),
    artistId: v.optional(v.id("artists")),
    festivalId: v.optional(v.id("festivals")),
    slug: v.string(),
  }),
  handler: async (ctx, args) => {
    const upcomingEvents = args.upcomingEvents || 0;
    console.log(`🚀 Starting optimized sync for: ${args.artistName} (${upcomingEvents} upcoming events)`);
    
    // FESTIVAL DETECTION: Check if this is a festival, not an artist
    const nameLower = args.artistName.toLowerCase();
    const isFestival = /\bfestival\b/i.test(nameLower) || 
                       /\bfest\b/i.test(nameLower) ||
                       isFestivalEvent({ name: args.artistName });
    
    if (isFestival) {
      console.log(`🎪 Detected festival: ${args.artistName}`);
      
      // Extract year from name or use current year
      const yearMatch = args.artistName.match(/\b(20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
      
      // Create festival slug
      const slug = args.artistName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
      
      // Try to create or find the festival
      const festivalId = await ctx.runMutation(internalRef.festivals.upsertFestivalFromEvent, {
        eventName: args.artistName,
        eventDate: `${year}-06-01`, // Default to June 1 if no date
        ticketmasterId: args.ticketmasterId,
      });
      
      if (festivalId) {
        console.log(`✅ Festival created/found: ${festivalId}`);
        return {
          type: "festival" as const,
          festivalId,
          slug,
        };
      } else {
        // Fallback: throw error with helpful message
        throw new Error(`Could not create festival for "${args.artistName}". This appears to be a festival, not an artist.`);
      }
    }

    // Centralized scheduler delays for progressive phases
    const SCHEDULER_DELAYS = {
      shows: 0,
      catalog: 3000,
      basics: 6000,
      counts: 10000,
    } as const;

    // Phase 1: Create basic artist (FAST - < 1 second)
    // AUTO-OUTRANKING: Pass upcomingEvents for immediate trending score calculation
    const artistId = await ctx.runMutation(internalRef.artists.createFromTicketmaster, {
      ticketmasterId: args.ticketmasterId,
      name: args.artistName,
      genres: args.genres || [],
      images: args.images || [],
      upcomingEvents, // For auto-ranking massive artists
    });
    
    // Handle null return (non-concert entity that wasn't caught as festival)
    if (!artistId) {
      throw new Error(`"${args.artistName}" is not a musical artist. Try searching for a band, singer, or musician.`);
    }

    // Initialize sync status
    await ctx.runMutation(internalRef.artistSync.initializeSyncStatus, {
      artistId,
    });

    // Get artist slug for navigation
    const artist = await ctx.runQuery(internalRef.artists.getByIdInternal, { id: artistId });
    const slug = artist?.slug || artistId;

    // RETURN IMMEDIATELY - frontend can navigate now!
    // Background imports scheduled below (non-blocking)
    
    // Priority 1: Shows (user sees these first) - starts immediately
    void ctx.scheduler.runAfter(SCHEDULER_DELAYS.shows, internalRef.ticketmaster.syncArtistShowsWithTracking, {
      artistId,
      ticketmasterId: args.ticketmasterId,
      artistName: args.artistName,
    });
    
    // Priority 2: Catalog (for setlist generation) - starts after 3 seconds
    void ctx.scheduler.runAfter(SCHEDULER_DELAYS.catalog, internalRef.ticketmaster.syncArtistCatalogWithTracking, {
      artistId,
      artistName: args.artistName,
    });
    
    // Priority 3: Metadata enrichment (nice to have) - starts after 6 seconds
    void ctx.scheduler.runAfter(SCHEDULER_DELAYS.basics, internalRef.ticketmaster.enrichArtistBasicsWithTracking, {
      artistId,
      artistName: args.artistName,
    });
    
    // Priority 4: Update counts (after everything else) - starts after 10 seconds
    void ctx.scheduler.runAfter(SCHEDULER_DELAYS.counts, internalRef.maintenance.updateArtistCounts, { artistId });

    console.log(`✅ Artist ${artistId} created, background sync scheduled`);
    return {
      type: "artist" as const,
      artistId,
      slug,
    };
  },
});

// Wrapper with status tracking for progressive loading
export const syncArtistShowsWithTracking = internalAction({
  args: {
    artistId: v.id("artists"),
    ticketmasterId: v.string(),
    artistName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log(`📅 Starting show sync with tracking for ${args.artistName}...`);
      
      // Call existing sync logic
      await ctx.runAction(internalRef.ticketmaster.syncArtistShows, {
        artistId: args.artistId,
        ticketmasterId: args.ticketmasterId,
      });
      
      // Get count of shows imported
      const showCount = await ctx.runQuery(internalRef.shows.countByArtist, {
        artistId: args.artistId,
      });
      
      // Mark shows as imported
      await ctx.runMutation(internalRef.artistSync.updateSyncStatus, {
        artistId: args.artistId,
        showsImported: true,
        showCount,
        phase: "catalog",
      });
      
      console.log(`✅ Shows imported for ${args.artistName}: ${showCount} shows`);
    } catch (error) {
      console.error(`❌ Failed to sync shows for ${args.artistName}:`, error);
      await ctx.runMutation(internalRef.artistSync.updateSyncStatus, {
        artistId: args.artistId,
        error: "Failed to import shows",
        phase: "error",
      });
    }
    return null;
  },
});

// Wrapper for catalog sync with tracking
export const syncArtistCatalogWithTracking = internalAction({
  args: {
    artistId: v.id("artists"),
    artistName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log(`🎧 Starting catalog sync with tracking for ${args.artistName}...`);
      
      await ctx.runAction(internalRef.spotify.syncArtistCatalog, {
        artistId: args.artistId,
        artistName: args.artistName,
      });
      
      // Get count of songs imported
      const songs = await ctx.runQuery(internalRef.songs.countByArtist, {
        artistId: args.artistId,
      });
      
      await ctx.runMutation(internalRef.artistSync.updateSyncStatus, {
        artistId: args.artistId,
        catalogImported: true,
        songCount: songs,
        phase: "enriching",
      });

      // After catalog import, ensure all upcoming shows have a prediction setlist
      try {
        await ctx.runMutation(internalRef.setlists.ensurePredictionsForArtistShows, {
          artistId: args.artistId,
        });
      } catch (e) {
        console.error(
          `⚠️ Failed to ensure prediction setlists for ${args.artistName}:`,
          e,
        );
      }

      console.log(`✅ Catalog imported for ${args.artistName}: ${songs} songs`);
    } catch (error) {
      console.error(`❌ Failed to sync catalog for ${args.artistName}:`, error);
      // Don't mark as error - shows still work without catalog
      await ctx.runMutation(internalRef.artistSync.updateSyncStatus, {
        artistId: args.artistId,
        catalogImported: false,
        phase: "enriching", // Continue to next phase
      });
    }
    return null;
  },
    });

// Wrapper for basics enrichment with tracking
export const enrichArtistBasicsWithTracking = internalAction({
  args: {
    artistId: v.id("artists"),
    artistName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log(`🎵 Starting basics enrichment with tracking for ${args.artistName}...`);
      await ctx.runAction(internalRef.spotify.enrichArtistBasics, {
        artistId: args.artistId,
        artistName: args.artistName,
      });
      
      await ctx.runMutation(internalRef.artistSync.updateSyncStatus, {
        artistId: args.artistId,
        basicsEnriched: true,
        phase: "complete",
      });
      
      console.log(`✅ Basics enriched for ${args.artistName}`);
    } catch (error) {
      console.error(`❌ Failed to enrich basics for ${args.artistName}:`, error);
      // Mark as complete anyway - shows and catalog are the important parts
      await ctx.runMutation(internalRef.artistSync.updateSyncStatus, {
        artistId: args.artistId,
        basicsEnriched: false,
        phase: "complete",
      });
    }
    return null;
  },
});

// Internal helper: search Ticketmaster by name and sync shows for an artist.
// Used when new artists are imported from Spotify.
export const searchAndSyncArtistShows = internalAction({
  args: {
    artistId: v.id("artists"),
    artistName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ TICKETMASTER_API_KEY not configured – skipping searchAndSyncArtistShows");
      return null;
    }

    const searchUrl = `https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=${encodeURIComponent(
      args.artistName,
    )}&classificationName=music&size=10&apikey=${apiKey}`;

    try {
      const response = await tmFetchWithRetry(searchUrl);
      if (!response.ok) {
        console.error(
          `❌ Ticketmaster search error for "${args.artistName}": ${response.status}`,
        );
        return null;
      }

      const data = await response.json();
      const attractions = data._embedded?.attractions || [];
      if (!attractions.length) {
        console.log(
          `ℹ️ No Ticketmaster attractions found for "${args.artistName}"`,
        );
        return null;
      }

      // Simple best‑match: case‑insensitive name match, then highest upcoming events
      const normalizedTarget = args.artistName.toLowerCase();
      let best = attractions[0];
      let bestScore = 0;

      for (const attraction of attractions) {
        const name = String(attraction.name || "");
        const norm = name.toLowerCase();
        let score = 0;

        if (norm === normalizedTarget) score += 3;
        else if (norm.includes(normalizedTarget) || normalizedTarget.includes(norm)) score += 2;

        const events = Number(attraction.upcomingEvents?._total || 0);
        if (Number.isFinite(events)) score += Math.min(events, 10) / 10;

        if (score > bestScore) {
          bestScore = score;
          best = attraction;
        }
      }

      const ticketmasterId = String(best.id || "");
      if (!ticketmasterId) {
        console.log(
          `ℹ️ Best Ticketmaster match for "${args.artistName}" has no id`,
        );
        return null;
      }

      console.log(
        `🎫 Matched "${args.artistName}" to Ticketmaster attraction "${best.name}" (${ticketmasterId}) with score ${bestScore}`,
      );

      // Persist Ticketmaster ID on artist for future syncs
      try {
        await ctx.runMutation(internalRef.artists.setTicketmasterId, {
          artistId: args.artistId,
          ticketmasterId,
        });
      } catch (e) {
        console.warn("⚠️ Failed to set Ticketmaster ID on artist:", e);
      }

      // Reuse the tracked show sync wrapper so syncStatus is updated
      await ctx.runAction(internalRef.ticketmaster.syncArtistShowsWithTracking, {
        artistId: args.artistId,
        ticketmasterId,
        artistName: args.artistName,
      });

      return null;
    } catch (error) {
      console.error(
        `❌ searchAndSyncArtistShows failed for "${args.artistName}":`,
        error,
      );
      return null;
    }
  },
});

export const syncArtistShows = internalAction({
  args: {
    artistId: v.id("artists"),
    ticketmasterId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      console.error("❌ TICKETMASTER_API_KEY not configured");
      return null;
    }

    const url = `https://app.ticketmaster.com/discovery/v2/events.json?attractionId=${args.ticketmasterId}&size=200&apikey=${apiKey}`;

    try {
      console.log(`🔍 Fetching shows for Ticketmaster ID: ${args.ticketmasterId}`);
      const response = await tmFetchWithRetry(url);

      if (!response.ok) {
        const errorMsg = `Ticketmaster API error: ${response.status}`;
        console.error(`❌ ${errorMsg}`);
        if (response.status === 429) {
          console.error("⚠️  Rate limited by Ticketmaster API");
        }
        return null;
      }

      const data = await response.json();
      const events = data._embedded?.events || [];

      console.log(`📅 Found ${events.length} shows for artist ${args.ticketmasterId}`);

      for (const event of events) {
        // Create or get venue
        const venue = event._embedded?.venues?.[0];
        // CRITICAL: Ensure all venue fields are properly populated
        const venueId = await ctx.runMutation(internalRef.venues.createFromTicketmaster, {
          ticketmasterId: venue?.id ? String(venue.id) : undefined,
          name: venue?.name ? String(venue.name) : "Unknown Venue",
          city: venue?.city?.name ? String(venue.city.name) : "Unknown City",
          state: venue?.state?.stateCode ? String(venue.state.stateCode) : (venue?.state?.name ? String(venue.state.name) : undefined),
          country: venue?.country?.name ? String(venue.country.name) : (venue?.country?.countryCode ? String(venue.country.countryCode) : "US"),
          address: venue?.address?.line1 ? String(venue.address.line1) : undefined,
          capacity: venue?.generalInfo?.generalRule ? (() => {
            const parsed = parseInt(venue.generalInfo.generalRule, 10);
            return Number.isFinite(parsed) ? parsed : undefined;
          })() : (venue?.capacity ? (() => {
            const parsed = parseInt(String(venue.capacity), 10);
            return Number.isFinite(parsed) ? parsed : undefined;
          })() : undefined),
          lat: venue?.location?.latitude ? (() => {
            const parsed = parseFloat(String(venue.location.latitude));
            return Number.isFinite(parsed) ? parsed : undefined;
          })() : undefined,
          lng: venue?.location?.longitude ? (() => {
            const parsed = parseFloat(String(venue.location.longitude));
            return Number.isFinite(parsed) ? parsed : undefined;
          })() : undefined,
          postalCode: venue?.postalCode ? String(venue.postalCode) : undefined,
        });
        
        console.log(`✅ Created/found venue: ${venue?.name || 'Unknown'} (ID: ${venueId})`);

        // CRITICAL: Create show with all fields properly populated including priceRange
        const priceRange = event.priceRanges?.[0] 
          ? `$${event.priceRanges[0].min || 0}-${event.priceRanges[0].max || 0}` 
          : undefined;

        const showId = await ctx.runMutation(internalRef.shows.createFromTicketmaster, {
          artistId: args.artistId,
          venueId,
          ticketmasterId: String(event.id || ''),
          date: (() => {
            const d = String(event.dates?.start?.localDate || '').trim();
            return d && /\d{4}-\d{2}-\d{2}/.test(d) ? d : new Date().toISOString().split('T')[0];
          })(),
          startTime: (() => {
            const t = String(event.dates?.start?.localTime || '').trim();
            if (!t) return undefined;
            // Normalize to HH:mm
            const m = t.match(/^(\d{2}):(\d{2})/);
            return m ? `${m[1]}:${m[2]}` : undefined;
          })(),
          status: (() => {
            const eventDate = new Date(event.dates?.start?.localDate || '');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            eventDate.setHours(0, 0, 0, 0);
            
            // If the event is in the past, mark as completed
            if (eventDate < today) return "completed" as const;
            return "upcoming" as const;
          })(),
          ticketUrl: event.url ? String(event.url) : undefined,
        });
        
        // NEW: Patch show with priceRange after creation (since createFromTicketmaster doesn't accept it)
        if (priceRange) {
          await ctx.runMutation(internalRef.shows.updatePriceRange, {
            showId,
            priceRange,
          });
        }
        
        console.log(`✅ Created show ${showId} for ${event.name || 'Unknown Event'} ${priceRange ? `(${priceRange})` : ''}`);
        
        // FESTIVAL DETECTION: Check if this event is part of a festival
        if (isFestivalEvent(event)) {
          try {
            const eventDate = String(event.dates?.start?.localDate || '').trim();
            if (eventDate && /\d{4}-\d{2}-\d{2}/.test(eventDate)) {
              // Create or find the festival
              const festivalId = await ctx.runMutation(internalRef.festivals.upsertFestivalFromEvent, {
                eventName: String(event.name || ''),
                eventDate,
                ticketmasterId: String(event.id || ''),
                venueName: venue?.name ? String(venue.name) : undefined,
                venueCity: venue?.city?.name ? String(venue.city.name) : undefined,
                venueState: venue?.state?.stateCode ? String(venue.state.stateCode) : undefined,
                ticketUrl: event.url ? String(event.url) : undefined,
              });
              
              if (festivalId) {
                // Link the show to the festival
                await ctx.runMutation(internalRef.festivals.linkShowToFestival, {
                  showId,
                  festivalId,
                });
                console.log(`🎪 Linked show to festival: ${event.name}`);
              }
            }
          } catch (festivalError) {
            console.warn(`⚠️ Failed to link show to festival:`, festivalError);
            // Non-blocking - show was still created successfully
          }
        }
        
        // gentle backoff to respect API
        await new Promise(r => setTimeout(r, 75));
      }

      console.log(`✅ Synced ${events.length} shows for artist (ID: ${args.artistId})`);
      
      // CRITICAL: Update artist's upcomingShowsCount after syncing shows
      const upcomingShows = await ctx.runQuery(internalRef.shows.countUpcomingByArtist, { artistId: args.artistId });
      await ctx.runMutation(internalRef.artists.updateShowCount, {
        artistId: args.artistId,
        upcomingShowsCount: upcomingShows,
      });
      console.log(`✅ Updated show count for artist: ${upcomingShows} upcoming shows`);
      
      // FIXED: Await scheduler call to prevent dangling promise warning
      try {
        await ctx.scheduler.runAfter(0, internalRef.trending.updateShowTrending, {});
      } catch (e) {
        console.log('⚠️ Failed to schedule trending refresh after sync', e);
      }
    } catch (error) {
      console.error("Failed to sync artist shows:", error);
    }
    return null;
  },
});



// Get trending shows from Ticketmaster API
export const getTrendingShows = action({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    ticketmasterId: v.string(),
    artistTicketmasterId: v.optional(v.string()),
    artistName: v.string(),
    venueName: v.string(),
    venueCity: v.string(),
    venueCountry: v.string(),
    date: v.string(),
    startTime: v.optional(v.string()),
    artistImage: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    status: v.string(),
  })),
  handler: async (ctx, args) => {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      console.error("TICKETMASTER_API_KEY not set");
      return [];
    }

    const limit = args.limit || 50;
    
    // ULTRA-ENHANCED: Get top trending stadium shows with proper Ticketmaster API usage
    const now = new Date();
    const startDate = now.toISOString().split('T')[0]; // Today
    const futureDate = new Date(now.getTime() + (180 * 24 * 60 * 60 * 1000)); // Next 6 months
    const endDate = futureDate.toISOString().split('T')[0];
    
    // CRITICAL: Use Ticketmaster's discovery API with proper filters
    // - segmentId=KZFzniwnSyZfZ7v7nJ is the OFFICIAL Music segment ID (filters out theatre, film, sports)
    // - This is more reliable than segmentName=Music
    // - Sort by date ascending to get upcoming shows first
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?segmentId=KZFzniwnSyZfZ7v7nJ&countryCode=US&startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z&size=${limit * 2}&sort=date,asc&apikey=${apiKey}`;

    try {
      console.log(`🎫 Fetching trending shows from Ticketmaster...`);
      const response = await tmFetchWithRetry(url);
      if (!response.ok) {
        console.error("Ticketmaster API error:", response.status, response.statusText);
        
        // FALLBACK: Try simpler query if detailed one fails - MUST include US filter
        // Use segmentId for Music to filter out theatre, film, sports
        const fallbackUrl = `https://app.ticketmaster.com/discovery/v2/events.json?segmentId=KZFzniwnSyZfZ7v7nJ&countryCode=US&size=${limit}&sort=date,asc&apikey=${apiKey}`;
        const fallbackResponse = await tmFetchWithRetry(fallbackUrl);
        if (!fallbackResponse.ok) return [];
        const fallbackData = await fallbackResponse.json();
        const events = fallbackData._embedded?.events || [];
        console.log(`✅ Fetched ${events.length} shows (fallback query)`);
        return events.map((event: any) => ({
          ticketmasterId: String(event.id || ''),
          artistTicketmasterId: String(event._embedded?.attractions?.[0]?.id || ''),
          artistName: String(event._embedded?.attractions?.[0]?.name || 'Unknown Artist'),
          venueName: String(event._embedded?.venues?.[0]?.name || 'Unknown Venue'),
          venueCity: String(event._embedded?.venues?.[0]?.city?.name || ''),
          venueCountry: String(event._embedded?.venues?.[0]?.country?.name || ''),
          date: String(event.dates?.start?.localDate || ''),
          startTime: event.dates?.start?.localTime ? String(event.dates.start.localTime) : undefined,
          artistImage: (() => {
            const images = event._embedded?.attractions?.[0]?.images || [];
            const bestImage = images
              .filter((img: any) => img.url && img.width && img.height)
              .sort((a: any, b: any) => {
                const aRatio = Math.abs((a.width / a.height) - (16/9));
                const bRatio = Math.abs((b.width / b.height) - (16/9));
                if (Math.abs(aRatio - bRatio) > 0.1) return aRatio - bRatio;
                return b.width - a.width;
              })[0];
            return bestImage?.url ? String(bestImage.url) : undefined;
          })(),
          ticketUrl: event.url ? String(event.url) : undefined,
          priceRange: event.priceRanges?.[0] ? `$${event.priceRanges[0].min}-${event.priceRanges[0].max}` : undefined,
          status: String(event.dates?.status?.code || 'unknown'),
        }));
      }

      const data = await response.json();
      const events = data._embedded?.events || [];
      console.log(`✅ Fetched ${events.length} trending shows from Ticketmaster`);
      
      // ULTRA-FILTER: Get only real, high-quality shows
      const majorEvents = events.filter((event: any) => {
        const venueName = event._embedded?.venues?.[0]?.name?.toLowerCase() || '';
        const artistName = event._embedded?.attractions?.[0]?.name?.toLowerCase() || '';
        const eventDate = new Date(event.dates?.start?.localDate || '');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // CRITICAL: Only upcoming events (not past/cancelled)
        if (eventDate < today) return false;
        if (event.dates?.status?.code === 'cancelled') return false;
        if (event.dates?.status?.code === 'postponed') return false;
        
        // Include major concert venues (exclude theaters for plays)
        const isMajorVenue = venueName.includes('stadium') || 
                            venueName.includes('arena') || 
                            venueName.includes('center') ||
                            venueName.includes('amphitheatre') ||
                            venueName.includes('amphitheater') ||
                            venueName.includes('hall') ||
                            venueName.includes('sphere') ||
                            venueName.includes('bowl') ||
                            venueName.includes('pavilion') ||
                            venueName.includes('club');
        
        // CRITICAL: Exclude non-concert events
        const isNonConcert = artistName.includes('tribute') || 
                            artistName.includes('experience') ||
                            artistName.includes('cover') ||
                            artistName.includes('film with') ||
                            artistName.includes('- film') ||
                            artistName.includes('orchestra') ||
                            artistName.includes('symphony') ||
                            artistName.includes('ballet') ||
                            artistName.includes('opera') ||
                            artistName.includes('broadway') ||
                            artistName.includes('musical') ||
                            artistName.includes('cirque') ||
                            artistName.includes('comedy') ||
                            venueName.includes('playhouse') ||
                            venueName.includes('opera house');
        
        // Check if it's actually a music concert (not theater/play)
        const eventName = event.name?.toLowerCase() || '';
        const isPlay = eventName.includes('play') || 
                      eventName.includes('musical') ||
                      eventName.includes('broadway');
        
        // Exclude very niche/small genres
        const hasGoodImage = event._embedded?.attractions?.[0]?.images?.length > 0;
        
        return isMajorVenue && !isNonConcert && !isPlay && hasGoodImage;
      });
      
      console.log(`🎯 Filtered to ${majorEvents.length} major venue events`);

      // Use majorEvents if we have good results, otherwise fallback to all events
      const finalEvents = majorEvents.length >= 10 ? majorEvents : events;
      
      return finalEvents.slice(0, limit).map((event: any) => ({
        ticketmasterId: String(event.id || ''),
        artistTicketmasterId: String(event._embedded?.attractions?.[0]?.id || ''),
        artistName: String(event._embedded?.attractions?.[0]?.name || 'Unknown Artist'),
        venueName: String(event._embedded?.venues?.[0]?.name || 'Unknown Venue'),
        venueCity: String(event._embedded?.venues?.[0]?.city?.name || ''),
        venueCountry: String(event._embedded?.venues?.[0]?.country?.name || ''),
        date: String(event.dates?.start?.localDate || ''),
        startTime: event.dates?.start?.localTime ? String(event.dates.start.localTime) : undefined,
        artistImage: (() => {
          const images = event._embedded?.attractions?.[0]?.images || [];
          // Find highest quality image (16_9 ratio, then largest width)
          const bestImage = images
            .filter((img: any) => img.url && img.width && img.height)
            .sort((a: any, b: any) => {
              // Prefer 16:9 ratio images
              const aRatio = Math.abs((a.width / a.height) - (16/9));
              const bRatio = Math.abs((b.width / b.height) - (16/9));
              if (Math.abs(aRatio - bRatio) > 0.1) return aRatio - bRatio;
              // Then by width (higher quality)
              return b.width - a.width;
            })[0];
          return bestImage?.url ? String(bestImage.url) : undefined;
        })(),
        ticketUrl: event.url ? String(event.url) : undefined,
        priceRange: event.priceRanges?.[0] ? `$${event.priceRanges[0].min}-${event.priceRanges[0].max}` : undefined,
        status: String(event.dates?.status?.code || 'unknown'),
      }));
    } catch (error) {
      console.error("Failed to get trending shows:", error);
      return [];
    }
  },
});

// REMOVED: getTrendingShowsInternal - use public action directly to avoid circular type references

// Get trending artists from Ticketmaster API
export const getTrendingArtists = action({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    ticketmasterId: v.string(),
    name: v.string(),
    genres: v.array(v.string()),
    images: v.array(v.string()),
    upcomingEvents: v.number(),
    url: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      console.error("TICKETMASTER_API_KEY not set");
      return [];
    }

    const limit = args.limit || 30;
    // US-only query - get ONLY Music segment attractions (filters out theatre, film, sports)
    // segmentId=KZFzniwnSyZfZ7v7nJ is the official Ticketmaster Music segment ID
    const url = `https://app.ticketmaster.com/discovery/v2/attractions.json?segmentId=KZFzniwnSyZfZ7v7nJ&countryCode=US&size=${limit}&apikey=${apiKey}`;

    try {
      const response = await tmFetchWithRetry(url);
      if (!response.ok) {
        console.error("Ticketmaster API error:", response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      const attractions = data._embedded?.attractions || [];

      return attractions.map((attraction: any) => ({
        ticketmasterId: String(attraction.id || ''),
        name: String(attraction.name || ''),
        genres: attraction.classifications?.[0]?.genre?.name ? [String(attraction.classifications[0].genre.name)] : [],
        images: (() => {
          const images = attraction.images || [];
          // Sort by quality and return top 3 highest quality images
          return images
            .filter((img: any) => img.url && img.width && img.height)
            .sort((a: any, b: any) => {
              // Prefer 16:9 ratio images first
              const aRatio = Math.abs((a.width / a.height) - (16/9));
              const bRatio = Math.abs((b.width / b.height) - (16/9));
              if (Math.abs(aRatio - bRatio) > 0.1) return aRatio - bRatio;
              // Then by width (higher quality)
              return b.width - a.width;
            })
            .slice(0, 3)
            .map((img: any) => String(img.url));
        })(),
        upcomingEvents: (() => {
          const events = Number(attraction.upcomingEvents?._total || 0);
          return Number.isFinite(events) ? events : 0;
        })(),
        url: attraction.url ? String(attraction.url) : undefined,
      }));
    } catch (error) {
      console.error("Failed to get trending artists:", error);
      return [];
    }
  },
});

// Internal wrapper for getTrendingArtists
// REMOVED: getTrendingArtistsInternal - use public action directly to avoid circular type references

// Search shows by zip code with radius (for venue search page)
export const searchShowsByZipCode = action({
  args: {
    zipCode: v.string(),
    radius: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    ticketmasterId: v.string(),
    artistTicketmasterId: v.optional(v.string()),
    artistName: v.string(),
    artistImage: v.optional(v.string()),
    venueName: v.string(),
    venueCity: v.string(),
    venueState: v.optional(v.string()),
    date: v.string(),
    startTime: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
    priceRange: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      console.error("TICKETMASTER_API_KEY not set");
      return [];
    }

    const radius = args.radius || 40; // Default 40 miles
    const limit = args.limit || 50;
    
    // Get upcoming shows within radius of zip code
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const futureDate = new Date(now.getTime() + (180 * 24 * 60 * 60 * 1000)); // Next 6 months
    const endDate = futureDate.toISOString().split('T')[0];
    
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&postalCode=${args.zipCode}&radius=${radius}&unit=miles&startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z&size=${limit}&sort=date,asc&apikey=${apiKey}`;

    try {
      console.log(`🔍 Searching shows near ${args.zipCode} within ${radius} miles...`);
      const response = await tmFetchWithRetry(url);

      if (!response.ok) {
        console.error("Ticketmaster API error:", response.status);
        return [];
      }

      const data = await response.json();
      const events = data._embedded?.events || [];
      
      console.log(`✅ Found ${events.length} shows near ${args.zipCode}`);
      
      // Filter to only real concerts (no plays, theater, etc.)
      const concerts = events.filter((event: any) => {
        const venueName = event._embedded?.venues?.[0]?.name?.toLowerCase() || '';
        const artistName = event._embedded?.attractions?.[0]?.name?.toLowerCase() || '';
        const eventName = event.name?.toLowerCase() || '';
        
        // Exclude non-concert events
        const isNonConcert = artistName.includes('tribute') || 
                            artistName.includes('orchestra') ||
                            artistName.includes('symphony') ||
                            artistName.includes('ballet') ||
                            artistName.includes('opera') ||
                            artistName.includes('broadway') ||
                            artistName.includes('musical') ||
                            artistName.includes('comedy') ||
                            eventName.includes('play') ||
                            eventName.includes('musical') ||
                            venueName.includes('playhouse') ||
                            venueName.includes('opera house');
        
        return !isNonConcert && event._embedded?.attractions?.[0]?.images?.length > 0;
      });
      
      console.log(`🎯 Filtered to ${concerts.length} concerts`);
      
      return concerts.map((event: any) => ({
        ticketmasterId: String(event.id || ''),
        artistTicketmasterId: String(event._embedded?.attractions?.[0]?.id || ''),
        artistName: String(event._embedded?.attractions?.[0]?.name || 'Unknown Artist'),
        artistImage: (() => {
          const images = event._embedded?.attractions?.[0]?.images || [];
          const bestImage = images
            .filter((img: any) => img.url && img.width && img.height)
            .sort((a: any, b: any) => {
              const aRatio = Math.abs((a.width / a.height) - (16/9));
              const bRatio = Math.abs((b.width / b.height) - (16/9));
              if (Math.abs(aRatio - bRatio) > 0.1) return aRatio - bRatio;
              return b.width - a.width;
            })[0];
          return bestImage?.url ? String(bestImage.url) : undefined;
        })(),
        venueName: String(event._embedded?.venues?.[0]?.name || 'Unknown Venue'),
        venueCity: String(event._embedded?.venues?.[0]?.city?.name || ''),
        venueState: event._embedded?.venues?.[0]?.state?.stateCode ? String(event._embedded.venues[0].state.stateCode) : undefined,
        date: String(event.dates?.start?.localDate || ''),
        startTime: event.dates?.start?.localTime ? String(event.dates.start.localTime) : undefined,
        ticketUrl: event.url ? String(event.url) : undefined,
        priceRange: event.priceRanges?.[0] ? `$${event.priceRanges[0].min}-${event.priceRanges[0].max}` : undefined,
      }));
    } catch (error) {
      console.error("Failed to search shows by zip code:", error);
      return [];
    }
  },
});
