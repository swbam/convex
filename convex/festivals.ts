import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { festivalView } from "./lib/festivalMedia";
import { internalRef, requireAdmin } from "./adminHelpers";
import { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { festivalDay, normalizeFestivalText, isFestivalEvent, isFestivalListed } from "./lib/festivalIdentity";

async function editionShows(ctx: QueryCtx, festival: Doc<"festivals">) {
  const linked = await ctx.db.query("shows").withIndex("by_festival", q => q.eq("festivalId", festival._id)).collect();
  const result = [];
  for (const show of linked) {
    if (show.date < festival.startDate || show.date > festival.endDate) continue;
    const venue = await ctx.db.get(show.venueId);
    const [city, state] = festival.location.split(",").map(normalizeFestivalText);
    if (venue && city && city !== "tba" && (normalizeFestivalText(venue.city) !== city || (state && normalizeFestivalText(venue.state ?? "") !== state))) continue;
    result.push(show);
  }
  return result;
}

async function editionArtistCount(ctx: QueryCtx, festival: Doc<"festivals">) {
  const roster = await ctx.db.query("festivalLineupEntries").withIndex("by_festival", q => q.eq("festivalId", festival._id)).take(600);
  const names = new Set(roster.map(e => e.nameKey));
  for (const show of await editionShows(ctx, festival)) {
    const artist = await ctx.db.get(show.artistId);
    if (artist) names.add(normalizeFestivalText(artist.name));
  }
  return names.size;
}


// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any


// ============================================================================
// PUBLIC QUERIES
// ============================================================================

// Get a festival by slug
export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const festival = await ctx.db
      .query("festivals")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (!festival || !isFestivalListed(festival)) return null;

    // Get venue info if linked
    let venue = null;
    if (festival.venueId) {
      venue = await ctx.db.get(festival.venueId);
    }

    return { ...festivalView(festival), venue };
  },
});

// Date filtering happens before pagination. Ongoing editions remain upcoming.
export const browse = query({
  args: { period: v.union(v.literal("upcoming"), v.literal("past")), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await ctx.db.query("festivals").withIndex("by_discovery_end", q => args.period === "past"
      ? q.eq("discoveryState", "listed").lt("endDate", today)
      : q.eq("discoveryState", "listed").gte("endDate", today))
      .order(args.period === "past" ? "desc" : "asc")
      .paginate({ ...args.paginationOpts, numItems: Math.max(1, Math.min(48, args.paginationOpts.numItems)) });
    return { ...result, page: result.page.map(festivalView) };
  },
});
export const getUpcoming = query({
  args: { limit: v.optional(v.number()), year: v.optional(v.number()) }, returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let q = ctx.db.query("festivals").withIndex("by_discovery_end", q => q.eq("discoveryState", "listed").gte("endDate", new Date().toISOString().slice(0,10)));
    if (args.year) q = q.filter(q => q.eq(q.field("year"), args.year));
    return (await q.take(Math.max(1, Math.min(100, args.limit ?? 20)))).map(festivalView);
  },
});
export const getFeatured = query({
  args: { limit: v.optional(v.number()) }, returns: v.array(v.any()),
  handler: async (ctx, args) => (await ctx.db.query("festivals").withIndex("by_discovery_end", q =>
    q.eq("discoveryState", "listed").gte("endDate", new Date().toISOString().slice(0,10))).take(100))
      .map(festivalView).filter(f => f.imageUrl).slice(0, Math.max(1, Math.min(24, args.limit ?? 12))),
});

// Get festival lineup (all artists performing)
export const getLineup = query({
  args: { festivalId: v.id("festivals") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const festival = await ctx.db.get(args.festivalId);
    if (!festival) return [];
    const shows = await editionShows(ctx, festival);

    // Enrich with artist data
    const enrichedShows = await Promise.all(
      shows.map(async (show) => {
        const artist = await ctx.db.get(show.artistId);
        return {
          ...show,
          artist: artist ? {
            _id: artist._id,
            name: artist.name,
            slug: artist.slug,
            images: artist.images,
            genres: artist.genres,
            popularity: artist.popularity,
          } : null,
        };
      })
    );

    // Sort by set time if available, otherwise by artist name
    return enrichedShows.sort((a, b) => {
      if (a.setTime && b.setTime) {
        return a.setTime.localeCompare(b.setTime);
      }
      if (a.dayNumber !== b.dayNumber) {
        return (a.dayNumber || 0) - (b.dayNumber || 0);
      }
      return (a.artist?.name || "").localeCompare(b.artist?.name || "");
    });
  },
});

// Get festival schedule grouped by day
export const getSchedule = query({
  args: { festivalSlug: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const festival = await ctx.db
      .query("festivals")
      .withIndex("by_slug", (q) => q.eq("slug", args.festivalSlug))
      .unique();

    if (!festival || !isFestivalListed(festival)) return null;

    const shows = await editionShows(ctx, festival);

    // Enrich with artist data
    const enrichedShows = await Promise.all(
      shows.map(async (show) => {
        const artist = await ctx.db.get(show.artistId);

        // Get vote count for this show
        const setlists = await ctx.db
          .query("setlists")
          .withIndex("by_show", (q) => q.eq("showId", show._id))
          .collect();

        const totalVotes = show.voteCount ?? 0;

        return {
          showId: show._id,
          slug: show.slug,
          dayNumber: show.festivalScheduleConfirmed === false || (!show.ticketmasterId && !show.setTime) ? 0 : festivalDay(festival.startDate, show.date),
          stageName: show.stageName,
          setTime: show.setTime,
          setEndTime: show.setEndTime,
          artist: artist ? {
            _id: artist._id,
            name: artist.name,
            slug: artist.slug,
            images: artist.images,
            genres: artist.genres,
          } : null,
          voteCount: totalVotes,
          hasSetlist: setlists.some(s => s.isOfficial && !!s.actualSetlist?.length),
        };
      })
    );

    const roster = await ctx.db.query("festivalLineupEntries").withIndex("by_festival", q => q.eq("festivalId", festival._id)).take(600);
    const represented = new Set(enrichedShows.filter(s => s.artist).map(s => normalizeFestivalText(s.artist!.name)));
    const rosterShows = [];
    for (const entry of roster) {
      if (represented.has(entry.nameKey)) continue;
      const artist = entry.artistId ? await ctx.db.get(entry.artistId) : null;
      rosterShows.push({ lineupEntryId: entry._id, showId: undefined, slug: undefined,
        dayNumber: entry.dayNumber ?? 0, stageName: undefined, setTime: undefined, setEndTime: undefined,
        artist: artist ? { _id: artist._id, name: artist.name, slug: artist.slug, images: artist.images, genres: artist.genres }
          : { _id: undefined, name: entry.name, slug: undefined, images: undefined, genres: undefined },
        voteCount: 0, hasSetlist: false });
    }
    const allEntries = [...enrichedShows, ...rosterShows];

    // Group by day
    const dayMap = new Map<number, typeof allEntries>();
    for (const show of allEntries) {
      const day = show.dayNumber;
      if (!dayMap.has(day)) {
        dayMap.set(day, []);
      }
      dayMap.get(day)!.push(show);
    }

    // Convert to array and sort each day's shows
    const days = Array.from(dayMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([dayNumber, dayShows]) => ({
        dayNumber,
        shows: dayShows.sort((a, b) => {
          if (a.setTime && b.setTime) return a.setTime.localeCompare(b.setTime);
          return (a.artist?.name || "").localeCompare(b.artist?.name || "");
        }),
      }));

    return {
      festival: festivalView(festival),
      days,
      totalArtists: new Set(allEntries.filter(s => s.artist).map(s => normalizeFestivalText(s.artist!.name))).size,
    };
  },
});

// List all festivals (for admin/browse)
export const list = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    let festivalsQuery = ctx.db.query("festivals");

    if (args.status) {
      festivalsQuery = festivalsQuery.filter((q) =>
        q.eq(q.field("status"), args.status)
      );
    }

    const festivals = await festivalsQuery
      .order("desc")
      .take(limit);

    return festivals;
  },
});

// ============================================================================
// PUBLIC MUTATIONS
// ============================================================================

// Create a new festival (admin only)
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    year: v.number(),
    startDate: v.string(),
    endDate: v.string(),
    location: v.string(),
    imageUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    wikiUrl: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
  },
  returns: v.id("festivals"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Check if slug already exists
    const existing = await ctx.db
      .query("festivals")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (existing) {
      throw new Error(`Festival with slug "${args.slug}" already exists`);
    }

    return await ctx.db.insert("festivals", {
      name: args.name,
      discoveryState: "listed",
      slug: args.slug,
      year: args.year,
      startDate: args.startDate,
      endDate: args.endDate,
      location: args.location,
      imageUrl: args.imageUrl,
      websiteUrl: args.websiteUrl,
      wikiUrl: args.wikiUrl,
      genres: args.genres || [],
      status: "announced",
      artistCount: 0,
      totalVotes: 0,
      lastSynced: Date.now(),
    });
  },
});

// Add an artist to a festival (creates a show record)
const addArtistArgs = {
    festivalId: v.id("festivals"),
    artistId: v.id("artists"),
    dayNumber: v.optional(v.number()),
    stageName: v.optional(v.string()),
    setTime: v.optional(v.string()),
    setEndTime: v.optional(v.string()),
  };
async function addFestivalArtist(ctx: MutationCtx, args: { festivalId: Id<"festivals">; artistId: Id<"artists">; dayNumber?: number; stageName?: string; setTime?: string; setEndTime?: string }) {
    if (args.dayNumber !== undefined && (!Number.isInteger(args.dayNumber) || args.dayNumber < 1)) throw new Error("Invalid festival day");
    const festival = await ctx.db.get(args.festivalId);
    if (!festival) {
      throw new Error("Festival not found");
    }

    const artist = await ctx.db.get(args.artistId);
    if (!artist) {
      throw new Error("Artist not found");
    }

    // Get or create venue for festival
    let venueId = festival.venueId;
    if (!venueId) {
      // Create a generic venue for the festival
      venueId = await ctx.db.insert("venues", {
        name: festival.name,
        city: festival.location.split(",")[0]?.trim() || festival.location,
        state: festival.location.split(",")[1]?.trim() || "",
        country: "US",
      });

      // Update festival with venue
      await ctx.db.patch(args.festivalId, { venueId });
    }

    // Create show slug
    const showDate = args.dayNumber
      ? new Date(new Date(festival.startDate).getTime() + (args.dayNumber - 1) * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      : festival.startDate;

    const slug = `${artist.slug}-${festival.slug}-${showDate}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    // Check if show already exists
    const existingShow = await ctx.db
      .query("shows")
      .withIndex("by_festival", (q) => q.eq("festivalId", args.festivalId))
      .filter((q) => q.eq(q.field("artistId"), args.artistId))
      .first();

    if (existingShow) {
      // A roster refresh must not erase a known performance schedule.
      if (args.dayNumber !== undefined) {
        if (showDate > festival.endDate) throw new Error("Day falls outside festival dates");
        await ctx.db.patch(existingShow._id, { dayNumber: args.dayNumber, date: showDate, festivalScheduleConfirmed: true });
      }
      for (const field of ["stageName", "setTime", "setEndTime"] as const) {
        if (args[field] !== undefined) await ctx.db.patch(existingShow._id, { [field]: args[field] });
      }
      return existingShow._id;
    }

    if (showDate > festival.endDate) throw new Error("Day falls outside festival dates");
    // Create new show for this artist at the festival
    const showId = await ctx.db.insert("shows", {
      slug,
      artistId: args.artistId,
      venueId,
      date: showDate,
      startTime: args.setTime,
      status: festival.endDate < new Date().toISOString().slice(0, 10) ? "completed" : "upcoming",
      festivalId: args.festivalId,
      stageName: args.stageName,
      setTime: args.setTime,
      setEndTime: args.setEndTime,
      dayNumber: args.dayNumber,
      festivalScheduleConfirmed: args.dayNumber !== undefined,
      isFestivalSet: true,
      setlistCount: 0,
      voteCount: 0,
      trendingScore: 0,
      trendingRank: 0,
      lastSynced: Date.now(),
    });

    // Update festival artist count
    await ctx.db.patch(args.festivalId, {
      artistCount: await editionArtistCount(ctx, festival),
      status: festival.status === "announced" ? "lineup" : festival.status,
    });

    // Schedule auto-setlist generation for this festival show
    // (will be picked up by cron or executed immediately if artist has songs)
    await ctx.scheduler.runAfter(1000, internalRef.setlists.autoGenerateSetlist, {
      showId,
      artistId: args.artistId,
    });

    return showId;
}
export const addArtist = mutation({
  args: addArtistArgs, returns: v.id("shows"),
  handler: async (ctx, args) => { await requireAdmin(ctx); return addFestivalArtist(ctx, args); },
});
export const addArtistInternal = internalMutation({
  args: addArtistArgs, returns: v.id("shows"), handler: addFestivalArtist,
});

// ============================================================================
// INTERNAL MUTATIONS (for bootstrap/scraper)
// ============================================================================

// Upsert a festival (create or update)
export const upsertFestival = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    year: v.number(),
    startDate: v.string(),
    endDate: v.string(),
    location: v.string(),
    imageUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    ticketUrl: v.optional(v.string()), // Direct Ticketmaster link for affiliate revenue
    wikiUrl: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
  },
  returns: v.id("festivals"),
  handler: async (ctx, args) => {
    // Check if exists
    const existing = await ctx.db
      .query("festivals")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        name: args.name,
        startDate: args.startDate || existing.startDate,
        endDate: args.endDate || existing.endDate,
        location: args.location,
        imageUrl: args.imageUrl || existing.imageUrl,
        websiteUrl: args.websiteUrl || existing.websiteUrl,
        ticketUrl: args.ticketUrl || existing.ticketUrl, // Preserve existing ticketUrl
        wikiUrl: args.wikiUrl || existing.wikiUrl,
        genres: args.genres || existing.genres,
        lastSynced: Date.now(),
      });
      return existing._id;
    }

    // Create new
    return await ctx.db.insert("festivals", {
      name: args.name,
      discoveryState: "listed",
      slug: args.slug,
      year: args.year,
      startDate: args.startDate,
      endDate: args.endDate,
      location: args.location,
      imageUrl: args.imageUrl,
      websiteUrl: args.websiteUrl,
      ticketUrl: args.ticketUrl, // Store ticket URL for affiliate revenue
      wikiUrl: args.wikiUrl,
      genres: args.genres || [],
      status: "announced",
      artistCount: 0,
      totalVotes: 0,
      lastSynced: Date.now(),
    });
  },
});

// Add artist to festival by name (finds or creates artist)
export const addArtistByName = internalMutation({
  args: {
    festivalId: v.id("festivals"),
    artistName: v.string(),
    dayNumber: v.optional(v.number()),
  },
  returns: v.union(v.id("shows"), v.null()),
  handler: async (ctx, args) => {
    const festival = await ctx.db.get(args.festivalId);
    if (!festival) {
      console.log(`Festival not found: ${args.festivalId}`);
      return null;
    }

    // Find artist by name (case-insensitive)
    const lowerName = args.artistName.toLowerCase().trim();
    const artist = await ctx.db
      .query("artists")
      .withIndex("by_lower_name", (q) => q.eq("lowerName", lowerName))
      .first();

    if (!artist) {
      console.log(`Artist not found in database: ${args.artistName}`);
      return null;
    }

    return addFestivalArtist(ctx, { festivalId: args.festivalId, artistId: artist._id, dayNumber: args.dayNumber });
  },
});

// Update festival status based on dates
export const transitionStatuses = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0];

    const festivals = await ctx.db.query("festivals").collect();

    for (const festival of festivals) {
      let newStatus = festival.status;

      if (festival.endDate < today && festival.status !== "completed") {
        newStatus = "completed";
      } else if (festival.startDate <= today && festival.endDate >= today && festival.status !== "ongoing") {
        newStatus = "ongoing";
      }

      if (newStatus !== festival.status) {
        await ctx.db.patch(festival._id, { status: newStatus });
        console.log(`Festival ${festival.name} status: ${festival.status} → ${newStatus}`);
      }
    }

    return null;
  },
});

// Get festival by ID (internal)
export const getById = internalQuery({
  args: { festivalId: v.id("festivals") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.festivalId);
  },
});

// List all festivals (internal - for image updates)
export const listAll = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("festivals").collect();
  },
});

// Update festival image
export const updateImage = internalMutation({
  args: {
    festivalId: v.id("festivals"),
    imageUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    ticketUrl: v.optional(v.string()), // Direct Ticketmaster link for affiliate revenue
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: Record<string, string | undefined> = {};
    if (args.imageUrl) updates.imageUrl = args.imageUrl;
    if (args.websiteUrl) updates.websiteUrl = args.websiteUrl;
    if (args.ticketUrl) updates.ticketUrl = args.ticketUrl;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.festivalId, updates);
    }
    return null;
  },
});

// ============================================================================
// DYNAMIC FESTIVAL CREATION (from Ticketmaster events)
// ============================================================================

/**
 * Helper to extract a clean festival name from Ticketmaster event name
 * e.g., "Railbird Festival 2025 - Day 1" → "Railbird Festival 2025"
 */
function extractFestivalName(eventName: string): string {
  // Remove day/pass suffixes
  let name = eventName
    .replace(/\s*-\s*(Day|Night|Weekend|Pass|Ticket|GA|VIP|Camping).*$/i, "")
    .replace(/\s*\(\s*(Day|Night|Pass|General|VIP).*\)$/i, "")
    .trim();

  // If doesn't end with year, try to add it
  if (!/\d{4}$/.test(name)) {
    const yearMatch = eventName.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      name = `${name} ${yearMatch[1]}`;
    }
  }

  return name;
}

/**
 * Helper to generate a slug from festival name
 */
function generateFestivalSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Create or find a festival from a Ticketmaster event.
 * Used when dynamic festival detection identifies a show as being part of a festival.
 * This is FAST and returns immediately - enrichment happens in background.
 */
export const upsertFestivalFromEvent = internalMutation({
  args: {
    imageUrl: v.optional(v.string()),
    imageCardUrl: v.optional(v.string()),
    imageAttribution: v.optional(v.string()),
    classificationConfirmed: v.optional(v.boolean()),
    eventName: v.string(),           // Original Ticketmaster event name
    eventDate: v.string(),           // YYYY-MM-DD
    ticketmasterId: v.optional(v.string()), // TM event ID (for deduplication)
    venueName: v.optional(v.string()),
    venueCity: v.optional(v.string()),
    venueState: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
  },
  returns: v.union(v.id("festivals"), v.null()),
  handler: async (ctx, args) => {
    if (!args.classificationConfirmed && !isFestivalEvent({ name: args.eventName })) return null;
    // Extract clean festival name
    const festivalName = extractFestivalName(args.eventName);

    // Extract year from event date
    const year = new Date(args.eventDate).getFullYear();
    if (!year || year < 2020 || year > 2030) {
      console.log(`⚠️ Invalid year from event date: ${args.eventDate}`);
      return null;
    }

    const baseSlug = generateFestivalSlug(festivalName);
    if (baseSlug.length < 3) return null;
    const location = [args.venueCity, args.venueState].filter(Boolean).join(", ") || "TBA";
    const editionCandidates = await ctx.db.query("festivals").withIndex("by_year", q => q.eq("year", year)).collect();
    const existing = editionCandidates.find(f =>
      normalizeFestivalText(f.name) === normalizeFestivalText(festivalName) &&
      normalizeFestivalText(f.location) === normalizeFestivalText(location) &&
      (!f.sourceVenueName || normalizeFestivalText(f.sourceVenueName) === normalizeFestivalText(args.venueName ?? "")) &&
      Math.abs(festivalDay(f.startDate, args.eventDate) - 1) <= 13 &&
      Math.abs(festivalDay(f.endDate, args.eventDate) - 1) <= 13
    );
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.imageUrl ? { imageUrl: args.imageUrl, imageCardUrl: args.imageCardUrl, imageAttribution: args.imageAttribution, imageUpdatedAt: Date.now() } : {}),
        startDate: args.eventDate < existing.startDate ? args.eventDate : existing.startDate,
        endDate: args.eventDate > existing.endDate ? args.eventDate : existing.endDate,
        ticketmasterId: existing.ticketmasterId ?? args.ticketmasterId,
        ticketUrl: existing.ticketUrl ?? args.ticketUrl,
        sourceVenueName: existing.sourceVenueName ?? args.venueName,
      });
      return existing._id;
    }
    const slug = `${baseSlug}-${year}-${generateFestivalSlug(args.venueName || location)}-${args.eventDate}`;
    // Only observed provider dates are known; never invent Friday-Sunday dates.
    const startDate = args.eventDate;
    const endDate = args.eventDate;

    // Determine initial status based on date
    const today = new Date().toISOString().split("T")[0];
    let status: "announced" | "lineup" | "scheduled" | "ongoing" | "completed" = "announced";
    if (endDate < today) {
      status = "completed";
    } else if (startDate <= today && endDate >= today) {
      status = "ongoing";
    }

    // Create new festival
    const festivalId = await ctx.db.insert("festivals", {
      name: festivalName,
      discoveryState: "listed",
      imageUrl: args.imageUrl, imageCardUrl: args.imageCardUrl, imageAttribution: args.imageAttribution,
      imageUpdatedAt: args.imageUrl ? Date.now() : undefined,
      slug,
      year,
      startDate,
      endDate,
      location,
      sourceVenueName: args.venueName,
      ticketmasterId: args.ticketmasterId,
      ticketUrl: args.ticketUrl,
      status,
      artistCount: 0,
      totalVotes: 0,
      lastSynced: Date.now(),
    });

    console.log(`🎪 Created new festival: ${festivalName} (${festivalId})`);

    return festivalId;
  },
});

/**
 * Link an existing show to a festival (used when festival is detected after show creation)
 */
export const linkShowToFestival = internalMutation({
  args: {
    showId: v.id("shows"),
    festivalId: v.id("festivals"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.showId);
    if (!show) return null;

    if (show.festivalId) return null;
    const festival = await ctx.db.get(args.festivalId);
    if (!festival || show.date < festival.startDate || show.date > festival.endDate) return null;
    const venue = await ctx.db.get(show.venueId);
    const [city, state] = festival.location.split(",").map(normalizeFestivalText);
    if (!venue || normalizeFestivalText(venue.city) !== city || (state && normalizeFestivalText(venue.state ?? "") !== state)) return null;
    await ctx.db.patch(args.showId, {
      festivalId: args.festivalId, isFestivalSet: true,
      dayNumber: festivalDay(festival.startDate, show.date), festivalScheduleConfirmed: true,
    });
    await ctx.db.patch(festival._id, {
      artistCount: await editionArtistCount(ctx, festival),
      status: festival.status === "announced" ? "lineup" : festival.status,
    });

    return null;
  },
});

// Get all festival slugs for sitemap generation (bounded; small table).
export const getAllSlugs = internalQuery({
  args: {},
  returns: v.array(v.object({ slug: v.string(), lastmod: v.optional(v.number()) })),
  handler: async (ctx) => {
    const festivals = await ctx.db.query("festivals").take(500);
    const results: { slug: string; lastmod?: number }[] = [];
    for (const f of festivals) {
      if (f.slug) results.push({ slug: f.slug, lastmod: f.lastSynced ?? f._creationTime });
    }
    return results;
  },
});

// Search festivals by name for blog affiliate linking
export const searchByName = query({
  args: { names: v.array(v.string()) },
  returns: v.array(v.object({
    name: v.string(),
    slug: v.string(),
    ticketUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    year: v.number(),
    location: v.string(),
  })),
  handler: async (ctx, args) => {
    const results: Array<{
      name: string;
      slug: string;
      ticketUrl?: string;
      websiteUrl?: string;
      year: number;
      location: string;
    }> = [];

    // Get all festivals and match against provided names
    const festivals = await ctx.db.query("festivals").collect();

    for (const searchName of args.names) {
      const lowerSearch = searchName.toLowerCase();

      // Find festivals that match the search term
      const matches = festivals.filter(f => {
        const lowerName = f.name.toLowerCase();
        // Match if the festival name contains the search term or vice versa
        return lowerName.includes(lowerSearch) || lowerSearch.includes(lowerName.replace(/\s+\d{4}$/, '').toLowerCase());
      });

      for (const match of matches) {
        // Avoid duplicates
        if (!results.some(r => r.slug === match.slug)) {
          results.push({
            name: match.name,
            slug: match.slug,
            ticketUrl: match.ticketUrl,
            websiteUrl: match.websiteUrl,
            year: match.year,
            location: match.location,
          });
        }
      }
    }

    return results;
  },
});

// Get all festivals with affiliate links for blog content
export const getAllWithAffiliateLinks = query({
  args: {},
  returns: v.array(v.object({
    name: v.string(),
    slug: v.string(),
    ticketUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    year: v.number(),
    location: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  })),
  handler: async (ctx) => {
    const festivals = await ctx.db.query("festivals").collect();

    return festivals.map(f => ({
      name: f.name,
      slug: f.slug,
      ticketUrl: f.ticketUrl,
      websiteUrl: f.websiteUrl,
      year: f.year,
      location: f.location,
      startDate: f.startDate,
      endDate: f.endDate,
    }));
  },
});

// ============================================================================
// CRON: Auto-refresh partial lineups
// ============================================================================

/**
 * Get festivals with partial lineups that need refresh.
 * Criteria:
 * - artistCount < 20 (partial lineup)
 * - startDate is in the future (upcoming festival)
 * - lastSynced was more than 24 hours ago
 */
export const getPartialLineupFestivals = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 5;
    const today = new Date().toISOString().split("T")[0];
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    // Get all upcoming festivals
    const festivals = await ctx.db
      .query("festivals")
      .collect();

    // Filter for partial lineups that need refresh
    const needsRefresh = festivals.filter(f => {
      // Must be upcoming
      if (f.startDate <= today) return false;
      // Must have partial lineup (< 20 artists) or no lineup at all
      if (!isFestivalListed(f) || f.lineupStatus === "verified") return false;
      // Must not have been synced recently
      if (f.lastSynced && f.lastSynced > oneDayAgo) return false;
      return true;
    });

    // Sort by start date (soonest first) and take limit
    return needsRefresh
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, limit);
  },
});

/**
 * Cron job: Refresh partial festival lineups.
 * Runs weekly to find and fill incomplete festival lineups.
 */
export const refreshPartialLineups = internalMutation({
  args: {},
  returns: v.object({
    checked: v.number(),
    scheduled: v.number(),
    festivals: v.array(v.string()),
  }),
  handler: async (ctx) => {
    console.log("🎪 Running partial lineup refresh cron...");

    // Get festivals with partial lineups
    const festivals = await ctx.db
      .query("festivals")
      .withIndex("by_discovery_end", q => q.eq("discoveryState", "listed").gte("endDate", new Date().toISOString().slice(0,10)))
      .take(100);

    const today = new Date().toISOString().split("T")[0];
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);

    // Filter for partial lineups that need refresh
    const needsRefresh = festivals.filter(f => {
      if (f.startDate <= today) return false;
      if (!isFestivalListed(f) || f.lineupStatus === "verified") return false;
      if (f.lineupCheckedAt && f.lineupCheckedAt > threeDaysAgo) return false;
      return true;
    });

    // Sort by start date (soonest first) and take top 3 to avoid API rate limits
    const toProcess = needsRefresh
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 3);

    const scheduledNames: string[] = [];

    for (const festival of toProcess) {
      // Mark as synced to prevent duplicate processing
      await ctx.db.patch(festival._id, { lineupCheckedAt: Date.now() });

      // Schedule the lineup import action
      // Note: We can't call actions from mutations directly, so we schedule them
      await ctx.scheduler.runAfter(0, internalRef.festivalLineupImport.startFestivalLineupImportInternal, {
        festivalId: festival._id,
      });

      scheduledNames.push(festival.name);
      console.log(`   📅 Scheduled lineup import for: ${festival.name} (${festival.artistCount || 0} artists)`);
    }

    console.log(`🎪 Partial lineup refresh: checked=${needsRefresh.length}, scheduled=${scheduledNames.length}`);

    return {
      checked: needsRefresh.length,
      scheduled: scheduledNames.length,
      festivals: scheduledNames,
    };
  },
});

// Delete a festival by ID (for cleanup operations)
export const deleteFestivalInternal = internalMutation({
  args: { festivalId: v.id("festivals") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.festivalId);
    console.log(`🗑️ Deleted festival: ${args.festivalId}`);
    return null;
  },
});

// Delete festivals that are actually artist names (not real festivals)
export const cleanupInvalidFestivals = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number(), checked: v.number() }),
  handler: async (ctx) => {
    console.log("🧹 Cleaning up invalid festivals (artist names, not multi-day events)...");

    // Known artist names that got incorrectly imported as festivals
    const invalidFestivalPatterns = [
      /^colter wall$/i,
      /^billy strings$/i,
      /^tyler childers$/i,
      /^zach bryan$/i,
    ];

    const festivals = await ctx.db.query("festivals").collect();
    let deleted = 0;
    let checked = 0;

    for (const festival of festivals) {
      checked++;

      // Check if this looks like an artist name, not a festival
      const isInvalid = invalidFestivalPatterns.some(pattern =>
        pattern.test(festival.name)
      );

      // Also check for festivals with no artists and suspicious names (no "fest" or "festival" in name)
      const lowerName = festival.name.toLowerCase();
      const looksLikeFestival =
        lowerName.includes('fest') ||
        lowerName.includes('festival') ||
        lowerName.includes('carnival') ||
        lowerName.includes('coachella') ||
        lowerName.includes('bonnaroo') ||
        lowerName.includes('lollapalooza') ||
        lowerName.includes('pal') || // ACL, etc.
        lowerName.includes('lands') || // Outside Lands
        lowerName.includes('electric') || // EDC, Electric Forest
        lowerName.includes('ultra') ||
        lowerName.includes('rolling loud') ||
        lowerName.includes('riot') ||
        lowerName.includes('jam') ||
        lowerName.includes('friends'); // "X and Friends" type events

      // Delete if it matches invalid pattern OR if it has 0 artists and doesn't look like a festival
      if (isInvalid || (festival.artistCount === 0 && !looksLikeFestival)) {
        console.log(`🗑️ Deleting invalid festival: "${festival.name}" (artistCount: ${festival.artistCount})`);
        await ctx.db.delete(festival._id);
        deleted++;
      }
    }

    console.log(`✅ Deleted ${deleted} invalid festivals out of ${checked} checked`);
    return { deleted, checked };
  },
});


// Repair counters without deleting or reassigning legacy performances. Small
// batches let operators inspect historical edition contamination separately.
export const reconcileEditionCounts = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("festivals").paginate({ cursor: args.cursor ?? null, numItems: 25 });
    let updated = 0;
    for (const festival of page.page) {
      const count = await editionArtistCount(ctx, festival);
      if (count !== festival.artistCount) { await ctx.db.patch(festival._id, { artistCount: count }); updated++; }
    }
    return { updated, cursor: page.continueCursor, done: page.isDone };
  },
});
