"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Ticketmaster API integration for artist search and full sync
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

export const startFullArtistSync = internalAction({
  args: {
    ticketmasterId: v.string(),
    artistName: v.string(),
    genres: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args): Promise<Id<"artists">> => {
    console.log(`Starting full sync for artist: ${args.artistName}`);

    // Phase 1: Create basic artist record
    const artistId: Id<"artists"> = await ctx.runMutation(internal.artists.createFromTicketmaster, {
      ticketmasterId: args.ticketmasterId,
      name: args.artistName,
      genres: args.genres || [],
      images: args.images || [],
    });

    // Phase 2: Sync shows and venues (blocking to populate UI quickly)
    await ctx.runAction(internal.ticketmaster.syncArtistShows, {
      artistId,
      ticketmasterId: args.ticketmasterId,
    });

    // Phase 3: Sync Spotify catalog (background)
    void ctx.runAction(internal.spotify.syncArtistCatalog, {
      artistId,
      artistName: args.artistName,
    });

    return artistId;
  },
});

export const syncArtistShows = internalAction({
  args: {
    artistId: v.id("artists"),
    ticketmasterId: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) return;

    const url = `https://app.ticketmaster.com/discovery/v2/events.json?attractionId=${args.ticketmasterId}&size=200&apikey=${apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) return;

      const data = await response.json();
      const events = data._embedded?.events || [];

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
    } catch (error) {
      console.error("Failed to sync artist shows:", error);
    }
  },
});

// Public action to trigger full artist sync
export const triggerFullArtistSync = action({
  args: {
    ticketmasterId: v.string(),
    artistName: v.string(),
    genres: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args): Promise<Id<"artists">> => {
    return await ctx.runAction(internal.ticketmaster.startFullArtistSync, {
      ticketmasterId: args.ticketmasterId,
      artistName: args.artistName,
      genres: args.genres,
      images: args.images
    });
  },
});
