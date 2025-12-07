import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

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
    
    if (!festival) return null;
    
    // Get venue info if linked
    let venue = null;
    if (festival.venueId) {
      venue = await ctx.db.get(festival.venueId);
    }
    
    return { ...festival, venue };
  },
});

// Get all upcoming festivals
export const getUpcoming = query({
  args: { 
    limit: v.optional(v.number()),
    year: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const currentYear = args.year || new Date().getFullYear();
    
    // Get festivals for the specified year (status doesn't matter - dates determine if upcoming)
    const festivals = await ctx.db
      .query("festivals")
      .withIndex("by_year", (q) => q.eq("year", currentYear))
      .take(limit);
    
    // Sort by start date
    return festivals.sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  },
});

 // Get featured festivals for homepage (with images, sorted by artist count)
export const getFeatured = query({
  args: { 
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit || 12;
    const today = new Date().toISOString().split("T")[0];
    const currentYear = new Date().getFullYear();
    
    // Get all festivals from current and next year
    const festivalsThisYear = await ctx.db
      .query("festivals")
      .withIndex("by_year", (q) => q.eq("year", currentYear))
      .collect();
    
    const festivalsNextYear = await ctx.db
      .query("festivals")
      .withIndex("by_year", (q) => q.eq("year", currentYear + 1))
      .collect();
    
    const allFestivals = [...festivalsThisYear, ...festivalsNextYear];
    
    // Filter to upcoming festivals (end date >= today) and those with images
    const upcomingFestivals = allFestivals.filter(f => 
      f.endDate >= today && f.imageUrl
    );
    
    // Sort by: artist count (desc), then by start date (asc)
    upcomingFestivals.sort((a, b) => {
      // Prioritize festivals with more artists
      const artistDiff = (b.artistCount || 0) - (a.artistCount || 0);
      if (artistDiff !== 0) return artistDiff;
      // Then by start date (sooner first)
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
    
    return upcomingFestivals.slice(0, limit);
  },
});

// Get festival lineup (all artists performing)
export const getLineup = query({
  args: { festivalId: v.id("festivals") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Get all shows for this festival
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_festival", (q) => q.eq("festivalId", args.festivalId))
      .collect();
    
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
    
    if (!festival) return null;
    
    // Get all shows for this festival
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_festival", (q) => q.eq("festivalId", festival._id))
      .collect();
    
    // Enrich with artist data
    const enrichedShows = await Promise.all(
      shows.map(async (show) => {
        const artist = await ctx.db.get(show.artistId);
        
        // Get vote count for this show
        const setlists = await ctx.db
          .query("setlists")
          .withIndex("by_show", (q) => q.eq("showId", show._id))
          .collect();
        
        const totalVotes = setlists.reduce((sum, s) => sum + (s.upvotes || 0), 0);
        
        return {
          showId: show._id,
          slug: show.slug,
          dayNumber: show.dayNumber || 1,
          stageName: show.stageName || "TBA",
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
          hasSetlist: setlists.length > 0,
        };
      })
    );
    
    // Group by day
    const dayMap = new Map<number, typeof enrichedShows>();
    for (const show of enrichedShows) {
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
      festival,
      days,
      totalArtists: enrichedShows.length,
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
export const addArtist = mutation({
  args: {
    festivalId: v.id("festivals"),
    artistId: v.id("artists"),
    dayNumber: v.optional(v.number()),
    stageName: v.optional(v.string()),
    setTime: v.optional(v.string()),
    setEndTime: v.optional(v.string()),
  },
  returns: v.id("shows"),
  handler: async (ctx, args) => {
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
      // Update existing show
      await ctx.db.patch(existingShow._id, {
        dayNumber: args.dayNumber,
        stageName: args.stageName,
        setTime: args.setTime,
        setEndTime: args.setEndTime,
      });
      return existingShow._id;
    }
    
    // Create new show for this artist at the festival
    const showId = await ctx.db.insert("shows", {
      slug,
      artistId: args.artistId,
      venueId,
      date: showDate,
      startTime: args.setTime,
      status: "upcoming",
      festivalId: args.festivalId,
      stageName: args.stageName,
      setTime: args.setTime,
      setEndTime: args.setEndTime,
      dayNumber: args.dayNumber || 1,
      isFestivalSet: true,
      setlistCount: 0,
      voteCount: 0,
      trendingScore: 0,
      trendingRank: 0,
      lastSynced: Date.now(),
    });
    
    // Update festival artist count
    await ctx.db.patch(args.festivalId, {
      artistCount: (festival.artistCount || 0) + 1,
      status: "lineup", // At least one artist means lineup is available
    });
    
    // Schedule auto-setlist generation for this festival show
    // (will be picked up by cron or executed immediately if artist has songs)
    await ctx.scheduler.runAfter(1000, internalRef.setlists.autoGenerateSetlist, {
      showId,
      artistId: args.artistId,
    });
    
    return showId;
  },
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
    
    // Get or create venue
    let venueId = festival.venueId;
    if (!venueId) {
      const cityParts = festival.location.split(",");
      venueId = await ctx.db.insert("venues", {
        name: festival.name,
        city: cityParts[0]?.trim() || festival.location,
        state: cityParts[1]?.trim() || "",
        country: "US",
      });
      await ctx.db.patch(args.festivalId, { venueId });
    }
    
    // Check if already added
    const existing = await ctx.db
      .query("shows")
      .withIndex("by_festival", (q) => q.eq("festivalId", args.festivalId))
      .filter((q) => q.eq(q.field("artistId"), artist._id))
      .first();
    
    if (existing) {
      return existing._id;
    }
    
    // Calculate show date based on day number
    const dayOffset = (args.dayNumber || 1) - 1;
    const startDate = new Date(festival.startDate);
    startDate.setDate(startDate.getDate() + dayOffset);
    const showDate = startDate.toISOString().split("T")[0];
    
    const slug = `${artist.slug}-${festival.slug}-${showDate}`;
    
    // Create show
    const showId = await ctx.db.insert("shows", {
      slug,
      artistId: artist._id,
      venueId,
      date: showDate,
      status: "upcoming",
      festivalId: args.festivalId,
      dayNumber: args.dayNumber || 1,
      isFestivalSet: true,
      setlistCount: 0,
      voteCount: 0,
      trendingScore: 0,
      trendingRank: 0,
      lastSynced: Date.now(),
    });
    
    // Update artist count
    await ctx.db.patch(args.festivalId, {
      artistCount: (festival.artistCount || 0) + 1,
      status: "lineup",
    });
    
    // Schedule auto-setlist generation for this festival show
    // Uses scheduler to avoid blocking - will be picked up immediately if artist has songs
    await ctx.scheduler.runAfter(1000, internalRef.setlists.autoGenerateSetlist, {
      showId,
      artistId: artist._id,
    });
    
    console.log(`✅ Added ${artist.name} to ${festival.name}`);
    return showId;
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
    // Extract clean festival name
    const festivalName = extractFestivalName(args.eventName);
    
    // Extract year from event date
    const year = new Date(args.eventDate).getFullYear();
    if (!year || year < 2020 || year > 2030) {
      console.log(`⚠️ Invalid year from event date: ${args.eventDate}`);
      return null;
    }
    
    // Generate slug
    const slug = generateFestivalSlug(festivalName);
    if (!slug || slug.length < 3) {
      console.log(`⚠️ Could not generate valid slug for: ${festivalName}`);
      return null;
    }
    
    // Try to find existing festival by slug (most reliable)
    let existing = await ctx.db
      .query("festivals")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    
    // Also try by ticketmasterId if provided
    if (!existing && args.ticketmasterId) {
      existing = await ctx.db
        .query("festivals")
        .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", args.ticketmasterId))
        .first();
    }
    
    if (existing) {
      console.log(`✅ Found existing festival: ${existing.name} (${existing._id})`);
      
      // Update ticketmasterId if not set
      if (!existing.ticketmasterId && args.ticketmasterId) {
        await ctx.db.patch(existing._id, { 
          ticketmasterId: args.ticketmasterId,
          ticketUrl: args.ticketUrl || existing.ticketUrl,
          lastSynced: Date.now(),
        });
      }
      
      return existing._id;
    }
    
    // Build location string
    const location = [args.venueCity, args.venueState].filter(Boolean).join(", ") || "TBA";
    
    // Estimate festival dates (most US festivals are 3-day weekends)
    const eventDate = new Date(args.eventDate);
    const dayOfWeek = eventDate.getDay();
    
    // Assume festival starts on Friday if event is on weekend
    let startDate = args.eventDate;
    let endDate = args.eventDate;
    
    if (dayOfWeek === 0) { // Sunday - assume started Friday
      const friday = new Date(eventDate);
      friday.setDate(friday.getDate() - 2);
      startDate = friday.toISOString().split("T")[0];
      endDate = args.eventDate;
    } else if (dayOfWeek === 6) { // Saturday - assume started Friday
      const friday = new Date(eventDate);
      friday.setDate(friday.getDate() - 1);
      startDate = friday.toISOString().split("T")[0];
      const sunday = new Date(eventDate);
      sunday.setDate(sunday.getDate() + 1);
      endDate = sunday.toISOString().split("T")[0];
    } else if (dayOfWeek === 5) { // Friday - assume ends Sunday
      const sunday = new Date(eventDate);
      sunday.setDate(sunday.getDate() + 2);
      endDate = sunday.toISOString().split("T")[0];
    }
    
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
      slug,
      year,
      startDate,
      endDate,
      location,
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
    
    // Don't overwrite if already linked
    if (show.festivalId) return null;
    
    await ctx.db.patch(args.showId, {
      festivalId: args.festivalId,
      isFestivalSet: true,
    });
    
    // Increment festival artist count
    const festival = await ctx.db.get(args.festivalId);
    if (festival) {
      await ctx.db.patch(args.festivalId, {
        artistCount: (festival.artistCount || 0) + 1,
        status: festival.status === "announced" ? "lineup" : festival.status,
      });
    }
    
    return null;
  },
});

// Get all festival slugs for sitemap generation
export const getAllSlugs = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const festivals = await ctx.db.query("festivals").collect();
    return festivals.map((f) => f.slug).filter((slug): slug is string => !!slug);
  },
});

