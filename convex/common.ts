// Common validation and helper functions
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Post-insert validation for artists to ensure all fields are properly populated
export const validateArtistFields = internalMutation({
  args: { artistId: v.id("artists") },
  returns: v.object({ validated: v.boolean(), updatedFields: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const artist = await ctx.db.get(args.artistId);
    if (!artist) return { validated: false, updatedFields: [] };
    
    const updates: any = {};
    const updatedFields: string[] = [];
    
    // Ensure all numeric fields are initialized (not undefined or NaN)
    if (artist.popularity === undefined || !Number.isFinite(artist.popularity)) {
      updates.popularity = 0;
      updatedFields.push('popularity');
    }
    
    if (artist.followers === undefined || !Number.isFinite(artist.followers)) {
      updates.followers = 0;
      updatedFields.push('followers');
    }
    
    if (artist.trendingScore === undefined || !Number.isFinite(artist.trendingScore)) {
      updates.trendingScore = 0;
      updatedFields.push('trendingScore');
    }
    
    if (artist.upcomingShowsCount === undefined || !Number.isFinite(artist.upcomingShowsCount)) {
      updates.upcomingShowsCount = 0;
      updatedFields.push('upcomingShowsCount');
    }
    
    // Ensure array fields are initialized
    if (!artist.genres || !Array.isArray(artist.genres)) {
      updates.genres = [];
      updatedFields.push('genres');
    }
    
    if (!artist.images || !Array.isArray(artist.images)) {
      updates.images = [];
      updatedFields.push('images');
    }
    
    // Ensure timestamps exist
    if (!artist.lastSynced) {
      updates.lastSynced = Date.now();
      updatedFields.push('lastSynced');
    }
    
    if (!artist.lastTrendingUpdate) {
      updates.lastTrendingUpdate = Date.now();
      updatedFields.push('lastTrendingUpdate');
    }
    
    // Apply updates if needed
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.artistId, updates);
      console.log(`✅ Validated artist ${args.artistId}: updated ${updatedFields.join(', ')}`);
    }
    
    return { validated: true, updatedFields };
  },
});

// Post-insert validation for shows
export const validateShowFields = internalMutation({
  args: { showId: v.id("shows") },
  returns: v.object({ validated: v.boolean(), updatedFields: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.showId);
    if (!show) return { validated: false, updatedFields: [] };
    
    const updates: any = {};
    const updatedFields: string[] = [];
    
    // Ensure counts are initialized
    if (show.voteCount === undefined || !Number.isFinite(show.voteCount)) {
      updates.voteCount = 0;
      updatedFields.push('voteCount');
    }
    
    if (show.setlistCount === undefined || !Number.isFinite(show.setlistCount)) {
      updates.setlistCount = 0;
      updatedFields.push('setlistCount');
    }
    
    if (show.trendingScore === undefined || !Number.isFinite(show.trendingScore)) {
      updates.trendingScore = 0;
      updatedFields.push('trendingScore');
    }
    
    // Ensure timestamps exist
    if (!show.lastSynced) {
      updates.lastSynced = Date.now();
      updatedFields.push('lastSynced');
    }
    
    if (!show.lastTrendingUpdate) {
      updates.lastTrendingUpdate = Date.now();
      updatedFields.push('lastTrendingUpdate');
    }
    
    // Ensure status-dependent fields
    if (show.status === "completed" && !show.importStatus) {
      updates.importStatus = "pending";
      updatedFields.push('importStatus');
    }
    
    // Apply updates if needed
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.showId, updates);
      console.log(`✅ Validated show ${args.showId}: updated ${updatedFields.join(', ')}`);
    }
    
    return { validated: true, updatedFields };
  },
});

// Batch validate all records (for maintenance cron)
export const validateAllRecords = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ 
    artistsValidated: v.number(), 
    showsValidated: v.number(),
    totalUpdates: v.number() 
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    let totalUpdates = 0;
    
    // Validate artists
    const artists = await ctx.db.query("artists").take(limit);
    for (const artist of artists) {
      const updates: any = {};
      
      if (artist.popularity === undefined || !Number.isFinite(artist.popularity)) {
        updates.popularity = 0;
        totalUpdates++;
      }
      if (artist.followers === undefined || !Number.isFinite(artist.followers)) {
        updates.followers = 0;
        totalUpdates++;
      }
      
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(artist._id, updates);
      }
    }
    
    // Validate shows
    const shows = await ctx.db.query("shows").take(limit);
    for (const show of shows) {
      const updates: any = {};
      
      if (show.voteCount === undefined || !Number.isFinite(show.voteCount)) {
        updates.voteCount = 0;
        totalUpdates++;
      }
      if (show.setlistCount === undefined || !Number.isFinite(show.setlistCount)) {
        updates.setlistCount = 0;
        totalUpdates++;
      }
      
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(show._id, updates);
      }
    }
    
    return { 
      artistsValidated: artists.length, 
      showsValidated: shows.length,
      totalUpdates 
    };
  },
});
