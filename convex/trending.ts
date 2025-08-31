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
      .take(limit * 2); // Get more to filter and sort
    
    // Sort by popularity and upcoming events (stadium artists first)
    const sortedArtists = artists
      .sort((a, b) => {
        // Prioritize artists with more upcoming events
        const aEvents = a.upcomingEvents || 0;
        const bEvents = b.upcomingEvents || 0;
        if (aEvents !== bEvents) return bEvents - aEvents;
        
        // Then by artist name recognition (major artists)
        const majorArtists = [
          'taylor swift', 'beyonce', 'drake', 'ed sheeran', 'coldplay', 'imagine dragons',
          'billie eilish', 'the weeknd', 'bruno mars', 'ariana grande', 'post malone',
          'dua lipa', 'bad bunny', 'harry styles', 'olivia rodrigo', 'travis scott',
          'kanye west', 'eminem', 'rihanna', 'justin bieber', 'lady gaga', 'adele'
        ];
        const aIsMajor = majorArtists.some(major => a.name.toLowerCase().includes(major)) ? 1 : 0;
        const bIsMajor = majorArtists.some(major => b.name.toLowerCase().includes(major)) ? 1 : 0;
        if (aIsMajor !== bIsMajor) return bIsMajor - aIsMajor;
        
        // Finally by creation time (most recent)
        return b.lastUpdated - a.lastUpdated;
      })
      .slice(0, limit);

    return sortedArtists;
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
      .take(limit * 2); // Get more to filter and sort
    
    // Sort by venue capacity (stadium shows first) and artist popularity
    const sortedShows = shows
      .sort((a, b) => {
        // Prioritize shows with price ranges (indicates demand)
        const aHasPrice = a.priceRange ? 1 : 0;
        const bHasPrice = b.priceRange ? 1 : 0;
        if (aHasPrice !== bHasPrice) return bHasPrice - aHasPrice;
        
        // Then by venue name (stadiums/arenas typically have these keywords)
        const aIsStadium = /stadium|arena|center|amphitheatre|pavilion/i.test(a.venueName) ? 1 : 0;
        const bIsStadium = /stadium|arena|center|amphitheatre|pavilion/i.test(b.venueName) ? 1 : 0;
        if (aIsStadium !== bIsStadium) return bIsStadium - aIsStadium;
        
        // Finally by creation time (most recent)
        return b.lastUpdated - a.lastUpdated;
      })
      .slice(0, limit);

    return sortedShows;
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