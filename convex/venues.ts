import { normalizeMusicName } from "./lib/setlistMatch";
import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

function slugifyVenue(name: string, city: string, state?: string, country?: string) {
  return [name, city, state || country]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

async function uniqueVenueSlug(ctx: any, args: {
  name: string;
  city: string;
  state?: string;
  country?: string;
  ticketmasterId?: string;
}, currentId?: Id<"venues">) {
  const base = slugifyVenue(args.name, args.city, args.state, args.country) || "venue";
  const existing = await ctx.db
    .query("venues")
    .withIndex("by_slug", (q: any) => q.eq("slug", base))
    .first();
  if (!existing || existing._id === currentId) return base;
  const suffix = (args.ticketmasterId || String(currentId || Date.now()))
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-8)
    .toLowerCase();
  return `${base}-${suffix || "live"}`;
}

export const getById = query({
  args: { id: v.id("venues") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBySlugOrId = query({
  args: { key: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const bySlug = await ctx.db
      .query("venues")
      .withIndex("by_slug", (q) => q.eq("slug", args.key))
      .first();
    if (bySlug) return bySlug;
    try {
      const venue = await ctx.db.get(args.key as Id<"venues">);
      return venue && "city" in venue && "country" in venue ? venue : null;
    } catch {
      return null;
    }
  },
});

export const getAll = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("venues")
      .order("desc")
      .take(limit);
  },
});

export const search = query({
  args: { 
    query: v.string(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    // Simple text search for venues
    const venues = await ctx.db
      .query("venues")
      .take(100);
    
    return venues
      .filter(venue => 
        venue.name.toLowerCase().includes(args.query.toLowerCase()) ||
        venue.city.toLowerCase().includes(args.query.toLowerCase())
      )
      .slice(0, limit);
  },
});

export const getByLocation = query({
  args: { 
    city: v.string(),
    country: v.string(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("venues")
      .withIndex("by_location", (q) => q.eq("city", args.city).eq("country", args.country))
      .take(limit);
  },
});

export const getByTicketmasterIdInternal = internalQuery({
  args: { ticketmasterId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("venues")
      .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", args.ticketmasterId))
      .first();
  },
});

export const getByIdInternal = internalQuery({
  args: { id: v.id("venues") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createInternal = internalMutation({
  args: {
    name: v.string(),
    city: v.string(),
    state: v.optional(v.string()),
    country: v.string(),
    address: v.optional(v.string()),
    capacity: v.optional(v.number()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    ticketmasterId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slug = await uniqueVenueSlug(ctx, args);
    return await ctx.db.insert("venues", { ...args, slug, lastSynced: Date.now() });
  },
});

export const createFromTicketmaster = internalMutation({
  args: {
    ticketmasterId: v.optional(v.string()),
    name: v.string(),
    city: v.string(),
    state: v.optional(v.string()),
    country: v.string(),
    address: v.optional(v.string()),
    capacity: v.optional(v.number()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    postalCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check by Ticketmaster ID first
    if (args.ticketmasterId) {
      const existing = await ctx.db
        .query("venues")
        .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", args.ticketmasterId))
        .first();

      if (existing) {
        const patch: Record<string, unknown> = {};
        if (!existing.slug) patch.slug = await uniqueVenueSlug(ctx, args, existing._id);
        if (args.address && args.address !== existing.address) patch.address = args.address;
        if (args.state && args.state !== existing.state) patch.state = args.state;
        if (args.country && args.country !== existing.country) patch.country = args.country;
        if (args.capacity !== undefined && args.capacity !== existing.capacity) patch.capacity = args.capacity;
        if (args.lat !== undefined && args.lat !== existing.lat) patch.lat = args.lat;
        if (args.lng !== undefined && args.lng !== existing.lng) patch.lng = args.lng;
        if (args.postalCode && args.postalCode !== existing.postalCode) patch.postalCode = args.postalCode;
        patch.lastSynced = Date.now();
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(existing._id, patch);
        }
        return existing._id;
      }
    }

    // CRITICAL FIX: Fallback to name+city to prevent duplicates
    const existingByLocationCandidates = await ctx.db
      .query("venues")
      .withIndex("by_name_city", (q) => q.eq("name", args.name).eq("city", args.city))
      .collect();
    const matchingVenues = existingByLocationCandidates.filter(venue =>
      countryKey(venue.country) === countryKey(args.country) &&
      (!venue.state || !args.state || normalizeMusicName(venue.state) === normalizeMusicName(args.state)) &&
      (!venue.ticketmasterId || !args.ticketmasterId || venue.ticketmasterId === args.ticketmasterId));
    const existingByLocation = matchingVenues.length === 1 ? matchingVenues[0] : null;

    if (existingByLocation) {
      const patch: Record<string, unknown> = {};
      if (!existingByLocation.slug) patch.slug = await uniqueVenueSlug(ctx, args, existingByLocation._id);
      if (args.ticketmasterId && !existingByLocation.ticketmasterId) patch.ticketmasterId = args.ticketmasterId;
      if (args.address && args.address !== existingByLocation.address) patch.address = args.address;
      if (args.state && args.state !== existingByLocation.state) patch.state = args.state;
      if (args.country && args.country !== existingByLocation.country) patch.country = args.country;
      if (args.capacity !== undefined && args.capacity !== existingByLocation.capacity) patch.capacity = args.capacity;
      if (args.lat !== undefined && args.lat !== existingByLocation.lat) patch.lat = args.lat;
      if (args.lng !== undefined && args.lng !== existingByLocation.lng) patch.lng = args.lng;
      if (args.postalCode && args.postalCode !== existingByLocation.postalCode) patch.postalCode = args.postalCode;
      patch.lastSynced = Date.now();
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existingByLocation._id, patch);
      }
      return existingByLocation._id;
    }

    // Create new venue with all fields including postalCode
    return await ctx.db.insert("venues", {
      slug: await uniqueVenueSlug(ctx, args),
      name: args.name,
      city: args.city,
      state: args.state,
      country: args.country,
      address: args.address,
      capacity: args.capacity,
      lat: args.lat,
      lng: args.lng,
      ticketmasterId: args.ticketmasterId,
      postalCode: args.postalCode,
      lastSynced: Date.now(),
    });
  },
});

export const backfillMissingSlugs = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ scanned: v.number(), updated: v.number(), remaining: v.boolean() }),
  handler: async (ctx, args) => {
    // Bounded and index-backed; once migration is complete this becomes one
    // empty index read. New imports always write slugs at creation time.
    const limit = Math.max(1, Math.min(args.limit ?? 100, 250));
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_slug", (q) => q.eq("slug", undefined))
      .take(limit);
    let updated = 0;
    for (const venue of venues) {
      if (venue.slug) continue;
      const slug = await uniqueVenueSlug(ctx, venue, venue._id);
      await ctx.db.patch(venue._id, { slug });
      updated += 1;
    }
    const nextMissing = await ctx.db
      .query("venues")
      .withIndex("by_slug", (q) => q.eq("slug", undefined))
      .first();
    return { scanned: venues.length, updated, remaining: Boolean(nextMissing) };
  },
});

export const getAllSlugs = internalQuery({
  args: {},
  returns: v.array(v.object({ slug: v.string(), lastmod: v.number() })),
  handler: async (ctx) => {
    const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_date", (q) => q.gte("date", cutoff))
      .take(4000);
    const relevantShows = shows.filter(
      (show) =>
        show.status === "upcoming" ||
        (show.status === "completed" && Boolean(show.setlistfmId)),
    );
    const venueIds = [...new Set(relevantShows.map((show) => String(show.venueId)))].slice(0, 1500);
    const result: { slug: string; lastmod: number }[] = [];
    for (const id of venueIds) {
      const venue = await ctx.db.get(id as Id<"venues">);
      if (!venue?.slug) continue;
      result.push({ slug: venue.slug, lastmod: venue.lastSynced ?? venue._creationTime });
    }
    return result;
  },
});

export function countryKey(country: string) {
  const key = normalizeMusicName(country);
  if (["us", "usa", "united states", "united states of america"].includes(key)) return "us";
  if (["uk", "gb", "united kingdom", "great britain"].includes(key)) return "gb";
  return key;
}
