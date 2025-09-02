import { query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Adapter functions to bridge PublicDashboard to trending_v2
// These wrap the new trending_v2 queries to maintain compatibility

export const getTrendingArtists = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Get trending artists from the new trending_v2 system
    const artists = await ctx.runQuery(api.trending_v2.getTrendingArtists, { 
      limit: args.limit || 20 
    });
    
    // Transform to expected format if needed
    return artists.map((artist: any) => ({
      ticketmasterId: artist.ticketmasterId || artist._id,
      name: artist.name,
      genres: artist.genres || [],
      images: artist.images || [],
      upcomingEvents: artist.upcomingShowsCount || 0,
      url: artist.url,
      followers: artist.followers,
      popularity: artist.popularity,
      trendingScore: artist.trendingScore,
      trendingRank: artist.trendingRank
    }));
  },
});

export const getTrendingShows = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Get trending shows from the new trending_v2 system
    const shows = await ctx.runQuery(api.trending_v2.getTrendingShows, { 
      limit: args.limit || 20 
    });
    
    // Transform to expected format with enriched data
    return shows.map((show: any) => ({
      ticketmasterId: show.ticketmasterId || show._id,
      artistTicketmasterId: show.artist?.ticketmasterId,
      artistName: show.artist?.name || 'Unknown Artist',
      artist: show.artist, // Full artist data already included
      venueName: show.venue?.name || 'Unknown Venue',
      venueCity: show.venue?.city || '',
      venueCountry: show.venue?.country || '',
      date: show.date,
      startTime: show.startTime,
      artistImage: show.artist?.images?.[0],
      ticketUrl: show.ticketUrl,
      status: show.status,
      trendingScore: show.trendingScore,
      trendingRank: show.trendingRank
    }));
  },
});

// Legacy functions for compatibility
export const saveTrendingShows = query({
  args: {},
  handler: async () => {
    // No-op: trending data is now stored directly in shows table
    return null;
  },
});

export const saveTrendingArtists = query({
  args: {},
  handler: async () => {
    // No-op: trending data is now stored directly in artists table
    return null;
  },
});