import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Query cached trending artists from database (populated by cron)
export const getTrendingArtists = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    const artists = await ctx.db
      .query("trendingArtists")
      .order("desc")
      .take(limit);

    return artists;
  },
});

// Query cached trending shows from database (populated by cron)
export const getTrendingShows = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    const shows = await ctx.db
      .query("trendingShows")
      .order("desc")
      .take(limit);

    return shows;
  },
});

// Internal function to save trending shows to database (called by cron)
export const saveTrendingShows = internalMutation({
  args: { shows: v.array(v.any()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Clear existing trending shows
    const existing = await ctx.db.query("trendingShows").collect();
    for (const show of existing) {
      await ctx.db.delete(show._id);
    }
    
    // Insert new trending shows
    for (const show of args.shows) {
      await ctx.db.insert("trendingShows", {
        ticketmasterId: show.ticketmasterId,
        artistTicketmasterId: show.artistTicketmasterId,
        artistName: show.artistName,
        venueName: show.venueName,
        venueCity: show.venueCity,
        venueCountry: show.venueCountry,
        date: show.date,
        startTime: show.startTime,
        artistImage: show.artistImage,
        ticketUrl: show.ticketUrl,
        priceRange: show.priceRange,
        status: show.status,
        lastUpdated: Date.now(),
      });
    }
    
    return null;
  },
});

// Internal function to save trending artists to database (called by cron)
export const saveTrendingArtists = internalMutation({
  args: { artists: v.array(v.any()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Clear existing trending artists
    const existing = await ctx.db.query("trendingArtists").collect();
    for (const artist of existing) {
      await ctx.db.delete(artist._id);
    }
    
    // Insert new trending artists
    for (const artist of args.artists) {
      await ctx.db.insert("trendingArtists", {
        ticketmasterId: artist.ticketmasterId,
        name: artist.name,
        genres: artist.genres,
        images: artist.images,
        upcomingEvents: artist.upcomingEvents,
        url: artist.url,
        lastUpdated: Date.now(),
      });
    }
    
    return null;
  },
});