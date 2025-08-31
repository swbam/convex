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
        upcomingEvents: Number(attraction.upcomingEvents?._total || 0)
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

    // Phase 1: Create basic artist record immediately for instant response
    const artistId: Id<"artists"> = await ctx.runMutation(internal.artists.createFromTicketmaster, {
      ticketmasterId: args.ticketmasterId,
      name: args.artistName,
      genres: args.genres || [],
      images: args.images || [],
    });

    // Phase 2: Sync shows from Ticketmaster (blocking to ensure data is available)
    await ctx.runAction(internal.ticketmaster.syncArtistShows, {
      artistId,
      ticketmasterId: args.ticketmasterId,
    });

    // Phase 3: Sync catalog from Spotify (blocking to ensure songs are available)
    await ctx.runAction(internal.spotify.syncArtistCatalog, {
      artistId,
      artistName: args.artistName,
    });

    console.log(`✅ Artist ${args.artistName} created with ID: ${artistId}`);
    return artistId;
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
        const venueId = await ctx.runMutation(internal.venues.createFromTicketmaster, {
          ticketmasterId: event._embedded?.venues?.[0]?.id,
          name: event._embedded?.venues?.[0]?.name || "Unknown Venue",
          city: event._embedded?.venues?.[0]?.city?.name || "",
          country: event._embedded?.venues?.[0]?.country?.name || "",
          address: event._embedded?.venues?.[0]?.address?.line1,
          capacity: event._embedded?.venues?.[0]?.capacity,
          lat: parseFloat(event._embedded?.venues?.[0]?.location?.latitude) || undefined,
          lng: parseFloat(event._embedded?.venues?.[0]?.location?.longitude) || undefined,
        });

        // Create show
        await ctx.runMutation(internal.shows.createFromTicketmaster, {
          artistId: args.artistId,
          venueId,
          ticketmasterId: event.id,
          date: event.dates?.start?.localDate || new Date().toISOString().split('T')[0],
          startTime: event.dates?.start?.localTime,
          status: event.dates?.status?.code === "onsale" ? "upcoming" : "upcoming",
          ticketUrl: event.url,
        });
        
        // gentle backoff to respect API
        await new Promise(r => setTimeout(r, 75));
      }

      console.log(`✅ Synced ${events.length} shows for artist`);
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
    if (!apiKey) return [];

    const limit = args.limit || 50;
    // Prioritize stadium and arena shows with higher capacity venues
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&size=${limit}&sort=relevance,desc&segmentName=Music&genreId=KnvZfZ7vAeA&subGenreId=KZazBEonSMnZiA&apikey=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) return [];

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
    if (!apiKey) return [];

    const limit = args.limit || 30;
    // Prioritize top-tier artists with the most upcoming events and stadium shows
    const url = `https://app.ticketmaster.com/discovery/v2/attractions.json?classificationName=music&size=${limit}&sort=upcoming,desc&segmentName=Music&genreId=KnvZfZ7vAeA&apikey=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) return [];

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
        upcomingEvents: Number(attraction.upcomingEvents?._total || 0),
        url: attraction.url ? String(attraction.url) : undefined,
      }));
    } catch (error) {
      console.error("Failed to get trending artists:", error);
      return [];
    }
  },
});