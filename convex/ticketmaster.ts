"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

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
      const response = await fetch(url);
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

// Trigger full artist sync when user clicks on search result
export const triggerFullArtistSync = action({
  args: {
    ticketmasterId: v.string(),
    artistName: v.string(),
    genres: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
  },
  returns: v.id("artists"),
  handler: async (ctx, args): Promise<Id<"artists">> => {
    console.log(`🚀 Starting full sync for artist: ${args.artistName}`);

    try {
      // Phase 1: Create basic artist record with all available data
      const artistId: Id<"artists"> = await ctx.runMutation(internal.artists.createFromTicketmaster, {
        ticketmasterId: args.ticketmasterId,
        name: args.artistName,
        genres: args.genres || [],
        images: args.images || [],
      });
      
      console.log(`✅ Created artist ${args.artistName} (ID: ${artistId})`);

      // Phase 2: Sync shows IMMEDIATELY (not async) to ensure shows are available before page loads
      console.log(`📅 Syncing shows for ${args.artistName}...`);
      await ctx.runAction(internal.ticketmaster.syncArtistShows, {
        artistId,
        ticketmasterId: args.ticketmasterId,
      });
      console.log(`✅ Shows synced for ${args.artistName}`);

      // Phase 3: Try to enrich with Spotify basics SYNCHRONOUSLY (non-blocking for UI but improves data)
      // This is a lightweight call that only gets artist metadata, not full catalog
      console.log(`🎵 Enriching with Spotify basics for ${args.artistName}...`);
      try {
        await ctx.runAction(internal.spotify.enrichArtistBasics, {
          artistId,
          artistName: args.artistName,
        });
        console.log(`✅ Spotify basics synced for ${args.artistName}`);
      } catch (spotifyError: unknown) {
        const errorMsg = spotifyError instanceof Error ? spotifyError.message : String(spotifyError);
        console.warn(`⚠️ Spotify basics sync failed (non-critical): ${errorMsg}`);
      }

      // Phase 4: Schedule FULL Spotify catalog sync in background (can be async)
      void ctx.scheduler.runAfter(0, internal.spotify.syncArtistCatalog, {
        artistId,
        artistName: args.artistName,
      });

      // Schedule trending update
      void ctx.scheduler.runAfter(5000, internal.trending.updateShowTrending, {});
      
      // Validate all fields were populated (scheduled for future implementation)
      // void ctx.scheduler.runAfter(2000, internal.common.validateArtistFields, { artistId });

      console.log(`✅ Artist ${args.artistName} fully imported with ID: ${artistId}`);
      return artistId;
    } catch (error) {
      console.error(`❌ Failed to import artist ${args.artistName}:`, error);
      throw new Error(`Failed to import artist "${args.artistName}". Please try again.`);
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
    if (!apiKey) return null;

    const url = `https://app.ticketmaster.com/discovery/v2/events.json?attractionId=${args.ticketmasterId}&size=200&apikey=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const data = await response.json();
      const events = data._embedded?.events || [];

      console.log(`📅 Found ${events.length} shows for artist`);

      for (const event of events) {
        // Create or get venue
        const venue = event._embedded?.venues?.[0];
        // CRITICAL: Ensure all venue fields are properly populated
        const venueId = await ctx.runMutation(internal.venues.createFromTicketmaster, {
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
        });
        
        console.log(`✅ Created/found venue: ${venue?.name || 'Unknown'} (ID: ${venueId})`);

        // CRITICAL: Create show with all fields properly populated including priceRange
        const priceRange = event.priceRanges?.[0] 
          ? `$${event.priceRanges[0].min || 0}-${event.priceRanges[0].max || 0}` 
          : undefined;

        const showId = await ctx.runMutation(internal.shows.createFromTicketmaster, {
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
          await ctx.runMutation(internal.shows.updatePriceRange, {
            showId,
            priceRange,
          });
        }
        
        console.log(`✅ Created show ${showId} for ${event.name || 'Unknown Event'} ${priceRange ? `(${priceRange})` : ''}`);
        
        // gentle backoff to respect API
        await new Promise(r => setTimeout(r, 75));
      }

      console.log(`✅ Synced ${events.length} shows for artist (ID: ${args.artistId})`);
      
      // CRITICAL: Update artist's upcomingShowsCount after syncing shows
      const upcomingShows = await ctx.runQuery(internal.shows.countUpcomingByArtist, { artistId: args.artistId });
      await ctx.runMutation(internal.artists.updateShowCount, {
        artistId: args.artistId,
        upcomingShowsCount: upcomingShows,
      });
      console.log(`✅ Updated show count for artist: ${upcomingShows} upcoming shows`);
      
      // Kick a trending refresh after syncing shows
      try {
        void ctx.scheduler.runAfter(0, internal.trending.updateShowTrending, {});
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
    // Simplified query - just get music events sorted by date
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&size=${limit}&sort=date,asc&apikey=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error("Ticketmaster API error:", response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      const events = data._embedded?.events || [];

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
    // Simplified query - just get music attractions
    const url = `https://app.ticketmaster.com/discovery/v2/attractions.json?classificationName=music&size=${limit}&apikey=${apiKey}`;

    try {
      const response = await fetch(url);
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

// Search and sync artist shows (internal action for Spotify import)
export const searchAndSyncArtistShows = internalAction({
  args: {
    artistId: v.id("artists"),
    artistName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) return null;
    
    try {
      // Search for artist in Ticketmaster
      const searchUrl = `https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=${encodeURIComponent(args.artistName)}&classificationName=music&apikey=${apiKey}`;
      const searchResponse = await fetch(searchUrl);
      
      if (!searchResponse.ok) return null;
      
      const searchData = await searchResponse.json();
      const attractions = searchData._embedded?.attractions || [];
      
      // Find best match
      const match = attractions.find((a: any) => 
        a.name.toLowerCase() === args.artistName.toLowerCase()
      ) || attractions[0];
      
      if (!match) return null;
      
      // Update artist with Ticketmaster ID
      await ctx.runMutation(internal.artists.setTicketmasterId, {
        artistId: args.artistId,
        ticketmasterId: match.id,
      });
      
      // Sync shows
      await ctx.runAction(internal.ticketmaster.syncArtistShows, {
        artistId: args.artistId,
        ticketmasterId: match.id,
      });
      
    } catch (error) {
      console.error(`Failed to search and sync shows for ${args.artistName}:`, error);
    }
    
    return null;
  },
});