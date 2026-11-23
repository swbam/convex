import { dateOnlySlug, resolveShowKey, showWithTickets } from "./lib/showTickets";
import { ticketInfoValidator } from "./lib/ticketInfo";
import { importRetryExpiry } from "./lib/importRetry";
import { query, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internalRef } from "./adminHelpers";
import { hasShowEnded } from "./lib/showTiming";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any


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
function createShowSlug(artistName: string, venueName: string, venueCity: string, date: string, startTime?: string): string {
  // Format: artist-name-venue-name-city-yyyy-mm-dd (NO TIME IN URL)
  const datePart = date; // Already in YYYY-MM-DD format
  return `${createSEOSlug(artistName)}-${createSEOSlug(venueName)}-${createSEOSlug(venueCity)}-${datePart}`;
}

const parseDate = (dateString?: string) => new Date(dateString || "");

export const getRecentlyUpdated = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const shows = await ctx.db
      .query("shows")
      .order("desc") // initial order, will sort by date below
      .take(limit * 3);

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

    // Filter out null values and sort by show date (newest first)
    return enrichedShows
      .filter(show => show !== null)
      .sort((a: any, b: any) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
      .slice(0, limit);
  },
});

export const getUpcoming = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 15;
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_status_and_date", (q) => q.eq("status", "upcoming"))
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

    // The compound index already guarantees chronological order.
    return enrichedShows
      .filter(show => show !== null)
      .slice(0, limit);
  },
});

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_status_and_date", (q) => q.eq("status", "completed"))
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

    // The compound index already guarantees newest-completed first.
    return enrichedShows
      .filter(show => show !== null)
      .slice(0, limit);
  },
});

export const getById = query({
  args: { id: v.id("shows") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    const [show, artist, venue] = await Promise.all([
      showWithTickets(ctx, row), ctx.db.get(row.artistId), ctx.db.get(row.venueId),
    ]);
    return artist && venue ? { ...show, artist, venue } : null;
  },
});

async function showPageByKey(ctx: import("./_generated/server").QueryCtx, key: string) {
  const show = await resolveShowKey(ctx, key);
  if (!show) return null;
  const [artist, venue] = await Promise.all([ctx.db.get(show.artistId), ctx.db.get(show.venueId)]);
  return artist && venue ? { ...show, artist, venue } : null;
}

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: (ctx, args) => showPageByKey(ctx, args.slug),
});

// Internal mutation: normalize all show slugs to remove time suffixes
// Handles both "-hh-mm" (2 parts) and "-hh-mm-ss" (3 parts) formats
export const normalizeSlugsInternal = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ processed: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 500;
    const shows = await ctx.db.query("shows").take(limit);
    let processed = 0;
    let updated = 0;

    for (const show of shows) {
      processed += 1;
      if (!show.slug) continue;
      const newSlug = dateOnlySlug(show.slug);
      if (newSlug === show.slug) continue;
      const existing = await ctx.db.query("shows")
        .withIndex("by_slug", q => q.eq("slug", newSlug)).first();
      // Keep both public addresses when another performance already owns the date slug.
      if (!existing) {
        await ctx.db.patch(show._id, { slug: newSlug });
        updated++;
      }
    }

    return { processed, updated };
  },
});

// Maintenance CLI trigger
export const normalizeShowSlugs = internalAction({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ processed: v.number(), updated: v.number() }),
  handler: async (ctx, args): Promise<{ processed: number; updated: number }> => {
    const result = await ctx.runMutation(internalRef.shows.normalizeSlugsInternal, { limit: args.limit });
    return result as { processed: number; updated: number };
  },
});

// Accepts either a SEO slug or a document id string and returns enriched show
export const getBySlugOrId = query({
  args: { key: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: (ctx, args) => showPageByKey(ctx, args.key),
});

// Internal query to count shows for an artist
export const countByArtist = internalQuery({
  args: { artistId: v.id("artists") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .collect();
    return shows.length;
  },
});

export const getByArtist = query({
  args: {
    artistId: v.id("artists"),
    limit: v.optional(v.number())
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 10, 100));
    const [upcoming, completed, cancelled] = await Promise.all([
      ctx.db
        .query("shows")
        .withIndex("by_artist_status_and_date", (q) =>
          q.eq("artistId", args.artistId).eq("status", "upcoming"),
        )
        .order("asc")
        .take(limit),
      ctx.db
        .query("shows")
        .withIndex("by_artist_status_and_date", (q) =>
          q.eq("artistId", args.artistId).eq("status", "completed"),
        )
        .order("desc")
        .take(limit),
      ctx.db
        .query("shows")
        .withIndex("by_artist_status_and_date", (q) =>
          q.eq("artistId", args.artistId).eq("status", "cancelled"),
        )
        .order("desc")
        .take(Math.min(limit, 20)),
    ]);
    const shows = [...upcoming, ...completed, ...cancelled];

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
        .withIndex("by_status_and_date", (q) => q.eq("status", args.status as "upcoming" | "completed" | "cancelled"))
        .order(args.status === "upcoming" ? "asc" : "desc")
        .take(limit);
    } else {
      shows = await ctx.db
        .query("shows")
        .withIndex("by_date")
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
    const limit = Math.max(1, Math.min(args.limit ?? 50, 100));
    const [upcoming, completed, cancelled] = await Promise.all([
      ctx.db
        .query("shows")
        .withIndex("by_venue_status_and_date", (q) =>
          q.eq("venueId", args.venueId).eq("status", "upcoming"),
        )
        .order("asc")
        .take(limit),
      ctx.db
        .query("shows")
        .withIndex("by_venue_status_and_date", (q) =>
          q.eq("venueId", args.venueId).eq("status", "completed"),
        )
        .order("desc")
        .take(limit),
      ctx.db
        .query("shows")
        .withIndex("by_venue_status_and_date", (q) =>
          q.eq("venueId", args.venueId).eq("status", "cancelled"),
        )
        .order("desc")
        .take(Math.min(limit, 20)),
    ]);
    const shows = [...upcoming, ...completed, ...cancelled];

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
      .withIndex("by_artist_and_date", (q) => q.eq("artistId", args.artistId))
      .order("asc")
      .collect();
  },
});

// Internal functions
export const getUpcomingShows = internalQuery({
  args: {},
  handler: async (ctx) => {
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_status_and_date", (q) => q.eq("status", "upcoming"))
      .order("asc")
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
      .withIndex("by_artist_and_date", (q) =>
        q.eq("artistId", args.artistId).eq("date", args.date),
      )
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
      .withIndex("by_artist_status_and_date", (q) =>
        q.eq("artistId", args.artistId).eq("status", "upcoming"),
      )
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
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    timeZone: v.optional(v.string()),
    status: v.union(v.literal("upcoming"), v.literal("completed"), v.literal("cancelled")),
    ticketmasterId: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
    ticketInfo: ticketInfoValidator,
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
    const slug = createShowSlug(artist.name, venue.name, venue.city, args.date, args.startTime);

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
    // FIXED: Single attempt to generate setlist, let cron handle retries
    try {
      await ctx.scheduler.runAfter(0, internalRef.setlists.autoGenerateSetlist, {
        showId,
        artistId: args.artistId,
      });
    } catch (error) {
      console.warn(`⚠️ Initial setlist generation failed for show ${showId}, cron will retry:`, error);
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
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    timeZone: v.optional(v.string()),
    status: v.union(v.literal("upcoming"), v.literal("completed"), v.literal("cancelled")),
    ticketUrl: v.optional(v.string()),
    ticketInfo: ticketInfoValidator,
  },
  handler: async (ctx, args) => {
    // Preserve cancellations; never complete from a UTC date boundary.
    const status = args.status === "cancelled" ? "cancelled" :
      hasShowEnded(args) ? "completed" : "upcoming";
    // Check for existing show by multiple criteria to avoid duplicates
    let existing = await ctx.db
      .query("shows")
      .withIndex("by_ticketmaster_and_artist", (q) => q.eq("ticketmasterId", args.ticketmasterId).eq("artistId", args.artistId))
      .first();

    if (!existing) {
      const candidates = await ctx.db
        .query("shows")
        .withIndex("by_artist_and_date", (q) =>
          q.eq("artistId", args.artistId).eq("date", args.date),
        )
        .filter((q) => q.eq(q.field("venueId"), args.venueId))
        .collect();
      const matches = candidates.filter(show =>
        (!show.ticketmasterId || show.ticketmasterId === args.ticketmasterId) &&
        (!show.startTime || !args.startTime || show.startTime === args.startTime));
      existing = matches.length === 1 ? matches[0] : null;
    }

    if (existing) {
      const patch: Record<string, unknown> = {
        lastSynced: Date.now(),
      };
      if (args.ticketmasterId && args.ticketmasterId !== existing.ticketmasterId) patch.ticketmasterId = args.ticketmasterId;
      if (args.ticketInfo) patch.ticketInfo = args.ticketInfo;
      if (args.ticketUrl !== existing.ticketUrl) patch.ticketUrl = args.ticketUrl;
      if (status !== existing.status) patch.status = status;
      if (args.date !== existing.date) patch.date = args.date;
      if (args.startTime !== existing.startTime) patch.startTime = args.startTime;
      // Provider schedule changes invalidate timestamps even if the new time is TBA.
      if (args.startsAt !== existing.startsAt) patch.startsAt = args.startsAt;
      if (args.endsAt !== existing.endsAt) patch.endsAt = args.endsAt;
      if (args.timeZone !== existing.timeZone) patch.timeZone = args.timeZone;
      if (args.venueId !== existing.venueId) patch.venueId = args.venueId;
      if (Object.keys(patch).length > 1) {
        await ctx.db.patch(existing._id, patch);
      }

      // FIXED: Single attempt, let cron handle retries
      try {
        const existingSetlist = await ctx.db
          .query("setlists")
          .withIndex("by_show", (q) => q.eq("showId", existing._id))
          .first();

        const needsSeed = !existingSetlist || !Array.isArray(existingSetlist.songs) || (existingSetlist.songs?.length ?? 0) < 5;

        if (status === "upcoming" && needsSeed) {
          await ctx.scheduler.runAfter(0, internalRef.setlists.autoGenerateSetlist, {
            showId: existing._id,
            artistId: args.artistId,
          });
        }
      } catch (e) {
        console.warn(`⚠️ Setlist generation failed for existing show ${existing._id}, cron will retry:`, e);
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
    const slug = createShowSlug(artist.name, venue.name, venue.city, args.date, args.startTime);

    // ENHANCED: Initialize all optional fields with proper defaults
    const showId = await ctx.db.insert("shows", {
      artistId: args.artistId,
      venueId: args.venueId,
      date: args.date,
      startTime: args.startTime,
      status,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      timeZone: args.timeZone,
      ticketmasterId: args.ticketmasterId,
      ticketUrl: args.ticketUrl,
      ticketInfo: args.ticketInfo,
      slug,
      lastSynced: Date.now(), // CRITICAL: Set sync timestamp
      voteCount: 0, // Initialize vote count
      setlistCount: 0, // Initialize setlist count
      trendingScore: 0, // Initialize trending score
      trendingRank: 0, // FIXED: Initialize to 0 (was causing empty queries)
      lastTrendingUpdate: Date.now(), // Initialize trending timestamp
      priceRange: undefined, // Will be set if available from Ticketmaster
      setlistfmId: undefined, // Will be set when setlist imported
      importStatus: status === "completed" ? "pending" : undefined, // Auto-queue completed shows for import
    });

    console.log(`✅ Created show ${showId} with slug: ${slug}`);

    // FIXED: Single attempt to generate setlist, let cron handle retries
    try {
      await ctx.scheduler.runAfter(0, internalRef.setlists.autoGenerateSetlist, {
        showId,
        artistId: args.artistId,
      });
    } catch (error) {
      console.warn(`⚠️ Initial setlist generation failed for show ${showId}, cron will retry:`, error);
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

// Delete show by ID (for cleanup operations)
export const deleteShowInternal = internalMutation({
  args: { showId: v.id("shows") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Delete associated setlists first
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .collect();

    for (const setlist of setlists) {
      await ctx.db.delete(setlist._id);
    }

    // Delete the show
    await ctx.db.delete(args.showId);
    return null;
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
    status: v.union(
      v.literal("pending"),
      v.literal("importing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("not_found") // Setlist.fm doesn't have data for this show yet
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.showId);
    if (!show) return null;
    // A late failure from a concurrent request cannot undo a successful actual import.
    if (show.importStatus === "completed" && show.setlistfmId && args.status !== "completed") return null;
    const now = Date.now();
    const expiry = importRetryExpiry(show.date);
    const retryHours = args.status === "not_found"
      ? 24 * 2 ** Math.min(2, Math.max(0, (show.importAttemptCount ?? 1) - 1))
      : 1;
    const lastChance = expiry - 6 * 3600_000;
    const nextAttempt = now < lastChance ? Math.min(now + retryHours * 3600_000, lastChance) : expiry;
    await ctx.db.patch(args.showId, {
      importStatus: args.status,
      importLastAttemptAt: now,
      importRetryExpiresAt: args.status === "completed" ? undefined : expiry,
      importNextAttemptAt: args.status === "completed" ? undefined : nextAttempt,
      lastSynced: now,
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

    if (show.status === "cancelled" || !hasShowEnded(show)) return null;

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

// Bounded, resumable sweep. Runtime timezone never decides a show's local day.
export const autoTransitionStatuses = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const horizon = new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const batch = await ctx.db.query("shows")
      .withIndex("by_status_and_date", (q) => q.eq("status", "upcoming").lte("date", horizon))
      .paginate({ numItems: 200, cursor: args.cursor ?? null });
    for (const show of batch.page) {
      if (hasShowEnded(show, now)) {
        await ctx.db.patch(show._id, {
          status: "completed",
          importStatus: show.importStatus ?? "pending",
          importNextAttemptAt: show.importStatus === "completed" ? undefined : now,
          importRetryExpiresAt: show.importStatus === "completed" ? undefined : importRetryExpiry(show.date),
          lastSynced: now,
        });
      }
    }
    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internalRef.shows.autoTransitionStatuses, {
        cursor: batch.continueCursor,
      });
    }
    return null;
  },
});

export const getUpcomingCountByArtist = internalQuery({
  args: { artistId: v.id("artists") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_artist_status_and_date", (q) =>
        q.eq("artistId", args.artistId).eq("status", "upcoming"),
      )
      .collect();

    return shows.length;
  },
});

// Get show slugs worth indexing for sitemap generation.
// Bounded read: upcoming shows plus shows from the last ~180 days via the
// by_date index, capped at 4000 docs total so we never hit Convex's read limit.
// Upcoming shows are read first (soonest first) so that when the window holds
// more than the cap, it's the oldest completed shows that get truncated —
// never the future ones.
export const getAllSlugs = internalQuery({
  args: {},
  returns: v.array(
    v.object({ slug: v.string(), date: v.string(), lastmod: v.number() })
  ),
  handler: async (ctx) => {
    const CAP = 4000;
    // "YYYY-MM-DD" — matches shows.date string format
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // 1) Today + future shows, soonest first.
    const upcoming = await ctx.db
      .query("shows")
      .withIndex("by_date", (q) => q.gte("date", today))
      .take(CAP);

    // 2) Fill the remaining budget with recent past shows, newest first.
    const remaining = CAP - upcoming.length;
    const recent =
      remaining > 0
        ? await ctx.db
            .query("shows")
            .withIndex("by_date", (q) => q.gte("date", cutoff).lt("date", today))
            .order("desc")
            .take(remaining)
        : [];

    const results: { slug: string; date: string; lastmod: number }[] = [];
    for (const s of [...upcoming, ...recent]) {
      const isIndexableCandidate =
        s.status === "upcoming" ||
        (s.status === "completed" && Boolean(s.setlistfmId));
      if (s.slug && isIndexableCandidate) {
        results.push({
          slug: s.slug,
          date: s.date,
          // Real modification time — a future event date is not a lastmod,
          // and provably-wrong values make Google distrust the whole sitemap.
          lastmod: s.lastSynced ?? s._creationTime,
        });
      }
    }
    return results;
  },
});
