import { internalMutation, internalAction } from "./_generated/server";
import { refreshLinkedTickets } from "./lib/ticketInfo";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internalRef } from "./adminHelpers";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any


import { isConcertDiscoveryCandidate as isRealConcert } from "./lib/attractionIdentity";

/**
 * SIMPLE, ATOMIC APPROACH: Import trending shows in a single mutation
 * No complex action/query chains - just pure mutation logic
 */

export const importTrendingShowsBatch = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    imported: v.number(),
    skipped: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(100, Math.trunc(args.limit ?? 50)));
    const stats = {
      processed: 0,
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Get all trending shows from cache
    const cachedShows = await ctx.db
      .query("trendingShows")
      .take(limit);

    for (const cached of cachedShows) {
      stats.processed++;

      try {
        if (cached.showId) {
          const linked = await ctx.db.get(cached.showId);
          if (linked?.ticketmasterId === cached.ticketmasterId) {
            // Never overwrite a more recent canonical provider update with old cache data.
            if (!linked.ticketInfo || (linked.lastSynced ?? 0) <= cached.lastUpdated) {
              await refreshLinkedTickets(ctx, linked, cached);
            }
            stats.skipped++;
            continue;
          }
        }

        // Validate required fields
        if (!cached.artistName || !cached.venueName || !cached.date) {
          stats.errors.push(`Missing data: ${cached.ticketmasterId}`);
          continue;
        }

        // CRITICAL: US-only filter - skip non-US shows
        const country = (cached.venueCountry || '').toLowerCase();
        const isUS = country === 'united states of america' ||
          country === 'united states' ||
          country === 'usa' ||
          country === 'us';
        if (!isUS) {
          stats.skipped++;
          continue;
        }

        // CRITICAL: Concert-only filter - skip non-concert events
        if (!isRealConcert(cached.artistName)) {
          stats.skipped++;
          continue;
        }

        // STEP 1: Get or create artist
        let artistId: Id<"artists"> | null = null;

        // Try by Ticketmaster ID first
        if (cached.artistTicketmasterId) {
          const existingArtist = await ctx.db
            .query("artists")
            .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", cached.artistTicketmasterId!))
            .first();

          if (existingArtist) {
            artistId = existingArtist._id;
          }
        }

        // Try by name if no Ticketmaster ID match
        if (!artistId) {
          const lowerName = cached.artistName.toLowerCase();
          const existingByName = await ctx.db
            .query("artists")
            .withIndex("by_lower_name", (q) => q.eq("lowerName", lowerName))
            .first();

          if (existingByName) {
            artistId = existingByName._id;
            // Update with Ticketmaster ID if we have it
            if (cached.artistTicketmasterId && !existingByName.ticketmasterId) {
              await ctx.db.patch(artistId, {
                ticketmasterId: cached.artistTicketmasterId,
              });
            }
          }
        }

        // Create artist if still not found
        if (!artistId) {
          const slug = cached.artistName.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 100);

          artistId = await ctx.db.insert("artists", {
            slug,
            name: cached.artistName,
            ticketmasterId: cached.artistTicketmasterId,
            lowerName: cached.artistName.toLowerCase(),
            genres: [],
            images: cached.artistImage ? [cached.artistImage] : [],
            isActive: true,
            popularity: 0,
            followers: 0,
            trendingScore: 0,
            trendingRank: 0,
            upcomingShowsCount: 0,
            lastSynced: Date.now(),
            lastTrendingUpdate: Date.now(),
          });
        }

        // STEP 2: Get or create venue
        let venueId: Id<"venues"> | null = null;

        const existingVenue = await ctx.db
          .query("venues")
          .withIndex("by_name_city", (q) => q.eq("name", cached.venueName).eq("city", cached.venueCity))
          .first();

        if (existingVenue) {
          venueId = existingVenue._id;
        } else {
          venueId = await ctx.db.insert("venues", {
            name: cached.venueName,
            city: cached.venueCity,
            country: cached.venueCountry,
          });
        }

        // STEP 3: Create or update show
        const existingShow = await ctx.db
          .query("shows")
          .withIndex("by_ticketmaster_id", (q) => q.eq("ticketmasterId", cached.ticketmasterId))
          .first();

        let showId: Id<"shows">;

        if (existingShow) {
          showId = existingShow._id;
          if (!existingShow.ticketInfo || (existingShow.lastSynced ?? 0) <= cached.lastUpdated) {
            await refreshLinkedTickets(ctx, existingShow, cached);
          }
        } else {
          // Generate slug
          const artist = await ctx.db.get(artistId);
          const venue = await ctx.db.get(venueId);
          if (!artist || !venue) throw new Error("Artist/venue not found after creation");

          const slug = `${artist.slug}-${venue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${venue.city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${cached.date}${cached.startTime ? '-' + cached.startTime.replace(/:/g, '-') : ''}`.substring(0, 200);

          showId = await ctx.db.insert("shows", {
            slug,
            artistId,
            venueId,
            date: cached.date,
            startTime: cached.startTime, startsAt: cached.startsAt, endsAt: cached.endsAt, timeZone: cached.timeZone,
            status: (cached.status || '').toLowerCase().includes('cancel') ? 'cancelled' as const : 'upcoming' as const,
            ticketmasterId: cached.ticketmasterId,
            ticketUrl: cached.ticketUrl,
            ticketInfo: cached.ticketInfo,
            priceRange: cached.priceRange,
            voteCount: 0,
            setlistCount: 0,
            trendingScore: 0,
            trendingRank: 0,
            lastSynced: Date.now(),
            lastTrendingUpdate: Date.now(),
          });
        }

        // STEP 4: Link cache to show
        await ctx.db.patch(cached._id, {
          showId,
          artistId,
        });

        stats.imported++;

      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        stats.errors.push(`${cached.artistName}: ${msg}`);
      }
    }

    return stats;
  },
});

// Maintenance CLI trigger
export const runImport = internalAction({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    processed: v.number(),
    imported: v.number(),
    skipped: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args): Promise<{ processed: number; imported: number; skipped: number; errors: string[] }> => {
    return await ctx.runMutation(internalRef.importTrendingShows.importTrendingShowsBatch, {
      limit: args.limit ?? 50,
    });
  },
});

