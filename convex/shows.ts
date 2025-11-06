import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Helper function to create SEO-friendly slugs
function createSEOSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Handle special characters and accents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    // Replace spaces and special characters with hyphens
    .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '')    // Remove leading/trailing hyphens
    .substring(0, 100);       // Limit length for SEO
}

// Helper function to create descriptive show slugs
function createShowSlug(artistName: string, venueName: string, venueCity: string, date: string): string {
  // Format: artist-name-venue-name-city-yyyy-mm-dd (no time segment)
  const datePart = date; // Already in YYYY-MM-DD format
  return `${createSEOSlug(artistName)}-${createSEOSlug(venueName)}-${createSEOSlug(venueCity)}-${datePart}`;
}

export const getRecentlyUpdated = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const shows = await ctx.db
      .query("shows")
      .order("desc") // Order by creation time descending for most recent
      .take(limit);
    
      // Populate artist and venue data
  const enrichedShows = await Promise.all(
    shows.map(async (show) => {
      const [artist, venue] = await Promise.all([
        ctx.db.get(show.artistId),
        ctx.db.get(show.venueId),
      ]);
      // Skip shows with missing artist or venue
      if (!artist || !venue) {
        return null;
      }
      return { ...show, artist, venue };
    })
  );
  
  // Filter out null values
  return enrichedShows.filter(show => show !== null);
  },
});

export const getUpcoming = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 15;
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "upcoming"))
      .order("asc")
      .take(limit);
    
      // Populate artist and venue data
  const enrichedShows = await Promise.all(
    shows.map(async (show) => {
      const [artist, venue] = await Promise.all([
        ctx.db.get(show.artistId),
        ctx.db.get(show.venueId),
      ]);
      // Skip shows with missing artist or venue
      if (!artist || !venue) {
        return null;
      }
      return { ...show, artist, venue };
    })
  );
  
  // Filter out null values
  return enrichedShows.filter(show => show !== null);
  },
});

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .order("desc")
      .take(limit);
    
      // Populate artist and venue data
  const enrichedShows = await Promise.all(
    shows.map(async (show) => {
      const [artist, venue] = await Promise.all([
        ctx.db.get(show.artistId),
        ctx.db.get(show.venueId),
      ]);
      // Skip shows with missing artist or venue
      if (!artist || !venue) {
        return null;
      }
      return { ...show, artist, venue };
    })
  );
  
  // Filter out null values
  return enrichedShows.filter(show => show !== null);
  },
});

export const getById = query({
  args: { id: v.id("shows") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.id);
    if (!show) return null;
    
    const [artist, venue] = await Promise.all([
      ctx.db.get(show.artistId),
      ctx.db.get(show.venueId),
    ]);
    
    // Return null if artist or venue is missing
    if (!artist || !venue) {
      return null;
    }
    
    return { ...show, artist, venue };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const show = await ctx.db
      .query("shows")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    
    if (!show || !show.slug) return null;
    
    const [artist, venue] = await Promise.all([
      ctx.db.get(show.artistId),
      ctx.db.get(show.venueId),
    ]);
    
    return { ...show, artist, venue };
  },
});

// Accepts either a SEO slug or a document id string and returns enriched show
export const getBySlugOrId = query({
  args: { key: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    // Try by slug first
    const bySlug = await ctx.db
      .query("shows")
      .withIndex("by_slug", (q) => q.eq("slug", args.key))
      .first(); // Use .first() instead of .unique() to handle duplicates gracefully

    let showDoc = bySlug;
    if (!showDoc) {
      // Fallback: if slug contains trailing time segment (-HH-mm), try without it
      const timeSuffix = args.key.match(/^(.*)-(\d{2})-(\d{2})$/);
      if (timeSuffix && timeSuffix[1]) {
        const withoutTime = timeSuffix[1];
        const bySlugNoTime = await ctx.db
          .query("shows")
          .withIndex("by_slug", (q) => q.eq("slug", withoutTime))
          .first();
        if (bySlugNoTime) {
          showDoc = bySlugNoTime;
        }
      }
    }
    if (!showDoc) {
      // Fallback: try by id
      try {
        // Validate that the key is a valid show ID format
        const showId = args.key as Id<"shows">;
        const show = await ctx.db.get(showId);
        // Verify it's actually a show by checking for required fields
        if (show && 'artistId' in show && 'venueId' in show && 'date' in show) {
          showDoc = show;
        }
      } catch {
        // ignore invalid id format
      }
    }

    if (!showDoc) return null;

    const [artist, venue] = await Promise.all([
      ctx.db.get(showDoc.artistId),
      ctx.db.get(showDoc.venueId),
    ]);
    
    // Return null if artist or venue is missing
    if (!artist || !venue) {
      return null;
    }
    
    return { ...showDoc, artist, venue };
  },
});

export const getByArtist = query({
  args: { 
    artistId: v.id("artists"),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .order("desc")
      .take(limit);
    
    // Populate venue data
    const enrichedShows = await Promise.all(
      shows.map(async (show) => {
        const venue = await ctx.db.get(show.venueId);
        return { ...show, venue };
      })
    );
    
    return enrichedShows;
  },
});

// Get all shows with pagination and filtering
export const getAll = query({
  args: { 
    limit: v.optional(v.number()),
    status: v.optional(v.union(v.literal("upcoming"), v.literal("completed"), v.literal("cancelled")))
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    let shows;
    if (args.status) {
      shows = await ctx.db
        .query("shows")
        .withIndex("by_status", (q) => q.eq("status", args.status as "upcoming" | "completed" | "cancelled"))
        .order("desc")
        .take(limit);
    } else {
      shows = await ctx.db
        .query("shows")
        .order("desc")
        .take(limit);
    }
    
    // Populate artist and venue data
    const enrichedShows = await Promise.all(
      shows.map(async (show) => {
        const [artist, venue] = await Promise.all([
          ctx.db.get(show.artistId),
          ctx.db.get(show.venueId),
        ]);
        // Skip shows with missing artist or venue
        if (!artist || !venue) {
          return null;
        }
        return { ...show, artist, venue };
      })
    );
    
    // Filter out null values
    return enrichedShows.filter(show => show !== null);
  },
});

// Search shows across all fields
export const searchShows = query({
  args: { 
    query: v.string(),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const searchTerm = args.query.toLowerCase();
    
    // Get all shows (we'll filter in memory for simplicity)
    const shows = await ctx.db
      .query("shows")
      .take(100);
    
    const enrichedShows = await Promise.all(
      shows.map(async (show) => {
        const [artist, venue] = await Promise.all([
          ctx.db.get(show.artistId),
          ctx.db.get(show.venueId),
        ]);
        return { ...show, artist, venue };
      })
    );
    
    // Filter by artist name, venue name, or city
    return enrichedShows
      .filter(show => 
        show.artist?.name.toLowerCase().includes(searchTerm) ||
        show.venue?.name.toLowerCase().includes(searchTerm) ||
        show.venue?.city.toLowerCase().includes(searchTerm)
      )
      .slice(0, limit);
  },
});

// Get shows by city
export const getByCity = query({
  args: { 
    city: v.string(),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    // Get venues in the city first
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_location", (q) => q.eq("city", args.city))
      .collect();
    
    const venueIds = venues.map(v => v._id);
    const shows = [];
    
    // Get shows for each venue in the city
    for (const venueId of venueIds) {
      const venueShows = await ctx.db
        .query("shows")
        .withIndex("by_venue", (q) => q.eq("venueId", venueId))
        .take(limit);
      shows.push(...venueShows);
    }
    
    // Sort by date and limit
    const sortedShows = shows
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
    
    // Populate artist and venue data
    const enrichedShows = await Promise.all(
      sortedShows.map(async (show) => {
        const [artist, venue] = await Promise.all([
          ctx.db.get(show.artistId),
          ctx.db.get(show.venueId),
        ]);
        return { ...show, artist, venue };
      })
    );
    
    return enrichedShows;
  },
});

// Get shows by venue
export const getByVenue = query({
  args: { 
    venueId: v.id("venues"),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_venue", (q) => q.eq("venueId", args.venueId))
      .order("desc")
      .take(limit);
    
    // Populate artist data
    const enrichedShows = await Promise.all(
      shows.map(async (show) => {
        const artist = await ctx.db.get(show.artistId);
        return { ...show, artist };
      })
    );
    
    return enrichedShows;
  },
});

// Internal: list all shows for an artist (no limit)
export const getAllByArtistInternal = internalQuery({
  args: { artistId: v.id("artists") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shows")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .collect();
  },
});

// Internal functions
export const getUpcomingShows = internalQuery({
  args: {},
  handler: async (ctx) => {
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "upcoming"))
      .collect();

    // Populate artist and venue data
    return await Promise.all(
      shows.map(async (show) => {
        const [artist, venue] = await Promise.all([
          ctx.db.get(show.artistId),
          ctx.db.get(show.venueId),
        ]);
        return { ...show, artist, venue };
      })
    );
  },
});



export const getByArtistAndDateInternal = internalQuery({
  args: {
    artistId: v.id("artists"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shows")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .filter((q) => q.eq(q.field("date"), args.date))
      .first();
  },
});

// Back-compat alias for callers expecting `getByArtistAndDate`
export const getByArtistAndDate = getByArtistAndDateInternal;

// Count upcoming shows for an artist
export const countUpcomingByArtist = internalQuery({
  args: { artistId: v.id("artists") },
  handler: async (ctx, args) => {
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .filter((q) => q.eq(q.field("status"), "upcoming"))
      .collect();
    return shows.length;
  },
});

export const createInternal = internalMutation({
  args: {
    artistId: v.id("artists"),
    venueId: v.id("venues"),
    date: v.string(),
    startTime: v.optional(v.string()),
    status: v.union(v.literal("upcoming"), v.literal("completed"), v.literal("cancelled")),
    ticketmasterId: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get artist and venue data to generate slug
    const [artist, venue] = await Promise.all([
      ctx.db.get(args.artistId),
      ctx.db.get(args.venueId),
    ]);
    
    if (!artist || !venue) {
      throw new Error("Artist or venue not found");
    }
    
    // Generate SEO-friendly slug: artist-name-venue-name-city-date
    const slug = createShowSlug(artist.name, venue.name, venue.city, args.date);
    
    // ENHANCED: Initialize all optional fields with proper defaults
    const showId = await ctx.db.insert("shows", {
      ...args,
      slug,
      voteCount: 0, // Initialize counts
      setlistCount: 0,
      trendingScore: 0, // Initialize trending score
      trendingRank: 0, // FIXED: Initialize to 0 (not undefined) for queries to work
      lastTrendingUpdate: Date.now(), // Initialize trending timestamp
      priceRange: undefined, // Set if available
      setlistfmId: undefined, // Set when setlist imported
      lastSynced: Date.now(), // CRITICAL: Set sync timestamp
      importStatus: args.status === "completed" ? "pending" : undefined,
    });
    
    console.log(`✅ Created internal show ${showId} with slug: ${slug}`);
    
    // ENHANCED: Auto-generate initial setlist with intelligent retry logic
    try {
      const setlistId = await ctx.runMutation(internal.setlists.autoGenerateSetlist, {
        showId,
        artistId: args.artistId,
      });
      
      if (!setlistId) {
        // Songs not imported yet - schedule multiple retries at increasing intervals
        console.log(`⏳ Scheduling setlist generation retries for show ${showId}`);
        
        // Retry after 30 seconds (catalog might finish by then)
        void ctx.scheduler.runAfter(30_000, internal.setlists.autoGenerateSetlist, {
          showId,
          artistId: args.artistId,
        });
        
        // Retry after 2 minutes (backup)
        void ctx.scheduler.runAfter(120_000, internal.setlists.autoGenerateSetlist, {
          showId,
          artistId: args.artistId,
        });
        
        // Retry after 5 minutes (final attempt)
        void ctx.scheduler.runAfter(300_000, internal.setlists.autoGenerateSetlist, {
          showId,
          artistId: args.artistId,
        });
      } else {
        console.log(`✅ Initial setlist ${setlistId} created for show ${showId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to auto-generate setlist for show ${showId}:`, error);
      
      // Schedule retries even on error
      void ctx.scheduler.runAfter(30_000, internal.setlists.autoGenerateSetlist, {
        showId,
        artistId: args.artistId,
      });
      
      void ctx.scheduler.runAfter(120_000, internal.setlists.autoGenerateSetlist, {
        showId,
        artistId: args.artistId,
      });
    }
    return showId;
  },
});

export const createFromTicketmaster = internalMutation({
  args: {
    artistId: v.id("artists"),
    venueId: v.id("venues"),
    ticketmasterId: v.string(),
    date: v.string(),
    startTime: v.optional(v.string()),
    status: v.union(v.literal("upcoming"), v.literal("completed"), v.literal("cancelled")),
    ticketUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for existing show by multiple criteria to avoid duplicates
    let existing = await ctx.db
      .query("shows")
      .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", args.ticketmasterId))
      .first();

    if (!existing) {
      existing = await ctx.db
        .query("shows")
        .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
        .filter((q) => q.eq(q.field("date"), args.date))
        .filter((q) => q.eq(q.field("venueId"), args.venueId))
        .first();
    }

    if (existing) {
      // Update existing show with new data if needed
      if (args.ticketmasterId && !existing.ticketmasterId) {
        await ctx.db.patch(existing._id, {
          ticketmasterId: args.ticketmasterId,
          ticketUrl: args.ticketUrl,
          lastSynced: Date.now(),
        });
      }
      return existing._id;
    }

    // Get artist and venue data to generate slug
    const [artist, venue] = await Promise.all([
      ctx.db.get(args.artistId),
      ctx.db.get(args.venueId),
    ]);
    
    if (!artist || !venue) {
      throw new Error("Artist or venue not found");
    }
    
    // Generate SEO-friendly slug: artist-name-venue-name-city-date
    const slug = createShowSlug(artist.name, venue.name, venue.city, args.date);
    
    // ENHANCED: Initialize all optional fields with proper defaults
    const showId = await ctx.db.insert("shows", {
      artistId: args.artistId,
      venueId: args.venueId,
      date: args.date,
      startTime: args.startTime,
      status: args.status,
      ticketmasterId: args.ticketmasterId,
      ticketUrl: args.ticketUrl,
      slug,
      lastSynced: Date.now(), // CRITICAL: Set sync timestamp
      voteCount: 0, // Initialize vote count
      setlistCount: 0, // Initialize setlist count
      trendingScore: 0, // Initialize trending score
      trendingRank: 0, // FIXED: Initialize to 0 (was causing empty queries)
      lastTrendingUpdate: Date.now(), // Initialize trending timestamp
      priceRange: undefined, // Will be set if available from Ticketmaster
      setlistfmId: undefined, // Will be set when setlist imported
      importStatus: args.status === "completed" ? "pending" : undefined, // Auto-queue completed shows for import
    });
    
    console.log(`✅ Created show ${showId} with slug: ${slug}`);

    // ENHANCED: Auto-generate initial setlist with intelligent retry logic
    try {
      const setlistId = await ctx.runMutation(internal.setlists.autoGenerateSetlist, {
        showId,
        artistId: args.artistId,
      });
      
      if (!setlistId) {
        // Songs not imported yet - schedule multiple retries at increasing intervals
        console.log(`⏳ Scheduling setlist generation retries for show ${showId}`);
        
        // Retry after 30 seconds (catalog might finish by then)
        void ctx.scheduler.runAfter(30_000, internal.setlists.autoGenerateSetlist, {
          showId,
          artistId: args.artistId,
        });
        
        // Retry after 2 minutes (backup)
        void ctx.scheduler.runAfter(120_000, internal.setlists.autoGenerateSetlist, {
          showId,
          artistId: args.artistId,
        });
        
        // Retry after 5 minutes (final attempt)
        void ctx.scheduler.runAfter(300_000, internal.setlists.autoGenerateSetlist, {
          showId,
          artistId: args.artistId,
        });
      } else {
        console.log(`✅ Initial setlist ${setlistId} created for show ${showId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to auto-generate setlist for show ${showId}:`, error);
      
      // Schedule retries even on error
      void ctx.scheduler.runAfter(30_000, internal.setlists.autoGenerateSetlist, {
        showId,
        artistId: args.artistId,
      });
      
      void ctx.scheduler.runAfter(120_000, internal.setlists.autoGenerateSetlist, {
        showId,
        artistId: args.artistId,
      });
    }

    return showId;
  },
});

// Cleanup function to remove shows with invalid artist/venue references
export const cleanupOrphanedShows = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const shows = await ctx.db.query("shows").take(100); // Limit to avoid timeout
    let deletedCount = 0;
    
    for (const show of shows) {
      try {
        // Check if artist and venue still exist
        const [artist, venue] = await Promise.all([
          ctx.db.get(show.artistId),
          ctx.db.get(show.venueId),
        ]);
        
        // Delete show if artist or venue doesn't exist
        if (!artist || !venue) {
          await ctx.db.delete(show._id);
          deletedCount++;
          console.log(`🗑️ Deleted orphaned show: ${show.slug || show._id}`);
        }
      } catch (error) {
        console.log(`⚠️ Error checking show ${show._id}:`, error);
      }
    }
    
    console.log(`🧹 Cleaned up ${deletedCount} orphaned shows`);
    return null;
  },
});

export const cleanupOldShows = internalMutation({
  args: {
    cutoffDate: v.string(),
  },
  handler: async (ctx, args) => {
    // Get shows older than the cutoff date
    const oldShows = await ctx.db
      .query("shows")
      .filter((q) => q.lt(q.field("date"), args.cutoffDate))
      .collect();
    
    for (const show of oldShows) {
      // Delete associated setlists first
      const setlists = await ctx.db
        .query("setlists")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      for (const setlist of setlists) {
        await ctx.db.delete(setlist._id);
      }
      
      // Delete the show
      await ctx.db.delete(show._id);
    }
    
    console.log(`Cleaned up ${oldShows.length} old shows`);
  },
});

export const getByIdInternal = internalQuery({
  args: { id: v.id("shows") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByVenueInternal = internalQuery({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shows")
      .withIndex("by_venue", (q) => q.eq("venueId", args.venueId))
      .collect();
  },
});

// Get all shows for internal maintenance
export const getAllInternal = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const shows = await ctx.db.query("shows").take(100);
    
    // Enrich with artist and venue data
    const enrichedShows = await Promise.all(
      shows.map(async (show) => {
        const artist = show.artistId ? await ctx.db.get(show.artistId) : null;
        const venue = show.venueId ? await ctx.db.get(show.venueId) : null;
        
        return {
          ...show,
          artist,
          venue
        };
      })
    );
    
    return enrichedShows;
  },
});

// Internal mutation to update importStatus
export const updateImportStatus = internalMutation({
  args: {
    showId: v.id("shows"),
    status: v.union(v.literal("pending"), v.literal("importing"), v.literal("completed"), v.literal("failed")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.showId, { 
      importStatus: args.status,
      lastSynced: Date.now(), // Update sync timestamp
    });
    return null;
  },
});

// NEW: Update show priceRange
export const updatePriceRange = internalMutation({
  args: {
    showId: v.id("shows"),
    priceRange: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.showId, { 
      priceRange: args.priceRange,
      lastSynced: Date.now(),
    });
    return null;
  },
});

// Internal query to get artist by ID
export const getArtistByIdInternal = internalQuery({
  args: { id: v.id("artists") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Internal query to get venue by ID
export const getVenueByIdInternal = internalQuery({
  args: { id: v.id("venues") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const markCompleted = internalMutation({
  args: { showId: v.id("shows") },
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.showId);
    if (!show) {
      throw new Error("Show not found");
    }

    // Date validation: ensure date is valid ISO and in the past or today
    const showDate = new Date(show.date);
    if (isNaN(showDate.getTime())) {
      throw new Error(`Invalid date format for show ${args.showId}: ${show.date}`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    const showDay = new Date(showDate);
    showDay.setHours(0, 0, 0, 0);

    if (showDay > today) {
      console.warn(`⚠️ Attempt to mark future show as completed: ${show.date} for ${args.showId}`);
      // Optionally throw error or just log; for now, allow but warn
    }

    // If status is already completed, no-op
    if (show.status === "completed") {
      console.log(`ℹ️ Show ${args.showId} already completed`);
      return;
    }

    await ctx.db.patch(args.showId, {
      status: "completed",
      lastSynced: Date.now(),
    });
    
    console.log(`✅ Marked show as completed: ${args.showId} (date: ${show.date})`);
  },
});

// Auto-transition statuses for all shows based on current date
export const autoTransitionStatuses = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔄 Auto-transitioning show statuses based on date...");
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get upcoming shows that might need transitioning
    const upcomingShows = await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "upcoming"))
      .collect();

    let transitioned = 0;
    let errors = 0;

    for (const show of upcomingShows) {
      try {
        const showDate = new Date(show.date);
        if (isNaN(showDate.getTime())) {
          console.error(`Invalid date for show ${show._id}: ${show.date}`);
          errors++;
          continue;
        }

        const showDay = new Date(showDate);
        showDay.setHours(0, 0, 0, 0);

        if (showDay < today) {
          // Transition to completed (or cancelled if needed, but assume completed)
          await ctx.db.patch(show._id, {
            status: "completed",
            lastSynced: Date.now(),
          });
          transitioned++;
          console.log(`✅ Auto-completed show ${show._id} (past date: ${show.date})`);
        }
      } catch (error) {
        console.error(`Failed to transition show ${show._id}:`, error);
        errors++;
      }
    }

    console.log(`Auto-transition complete: ${transitioned} shows transitioned, ${errors} errors`);
    return null;
  },
});

export const getUpcomingCountByArtist = internalQuery({
  args: { artistId: v.id("artists") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_status_artist", (q) => q.eq("status", "upcoming").eq("artistId", args.artistId))
      .collect();

    return shows.length;
  },
});
