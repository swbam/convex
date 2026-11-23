import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { matchesFestivalEvent } from "./lib/festivalIdentity";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = require("./_generated/api").internal as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apiRef = require("./_generated/api").api as any;

const MINUTE = 60_000;

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

function isProbablyFestivalName(name: string): boolean {
  const n = normalizeName(name);
  if (!n) return true;
  // Avoid importing the festival itself or other non-artist tokens.
  if (/\bfestival\b|\bfest\b/.test(n)) return true;
  if (n === "tba" || n === "tbd") return true;
  return false;
}

async function requireAdminForAction(ctx: any): Promise<void> {
  const isAdmin: boolean = await ctx.runQuery(internalRef.admin.checkAdminInternal, {});
  if (!isAdmin) throw new Error("Admin access required");
}

export const getExistingFestivalArtistIdsInternal = internalQuery({
  args: { festivalId: v.id("festivals") },
  returns: v.array(v.id("artists")),
  handler: async (ctx, args) => {
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_festival", (q) => q.eq("festivalId", args.festivalId))
      .collect();
    const ids = new Set<Id<"artists">>();
    for (const s of shows) {
      ids.add(s.artistId);
    }
    return Array.from(ids);
  },
});

export const findArtistByLowerNameInternal = internalQuery({
  args: { lowerName: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const matches = await ctx.db.query("artists")
      .withIndex("by_lower_name", q => q.eq("lowerName", args.lowerName)).take(2);
    return matches.length === 1 ? matches[0] : null;
  },
});

export const createFestivalLineupImportJobInternal = internalMutation({
  args: {
    festivalId: v.id("festivals"),
    totalItems: v.number(),
    source: v.string(),
  },
  returns: v.id("syncJobs"),
  handler: async (ctx, args) => {
    const running = await ctx.db.query("syncJobs").withIndex("by_type_and_status", q =>
      q.eq("type", "festival_lineup_import").eq("status", "running")).collect();
    for (const job of running.filter(j => j.entityId === args.festivalId)) {
      if ((job.startedAt ?? job._creationTime) > Date.now() - 30 * MINUTE) {
        throw new Error("A lineup import is already running for this festival");
      }
      await ctx.db.patch(job._id, { status: "failed", completedAt: Date.now(), errorMessage: "Import timed out before completion" });
    }
    const jobId = await ctx.db.insert("syncJobs", {
      type: "festival_lineup_import" as any,
      entityId: args.festivalId,
      priority: 8,
      status: args.totalItems > 0 ? "running" : "failed",
      retryCount: 0,
      maxRetries: 0,
      startedAt: Date.now(),
      completedAt: args.totalItems > 0 ? undefined : Date.now(),
      errorMessage: args.totalItems > 0 ? undefined : "No matching lineup found for this edition",
      currentPhase: args.totalItems > 0 ? `starting (${args.source})` : "no matching source for this edition",
      totalSteps: 3,
      completedSteps: 0,
      currentStep: args.totalItems > 0 ? "starting" : "awaiting lineup source",
      itemsProcessed: 0,
      totalItems: args.totalItems,
      progressPercentage: 0,
    });

    return jobId;
  },
});

export const patchJobInternal = internalMutation({
  args: {
    jobId: v.id("syncJobs"),
    patch: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "running") return null;
    const patch = { ...args.patch };
    if (Array.isArray(patch.failedItems)) patch.failedItems = [...new Set([...(job.failedItems ?? []), ...patch.failedItems])].slice(0, 100);
    if (patch.status === "completed" && job.errorMessage) patch.status = "failed";
    await ctx.db.patch(args.jobId, patch);
    return null;
  },
});

export const startFestivalLineupImport = action({
  args: {
    festivalId: v.id("festivals"),
    batchSize: v.optional(v.number()),
    preferSource: v.optional(v.union(v.literal("ticketmaster"), v.literal("wiki"))),
  },
  returns: v.object({ jobId: v.id("syncJobs"), total: v.number(), source: v.string() }),
  handler: async (ctx, args) => {
    await requireAdminForAction(ctx);
    return await runLineupImport(ctx, args);
  },
});

// Internal version for cron jobs (no admin check)
export const startFestivalLineupImportInternal = internalAction({
  args: {
    festivalId: v.id("festivals"),
    batchSize: v.optional(v.number()),
    preferSource: v.optional(v.union(v.literal("ticketmaster"), v.literal("wiki"))),
  },
  returns: v.object({ jobId: v.id("syncJobs"), total: v.number(), source: v.string() }),
  handler: async (ctx, args) => {
    return await runLineupImport(ctx, args);
  },
});

// Shared implementation for lineup import
async function runLineupImport(
  ctx: any,
  args: {
    festivalId: Id<"festivals">;
    batchSize?: number;
    preferSource?: "ticketmaster" | "wiki";
  }
): Promise<{ jobId: Id<"syncJobs">; total: number; source: string }> {
  const festival: any = await ctx.runQuery(internalRef.festivals.getById, { festivalId: args.festivalId });
  if (!festival) throw new Error("Festival not found");

  const saved: any[] = await ctx.runQuery(internalRef.festivalLineupImport.getRosterInternal, { festivalId: args.festivalId });
  const ticketmasterNames = festival.lineupStatus === "verified" ? [] : await fetchLineupFromTicketmaster(festival);
  const wikiNames = festival.lineupStatus === "verified" || !festival.wikiUrl ? [] : await fetchLineupFromWikipedia(ctx, festival);
  const chosen = { source: festival.lineupStatus === "verified" ? festival.lineupSource || "official" : wikiNames.length ? "ticketmaster+wiki" : ticketmasterNames.length ? "ticketmaster" : festival.lineupSource || "saved roster",
    names: [...saved.map(e => e.name), ...ticketmasterNames, ...wikiNames] };
  const deduped = dedupeNames(chosen.names);
  if (deduped.length && festival.lineupStatus !== "verified") await ctx.runMutation(internalRef.festivalRoster.storeInternal, {
    festivalId: festival._id, entries: deduped.map(name => ({ name })), source: chosen.source,
    sourceUrl: wikiNames.length ? festival.wikiUrl : festival.lineupSourceUrl, year: festival.year,
  });
  const batchSize = Math.max(1, Math.min(25, args.batchSize ?? 10));

  console.log(`🎪 Starting lineup import for ${festival.name}: ${deduped.length} artists from ${chosen.source}`);

  const jobId: Id<"syncJobs"> = await ctx.runMutation(
    internalRef.festivalLineupImport.createFestivalLineupImportJobInternal,
    {
      festivalId: args.festivalId,
      totalItems: deduped.length,
      source: chosen.source,
    },
  );

  if (deduped.length === 0) return { jobId, total: 0, source: chosen.source };

  // Await durable scheduling before reporting a running import.
  await ctx.scheduler.runAfter(0, internalRef.festivalLineupImport.processFestivalLineupBatch, {
    jobId,
    festivalId: args.festivalId,
    names: deduped,
    cursor: 0,
    batchSize,
  });

  return { jobId, total: deduped.length, source: chosen.source };
}

export const processFestivalLineupBatch = internalAction({
  args: {
    jobId: v.id("syncJobs"),
    festivalId: v.id("festivals"),
    names: v.array(v.string()),
    cursor: v.number(),
    batchSize: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internalRef.festivalLineupImport.getJobInternal, { jobId: args.jobId });
    if (!job || job.status !== "running" || (job.itemsProcessed ?? 0) > args.cursor) return null;
    const lockName = `festival_lineup_import:${args.festivalId}`;
    const acquired: boolean = await ctx.runMutation(internalRef.maintenance.acquireLock, {
      name: lockName,
      staleMs: 10 * MINUTE,
    });
    if (!acquired) {
      await ctx.scheduler.runAfter(5000, internalRef.festivalLineupImport.processFestivalLineupBatch, args);
      return null;
    }

    try {
      const total = args.names.length;
      const end = Math.min(total, args.cursor + args.batchSize);
      const batch = args.names.slice(args.cursor, end);
      let processed = 0;
      let linked = 0;
      let imported = 0;
      let skipped = 0;
      let failed = 0;
      const failedItems: string[] = [];

      for (const rawName of batch) {
        processed++;
        const name = rawName.trim();
        const lower = normalizeName(name);
        if (!lower || isProbablyFestivalName(lower)) {
          skipped++;
          continue;
        }

        try {
          const existingArtist: any = await ctx.runQuery(
            internalRef.festivalLineupImport.findArtistByLowerNameInternal,
            { lowerName: lower },
          );

          let artistId: Id<"artists"> | undefined;
          if (existingArtist?._id) {
            artistId = existingArtist._id as Id<"artists">;
            console.log(`   ✓ Found existing artist: ${name}`);
          } else {
            // Ticketmaster-first resolution.
            console.log(`   🔍 Searching Ticketmaster for: ${name}`);
            const searchResults: any[] = await ctx.runAction(apiRef.ticketmaster.searchArtists, {
              query: name,
              limit: 3, // Fetch more results to improve matching
            });
            
            // Find best match - prefer exact name match
            const exactMatches = searchResults.filter(r => normalizeName(r.name || "") === lower);
            const top = exactMatches.length === 1 ? exactMatches[0] : null;
            
            if (!top?.ticketmasterId) {
              console.log(`   ⚠️ No Ticketmaster match for: ${name}`);
              failed++;
              failedItems.push(name);
              continue;
            }

            console.log(`   📥 Importing artist: ${top.name} (TM: ${top.ticketmasterId})`);
            artistId = await ctx.runMutation(internalRef.artists.createFromTicketmaster, {
              ticketmasterId: String(top.ticketmasterId), name: String(top.name || name),
              genres: Array.isArray(top.genres) ? top.genres : [], images: Array.isArray(top.images) ? top.images : [],
              upcomingEvents: typeof top.upcomingEvents === "number" ? top.upcomingEvents : 0,
            }) || undefined;
            if (!artistId) { failed++; failedItems.push(name); continue; }

            imported++;
            console.log(`   ✓ Imported new artist: ${name} (ID: ${artistId})`);
          }

          if (artistId) {
            await ctx.runMutation(internalRef.festivalRoster.linkArtist, { festivalId: args.festivalId, name, artistId });
            linked++;
          }
        } catch (e) {
          failed++;
          failedItems.push(name);
          console.error(`❌ Festival lineup import failed for ${name}:`, e);
        }
      }

      const newCursor = end;
      const progress = total === 0 ? 100 : Math.floor((newCursor / total) * 100);

      await ctx.runMutation(internalRef.festivalLineupImport.patchJobInternal, {
        jobId: args.jobId,
        patch: {
          currentPhase: "importing",
          currentStep: `processed ${newCursor}/${total}`,
          itemsProcessed: newCursor,
          progressPercentage: progress,
          ...(failed > 0 ? { errorMessage: "One or more lineup artists failed to import; retry required", failedItems } : {}),
          // Store lightweight batch stats in errorMessage if helpful, but avoid overwriting real errors.
        },
      });

      if (newCursor < total) {
        // Small delay between batches to avoid TM rate limit bursts.
        await ctx.scheduler.runAfter(1500, internalRef.festivalLineupImport.processFestivalLineupBatch, {
          jobId: args.jobId,
          festivalId: args.festivalId,
          names: args.names,
          cursor: newCursor,
          batchSize: args.batchSize,
        });
      } else {
        await ctx.runMutation(internalRef.festivalLineupImport.patchJobInternal, {
          jobId: args.jobId,
          patch: {
            status: "completed",
            completedAt: Date.now(),
            currentPhase: "completed",
            completedSteps: 3,
            progressPercentage: 100,
          },
        });
      }

      // Attach batch-level stats to cronRuns (if orchestrated) via console only; detailed stats
      // can be added later via a dedicated job table if needed.
      console.log(
        `🎪 Festival lineup batch done: processed=${processed} linked=${linked} imported=${imported} skipped=${skipped} failed=${failed} cursor=${newCursor}/${total}`,
      );

      return null;
    } catch (error) {
      await ctx.runMutation(internalRef.festivalLineupImport.patchJobInternal, {
        jobId: args.jobId, patch: { status: "failed", completedAt: Date.now(), errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Lineup import failed" },
      });
      throw error;
    } finally {
      await ctx.runMutation(internalRef.maintenance.releaseLock, { name: lockName });
    }
  },
});

function dedupeNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const trimmed = (n || "").toString().trim();
    const key = normalizeName(trimmed);
    if (!key) continue;
    if (seen.has(key)) continue;
    if (isProbablyFestivalName(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

async function fetchLineupFromWikipedia(ctx: any, festival: any): Promise<string[]> {
  if (!festival?.wikiUrl) return [];
  try {
    const res: any = await ctx.runAction(internalRef.festivalBootstrap.scrapeFestivalLineup, {
      wikiUrl: festival.wikiUrl,
      year: festival.year,
      festivalName: festival.name,
    });
    if (!res?.success) return [];
    return Array.isArray(res.artists) ? res.artists : [];
  } catch (e) {
    console.warn("Wikipedia lineup scrape failed", e);
    return [];
  }
}

/**
 * Fetch lineup from Ticketmaster API with improved query strategies:
 * 1. Try multiple keyword variations (with/without year, festival suffix)
 * 2. Paginate through ALL results (not just first 200)
 * 3. Aggregate artists from all multi-day events
 * 4. Fall back to venue + date range search if keyword fails
 */
async function fetchLineupFromTicketmaster(festival: any): Promise<string[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ TICKETMASTER_API_KEY not configured for festival lineup fetch");
    return [];
  }

  const startDate = String(festival.startDate || "").slice(0, 10);
  const endDate = String(festival.endDate || "").slice(0, 10);
  const festivalName = String(festival.name || "");
  const location = String(festival.location || "");

  // Generate multiple keyword variations to maximize matches
  const keywordVariations = generateKeywordVariations(festivalName);
  
  console.log(`🎪 Fetching Ticketmaster lineup for: ${festivalName}`);
  console.log(`   Date range: ${startDate} to ${endDate}`);
  console.log(`   Keywords to try: ${keywordVariations.join(", ")}`);

  const allNames: string[] = [];
  const seenEventIds = new Set<string>();

  // Strategy 1: Try each keyword variation
  for (const keyword of keywordVariations) {
    const names = await fetchEventsWithKeyword(
      apiKey,
      keyword,
      startDate,
      endDate,
      seenEventIds,
      festival
    );
    allNames.push(...names);
    

  }

  // Strategy 2: If keyword search failed, try venue-based search
  if (allNames.length < 10 && location) {
    console.log(`   Keyword search found only ${allNames.length} artists, trying venue search...`);
    const venueNames = await fetchEventsNearVenue(
      apiKey,
      location,
      startDate,
      endDate,
      festivalName,
      seenEventIds
    );
    allNames.push(...venueNames);
  }

  console.log(`   Total artists found from Ticketmaster: ${allNames.length}`);
  return allNames;
}

/**
 * Generate keyword variations for festival search
 */
function generateKeywordVariations(festivalName: string): string[] {
  const variations: string[] = [];
  const name = festivalName.trim();
  
  // Original name
  if (name) variations.push(name);
  
  // Without year suffix
  const withoutYear = name.replace(/\s*\b20\d{2}\b\s*/g, " ").trim();
  if (withoutYear && withoutYear !== name) {
    variations.push(withoutYear);
  }
  
  // Without "Festival" suffix
  const withoutFestival = withoutYear
    .replace(/\s*(music\s+)?festival\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutFestival && !variations.includes(withoutFestival)) {
    variations.push(withoutFestival);
  }
  
  // Just the core name (first word or two for common festivals)
  const words = withoutFestival.split(/\s+/);
  if (words.length > 1) {
    const coreNames = [
      words[0], // "Stagecoach"
      words.slice(0, 2).join(" "), // "Electric Daisy"
    ];
    for (const core of coreNames) {
      if (core.length >= 4 && !variations.includes(core)) {
        variations.push(core);
      }
    }
  }
  
  return variations.filter(v => v.length >= 3);
}

/**
 * Fetch events from Ticketmaster with pagination
 */
async function fetchEventsWithKeyword(
  apiKey: string,
  keyword: string,
  startDate: string,
  endDate: string,
  seenEventIds: Set<string>,
  festival: any
): Promise<string[]> {
  const names: string[] = [];
  const base = "https://app.ticketmaster.com/discovery/v2/events.json";
  
  let page = 0;
  const maxPages = 5; // Limit to prevent runaway pagination
  
  while (page < maxPages) {
    const params = new URLSearchParams({
      apikey: apiKey,
      keyword: keyword,
      segmentId: "KZFzniwnSyZfZ7v7nJ", // Music segment
      countryCode: "US",
      size: "200",
      page: String(page),
      sort: "relevance,desc",
    });

    if (startDate) params.set("startDateTime", `${startDate}T00:00:00Z`);
    if (endDate) params.set("endDateTime", `${endDate}T23:59:59Z`);

    const url = `${base}?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`   Ticketmaster API error for "${keyword}" page ${page}: ${response.status}`);
        break;
      }
      
      const data: any = await response.json();
      const events: any[] = data?._embedded?.events || [];
      
      if (events.length === 0) break;

      for (const event of events) {
        if (!matchesFestivalEvent(festival, event)) continue;
        // Skip if we've already processed this event
        const eventId = event.id;
        if (eventId && seenEventIds.has(eventId)) continue;
        if (eventId) seenEventIds.add(eventId);
        
        // Extract attractions (artists) from the event
        const attractions: any[] = event?._embedded?.attractions || [];
        for (const a of attractions) {
          const n = String(a?.name || "").trim();
          if (!n) continue;
          if (isProbablyFestivalName(n)) continue;
          names.push(n);
        }
      }

      // Check if there are more pages
      const totalPages = data?.page?.totalPages || 1;
      page++;
      
      if (page >= totalPages) break;
      
      // Rate limiting delay between pages
      await new Promise(r => setTimeout(r, 300));
      
    } catch (e) {
      console.warn(`   Ticketmaster fetch failed for "${keyword}" page ${page}:`, e);
      break;
    }
  }

  return names;
}

/**
 * Fallback: Search for events near a venue location during festival dates
 */
async function fetchEventsNearVenue(
  apiKey: string,
  location: string,
  startDate: string,
  endDate: string,
  festivalName: string,
  seenEventIds: Set<string>
): Promise<string[]> {
  const names: string[] = [];
  
  // Extract city from location (e.g., "Indio, CA" -> "Indio")
  const city = location.split(",")[0]?.trim();
  if (!city) return names;
  
  // Search for events in the city during the festival dates
  const base = "https://app.ticketmaster.com/discovery/v2/events.json";
  const params = new URLSearchParams({
    apikey: apiKey,
    city: city,
    segmentId: "KZFzniwnSyZfZ7v7nJ", // Music segment
    countryCode: "US",
    size: "200",
    sort: "date,asc",
  });

  if (startDate) params.set("startDateTime", `${startDate}T00:00:00Z`);
  if (endDate) params.set("endDateTime", `${endDate}T23:59:59Z`);

  const url = `${base}?${params.toString()}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return names;
    
    const data: any = await response.json();
    const events: any[] = data?._embedded?.events || [];
    
    // Filter events that look like they're part of the festival

    
    for (const event of events) {
      const eventId = event.id;
      if (eventId && seenEventIds.has(eventId)) continue;
      
      const eventName = String(event.name || "").toLowerCase();
      
      // Check if event name contains festival keywords
      const isRelated = matchesFestivalEvent({ name: festivalName, location, startDate, endDate }, event);
      if (!isRelated) continue;
      
      if (eventId) seenEventIds.add(eventId);
      
      const attractions: any[] = event?._embedded?.attractions || [];
      for (const a of attractions) {
        const n = String(a?.name || "").trim();
        if (!n) continue;
        if (isProbablyFestivalName(n)) continue;
        names.push(n);
      }
    }
    
  } catch (e) {
    console.warn(`   Venue-based search failed for ${city}:`, e);
  }

  return names;
}

export const getJobInternal = internalQuery({
  args: { jobId: v.id("syncJobs") }, handler: (ctx, args) => ctx.db.get(args.jobId),
});

export const expireStalledJobs = internalMutation({
  args: {},
  handler: async ctx => {
    const jobs = await ctx.db.query("syncJobs").withIndex("by_type_and_status", q =>
      q.eq("type", "festival_lineup_import").eq("status", "running")).take(500);
    let expired = 0;
    for (const job of jobs) {
      if ((job.startedAt ?? job._creationTime) >= Date.now() - 30 * MINUTE) continue;
      await ctx.db.patch(job._id, { status: "failed", completedAt: Date.now(), errorMessage: "Stalled import: no completed continuation; restart against the correct edition" });
      expired++;
    }
    return { expired };
  },
});

export const getRosterInternal = internalQuery({ args: { festivalId: v.id("festivals") }, handler: async (ctx, a) => ctx.db.query("festivalLineupEntries").withIndex("by_festival", q => q.eq("festivalId", a.festivalId)).take(600) });
