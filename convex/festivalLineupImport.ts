import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apiRef = api as any;

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
    return await ctx.db
      .query("artists")
      .withIndex("by_lower_name", (q) => q.eq("lowerName", args.lowerName))
      .first();
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
    const jobId = await ctx.db.insert("syncJobs", {
      type: "festival_lineup_import" as any,
      entityId: args.festivalId,
      priority: 8,
      status: "running",
      retryCount: 0,
      maxRetries: 0,
      startedAt: Date.now(),
      completedAt: undefined,
      errorMessage: undefined,
      currentPhase: `starting (${args.source})`,
      totalSteps: 3,
      completedSteps: 0,
      currentStep: "starting",
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
    await ctx.db.patch(args.jobId, args.patch);
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

    const festival: any = await ctx.runQuery(internalRef.festivals.getById, { festivalId: args.festivalId });
    if (!festival) throw new Error("Festival not found");

    const prefer = args.preferSource;

    const ticketmasterNames = prefer !== "wiki" ? await fetchLineupFromTicketmaster(festival) : [];
    const wikiNames = prefer !== "ticketmaster" && festival.wikiUrl
      ? await fetchLineupFromWikipedia(ctx, festival)
      : [];

    // Choose best source; fallback if TM is too thin.
    let chosen: { source: string; names: string[] };
    if (prefer === "ticketmaster") {
      chosen = { source: "ticketmaster", names: ticketmasterNames };
      if (chosen.names.length < 10 && wikiNames.length > 0) {
        chosen = { source: "wiki", names: wikiNames };
      }
    } else if (prefer === "wiki") {
      chosen = { source: "wiki", names: wikiNames };
      if (chosen.names.length < 10 && ticketmasterNames.length > 0) {
        chosen = { source: "ticketmaster", names: ticketmasterNames };
      }
    } else {
      chosen = ticketmasterNames.length >= 10 ? { source: "ticketmaster", names: ticketmasterNames } : { source: "wiki", names: wikiNames };
      if (chosen.names.length === 0 && ticketmasterNames.length > 0) {
        chosen = { source: "ticketmaster", names: ticketmasterNames };
      }
    }

    const deduped = dedupeNames(chosen.names);
    const batchSize = Math.max(1, Math.min(25, args.batchSize ?? 10));

    const jobId: Id<"syncJobs"> = await ctx.runMutation(
      internalRef.festivalLineupImport.createFestivalLineupImportJobInternal,
      {
        festivalId: args.festivalId,
        totalItems: deduped.length,
        source: chosen.source,
      },
    );

    // Kick off the first batch quickly.
    void ctx.scheduler.runAfter(0, internalRef.festivalLineupImport.processFestivalLineupBatch, {
      jobId,
      festivalId: args.festivalId,
      names: deduped,
      cursor: 0,
      batchSize,
    });

    return { jobId, total: deduped.length, source: chosen.source };
  },
});

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
    const lockName = `festival_lineup_import:${args.jobId}`;
    const acquired: boolean = await ctx.runMutation(internalRef.maintenance.acquireLock, {
      name: lockName,
      staleMs: 10 * MINUTE,
    });
    if (!acquired) return null;

    try {
      const existingArtistIds = new Set<Id<"artists">>(
        await ctx.runQuery(internalRef.festivalLineupImport.getExistingFestivalArtistIdsInternal, {
          festivalId: args.festivalId,
        }),
      );

      const total = args.names.length;
      const start = Math.max(0, args.cursor);
      const end = Math.min(total, start + Math.max(1, args.batchSize));
      const batch = args.names.slice(start, end);

      let processed = 0;
      let linked = 0;
      let imported = 0;
      let skipped = 0;
      let failed = 0;

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
          } else {
            // Ticketmaster-first resolution.
            const searchResults: any[] = await ctx.runAction(apiRef.ticketmaster.searchArtists, {
              query: name,
              limit: 1,
            });
            const top = Array.isArray(searchResults) ? searchResults[0] : null;
            if (!top?.ticketmasterId) {
              skipped++;
              continue;
            }

            const syncResult: any = await ctx.runAction(apiRef.ticketmaster.triggerFullArtistSync, {
              ticketmasterId: String(top.ticketmasterId),
              artistName: String(top.name || name),
              genres: Array.isArray(top.genres) ? top.genres : [],
              images: Array.isArray(top.images) ? top.images : [],
              upcomingEvents: typeof top.upcomingEvents === "number" ? top.upcomingEvents : 0,
            });

            if (syncResult?.type !== "artist" || !syncResult.artistId) {
              skipped++;
              continue;
            }

            artistId = syncResult.artistId as Id<"artists">;
            imported++;
          }

          if (artistId && !existingArtistIds.has(artistId)) {
            await ctx.runMutation(apiRef.festivals.addArtist, {
              festivalId: args.festivalId,
              artistId,
            });
            existingArtistIds.add(artistId);
            linked++;
          } else {
            skipped++;
          }
        } catch (e) {
          failed++;
          console.error(`Festival lineup import failed for ${name}:`, e);
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
          // Store lightweight batch stats in errorMessage if helpful, but avoid overwriting real errors.
        },
      });

      if (newCursor < total) {
        // Small delay between batches to avoid TM rate limit bursts.
        void ctx.scheduler.runAfter(1500, internalRef.festivalLineupImport.processFestivalLineupBatch, {
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

async function fetchLineupFromTicketmaster(festival: any): Promise<string[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return [];

  const startDate = String(festival.startDate || "").slice(0, 10);
  const endDate = String(festival.endDate || "").slice(0, 10);

  // Prefer a keyword without year suffix.
  const keyword = String(festival.name || "")
    .replace(/\b20\d{2}\b/g, "")
    .trim();

  const base = "https://app.ticketmaster.com/discovery/v2/events.json";
  const params = new URLSearchParams({
    apikey: apiKey,
    segmentId: "KZFzniwnSyZfZ7v7nJ",
    countryCode: "US",
    size: "200",
    sort: "relevance,desc",
  });

  if (keyword) params.set("keyword", keyword);
  if (startDate) params.set("startDateTime", `${startDate}T00:00:00Z`);
  if (endDate) params.set("endDateTime", `${endDate}T23:59:59Z`);

  const url = `${base}?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data: any = await response.json();
    const events: any[] = data?._embedded?.events || [];

    const names: string[] = [];
    for (const event of events) {
      const attractions: any[] = event?._embedded?.attractions || [];
      for (const a of attractions) {
        const n = String(a?.name || "").trim();
        if (!n) continue;
        if (isProbablyFestivalName(n)) continue;
        names.push(n);
      }
    }

    return names;
  } catch (e) {
    console.warn("Ticketmaster festival lineup fetch failed", e);
    return [];
  }
}

