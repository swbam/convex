import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internalRef } from "./adminHelpers";
import { Id } from "./_generated/dataModel";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any

const SETLISTFM_HTTP_TIMEOUT_MS = 30_000;

// Local fetch-with-timeout (mirrors setlistfm.ts helper)
async function historyFetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = SETLISTFM_HTTP_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function setlistfmHeaders(apiKey: string): Record<string, string> {
  return {
    "x-api-key": apiKey,
    Accept: "application/json",
    "User-Agent": "setlists.live/1.0",
  };
}

// Case- and diacritics-insensitive exact name match
function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Loose key for venue/city comparison: case/diacritics-insensitive, punctuation stripped.
function normalizeVenueKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// True when one normalized venue name contains the other (e.g. "Moody Center ATX"
// vs Ticketmaster's "Moody Center"). Requires the shorter name to be substantial
// so generic fragments don't cross-match.
function venueNamesLooselyMatch(a: string, b: string): boolean {
  const keyA = normalizeVenueKey(a);
  const keyB = normalizeVenueKey(b);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  const shorter = keyA.length <= keyB.length ? keyA : keyB;
  const longer = keyA.length <= keyB.length ? keyB : keyA;
  return shorter.length >= 4 && longer.includes(shorter);
}

// Replicated from shows.ts (createSEOSlug / createShowSlug are not exported)
function createSEOSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}

function createShowSlug(artistName: string, venueName: string, venueCity: string, date: string): string {
  // Format: artist-name-venue-name-city-yyyy-mm-dd (NO TIME IN URL)
  return `${createSEOSlug(artistName)}-${createSEOSlug(venueName)}-${createSEOSlug(venueCity)}-${date}`;
}

// setlist.fm eventDate is DD-MM-YYYY → convert to YYYY-MM-DD
function convertEventDate(eventDate: string | undefined): string | null {
  if (!eventDate) return null;
  const parts = eventDate.split("-");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (yyyy.length !== 4 || mm.length !== 2 || dd.length !== 2) return null;
  const iso = `${yyyy}-${mm}-${dd}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

type ParsedHistoricalSong = { title: string; setNumber: number; encore: boolean };

// Flatten setlist.fm sets.set[].song[] into actualSetlist entries
function parseSetlistSongs(entry: any): ParsedHistoricalSong[] {
  const sets = entry?.sets?.set;
  if (!Array.isArray(sets)) return [];
  const songs: ParsedHistoricalSong[] = [];
  let setNumber = 0;
  for (const set of sets) {
    setNumber += 1;
    const encore = Boolean(set?.encore);
    const setSongs = Array.isArray(set?.song) ? set.song : [];
    for (const song of setSongs) {
      const title = typeof song?.name === "string" ? song.name.trim() : "";
      if (!title) continue;
      songs.push({ title, setNumber, encore });
    }
  }
  return songs;
}

// Bounded pick of artists that never had a history sync, highest signal first.
export const getBackfillCandidates = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({ artistId: v.id("artists"), name: v.string() })),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 10, 50));
    // Missing timestamps stay at the front of this index. Reading a bounded
    // candidate window avoids rescanning every already-synced artist every 30m.
    const artists = await ctx.db
      .query("artists")
      .withIndex("by_setlistfm_history_sync", (q) =>
        q.eq("lastSetlistfmHistorySyncAt", undefined),
      )
      .take(250);
    return artists
      .filter((a) => a.lastSetlistfmHistorySyncAt === undefined && a.isActive !== false)
      .sort(
        (a, b) =>
          ((b.popularity ?? 0) + (b.trendingScore ?? 0)) -
          ((a.popularity ?? 0) + (a.trendingScore ?? 0)),
      )
      .slice(0, limit)
      .map((a) => ({ artistId: a._id, name: a.name }));
  },
});

export const recordHistorySync = internalMutation({
  args: {
    artistId: v.id("artists"),
    setlistfmMbid: v.optional(v.string()),
    lastSetlistfmHistorySyncAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const artist = await ctx.db.get(args.artistId);
    if (!artist) return null;
    const patch: Record<string, unknown> = {};
    if (args.setlistfmMbid && args.setlistfmMbid !== artist.setlistfmMbid) {
      patch.setlistfmMbid = args.setlistfmMbid;
    }
    if (args.lastSetlistfmHistorySyncAt !== undefined) {
      patch.lastSetlistfmHistorySyncAt = args.lastSetlistfmHistorySyncAt;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.artistId, patch);
    }
    return null;
  },
});

// One mutation per historical setlist: upsert venue → show → official setlist.
export const upsertHistoricalSetlist = internalMutation({
  args: {
    artistId: v.id("artists"),
    setlistfmId: v.string(),
    date: v.string(), // YYYY-MM-DD
    venueName: v.string(),
    venueCity: v.string(),
    venueState: v.optional(v.string()),
    venueCountry: v.optional(v.string()),
    songs: v.array(v.object({
      title: v.string(),
      setNumber: v.number(),
      encore: v.boolean(),
    })),
  },
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx, args) => {
    const now = Date.now();

    const artist = await ctx.db.get(args.artistId);
    if (!artist) {
      return { created: false };
    }

    // 1) Show: dedupe by setlistfmId first, then artist+date with a venue-city match.
    //    setlist.fm venue naming often differs from Ticketmaster's ("Moody Center ATX"
    //    vs "Moody Center"), so requiring the exact same venueId would create a
    //    duplicate completed show for the same concert. Same artist + same date +
    //    same city is treated as the same concert.
    let show = await ctx.db
      .query("shows")
      .withIndex("by_setlistfm_id", (q) => q.eq("setlistfmId", args.setlistfmId))
      .first();

    if (!show) {
      const sameDayShows = await ctx.db
        .query("shows")
        .withIndex("by_artist_and_date", (q) =>
          q.eq("artistId", args.artistId).eq("date", args.date),
        )
        .take(5);
      const wantedCity = normalizeVenueKey(args.venueCity);
      for (const candidate of sameDayShows) {
        const candidateVenue = await ctx.db.get(candidate.venueId);
        if (candidateVenue && normalizeVenueKey(candidateVenue.city) === wantedCity) {
          show = candidate;
          break;
        }
      }
    }

    let showId: Id<"shows">;
    if (show) {
      // Reuse the existing show (and its existing venue — don't re-point it).
      showId = show._id;
      const showPatch: Record<string, unknown> = {};
      if (show.setlistfmId !== args.setlistfmId) showPatch.setlistfmId = args.setlistfmId;
      if (show.status !== "completed") showPatch.status = "completed";
      if (show.importStatus !== "completed") showPatch.importStatus = "completed";
      if (Object.keys(showPatch).length > 0) {
        showPatch.lastSynced = now;
        await ctx.db.patch(showId, showPatch);
      }
    } else {
      // 2) Venue (only needed for a brand-new show): dedupe by exact name+city
      //    (mirrors venues.createFromTicketmaster fallback), then by a loose
      //    normalized-name match within the same city before inserting.
      let existingVenue = await ctx.db
        .query("venues")
        .withIndex("by_name_city", (q) => q.eq("name", args.venueName).eq("city", args.venueCity))
        .first();
      if (!existingVenue) {
        const cityVenues = await ctx.db
          .query("venues")
          .withIndex("by_location", (q) => q.eq("city", args.venueCity))
          .take(50);
        existingVenue = cityVenues.find((venue) => venueNamesLooselyMatch(venue.name, args.venueName)) ?? null;
      }

      let venueId: Id<"venues">;
      if (existingVenue) {
        venueId = existingVenue._id;
        if (args.venueState && !existingVenue.state) {
          await ctx.db.patch(venueId, { state: args.venueState });
        }
      } else {
        venueId = await ctx.db.insert("venues", {
          name: args.venueName,
          city: args.venueCity,
          state: args.venueState,
          country: args.venueCountry ?? "Unknown",
        });
      }

      const slug = createShowSlug(artist.name, args.venueName, args.venueCity, args.date);
      showId = await ctx.db.insert("shows", {
        artistId: args.artistId,
        venueId,
        date: args.date,
        status: "completed",
        importStatus: "completed",
        setlistfmId: args.setlistfmId,
        slug,
        voteCount: 0,
        setlistCount: 0,
        trendingScore: 0,
        trendingRank: 0,
        lastTrendingUpdate: now,
        lastSynced: now,
      });
    }

    // 3) Setlist: skip if actual data already present, else patch a non-user setlist, else insert.
    const setlistsForShow = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", showId))
      .take(25);

    const hasActual = setlistsForShow.some(
      (s) => Array.isArray(s.actualSetlist) && s.actualSetlist.length > 0,
    );
    if (hasActual) {
      return { created: false };
    }

    // Keep prediction and official docs separate (mirrors setlists.createFromApi /
    // updateWithActualSetlist): the fan-voted community prediction stays a
    // prediction — it gets the actual setlist attached and graded — and the
    // official setlist is patched or created alongside it.
    const predictionSetlist = setlistsForShow.find((s) => !s.isOfficial && !s.userId) ?? null;
    const officialSetlist = setlistsForShow.find((s) => s.isOfficial) ?? null;

    if (predictionSetlist) {
      const predictedTitles = (predictionSetlist.songs ?? [])
        .map((song) => song.title?.toLowerCase().trim())
        .filter((title): title is string => Boolean(title));
      let accuracy = 0;
      if (predictedTitles.length > 0) {
        const actualTitles = args.songs.map((s) => s.title.toLowerCase().trim());
        const correct = predictedTitles.filter((title) => actualTitles.includes(title)).length;
        const pct = Math.round((correct / predictedTitles.length) * 100);
        accuracy = Number.isFinite(pct) ? pct : 0;
      }
      await ctx.db.patch(predictionSetlist._id, {
        actualSetlist: args.songs,
        setlistfmId: args.setlistfmId,
        lastUpdated: now,
        accuracy,
        comparedAt: now,
      });
    }

    if (officialSetlist) {
      await ctx.db.patch(officialSetlist._id, {
        actualSetlist: args.songs,
        setlistfmId: args.setlistfmId,
        verified: true,
        source: "setlistfm" as const,
        lastUpdated: now,
      });
    } else {
      // Mirror the official-setlist shape written by setlists.saveActualSetlist
      await ctx.db.insert("setlists", {
        showId,
        userId: undefined,
        songs: [], // Empty predictions (this is the official setlist)
        actualSetlist: args.songs,
        verified: true,
        source: "setlistfm" as const,
        lastUpdated: now,
        isOfficial: true,
        confidence: 1.0,
        upvotes: 0,
        downvotes: 0,
        setlistfmId: args.setlistfmId,
      });
      const showDoc = await ctx.db.get(showId);
      await ctx.db.patch(showId, { setlistCount: (showDoc?.setlistCount ?? 0) + 1 });
    }

    return { created: true };
  },
});

// Import an artist's recent past setlists from setlist.fm so their Past tab has data.
// Skip re-imports when a sync happened recently — repeat searches/page views
// of the same artist must not burn setlist.fm API budget.
const HISTORY_FRESHNESS_MS = 6 * 60 * 60 * 1000;

export const importArtistHistory = internalAction({
  args: {
    artistId: v.id("artists"),
    limit: v.optional(v.number()),
    force: v.optional(v.boolean()),
  },
  returns: v.object({
    imported: v.number(),
    skipped: v.number(),
    artistName: v.optional(v.string()),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const apiKey = process.env.SETLISTFM_API_KEY;
    if (!apiKey) {
      console.warn("⚠️ setlistfmHistory: SETLISTFM_API_KEY not configured, skipping");
      return { imported: 0, skipped: 0, reason: "missing_api_key" };
    }

    const artist = await ctx.runQuery(internalRef.artists.getByIdInternal, { id: args.artistId });
    if (!artist) {
      return { imported: 0, skipped: 0, reason: "artist_not_found" };
    }

    if (
      !args.force &&
      typeof artist.lastSetlistfmHistorySyncAt === "number" &&
      Date.now() - artist.lastSetlistfmHistorySyncAt < HISTORY_FRESHNESS_MS
    ) {
      return { imported: 0, skipped: 0, artistName: artist.name, reason: "recently_synced" };
    }

    const url = artist.setlistfmMbid
      ? `https://api.setlist.fm/rest/1.0/artist/${encodeURIComponent(artist.setlistfmMbid)}/setlists?p=1`
      : `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(artist.name)}&p=1`;

    let response: Response;
    try {
      response = await historyFetchWithTimeout(url, { headers: setlistfmHeaders(apiKey) });
      if (response.status === 429) {
        // One gentle retry, then give up this run WITHOUT stamping the artist so backfill retries later.
        await new Promise((r) => setTimeout(r, 2000));
        response = await historyFetchWithTimeout(url, { headers: setlistfmHeaders(apiKey) });
        if (response.status === 429) {
          console.warn(`⏳ setlistfmHistory: rate limited for ${artist.name}, will retry in a later backfill`);
          return { imported: 0, skipped: 0, artistName: artist.name, reason: "rate_limited" };
        }
      }
    } catch (e) {
      console.error(`❌ setlistfmHistory: fetch failed for ${artist.name}:`, e);
      return { imported: 0, skipped: 0, artistName: artist.name, reason: "fetch_error" };
    }

    const now = Date.now();

    if (response.status === 404) {
      // setlist.fm has nothing for this artist — stamp so backfill moves on.
      await ctx.runMutation(internalRef.setlistfmHistory.recordHistorySync, {
        artistId: args.artistId,
        lastSetlistfmHistorySyncAt: now,
      });
      console.log(`ℹ️ setlistfmHistory: no setlists on setlist.fm for ${artist.name}`);
      return { imported: 0, skipped: 0, artistName: artist.name, reason: "not_found" };
    }

    if (!response.ok) {
      console.error(`❌ setlistfmHistory: API error ${response.status} for ${artist.name}`);
      if (response.status >= 400 && response.status < 500) {
        // Non-retryable client error — stamp so this artist doesn't poison the backfill batch.
        await ctx.runMutation(internalRef.setlistfmHistory.recordHistorySync, {
          artistId: args.artistId,
          lastSetlistfmHistorySyncAt: now,
        });
      }
      return { imported: 0, skipped: 0, artistName: artist.name, reason: `http_${response.status}` };
    }

    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      console.error(`❌ setlistfmHistory: invalid JSON for ${artist.name}:`, e);
      return { imported: 0, skipped: 0, artistName: artist.name, reason: "invalid_json" };
    }

    let entries: any[] = Array.isArray(data?.setlist) ? data.setlist : [];
    let learnedMbid: string | undefined;

    if (!artist.setlistfmMbid) {
      // Name search: only trust entries whose artist name is an exact normalized match.
      const wanted = normalizeArtistName(artist.name);
      entries = entries.filter(
        (entry) => normalizeArtistName(entry?.artist?.name ?? "") === wanted,
      );
      const mbid = entries[0]?.artist?.mbid;
      if (typeof mbid === "string" && mbid.length > 0) {
        learnedMbid = mbid;
      }
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const maxSetlists = Math.max(1, Math.min(args.limit ?? 15, 50));

    let imported = 0;
    let skipped = 0;
    let taken = 0;

    for (const entry of entries) {
      if (taken >= maxSetlists) break;

      const setlistfmId = typeof entry?.id === "string" ? entry.id : null;
      const date = convertEventDate(entry?.eventDate);
      const venueName = typeof entry?.venue?.name === "string" ? entry.venue.name.trim() : "";
      const venueCity = typeof entry?.venue?.city?.name === "string" ? entry.venue.city.name.trim() : "";
      if (!setlistfmId || !date || !venueName || !venueCity) continue;
      if (date > todayIso) continue; // skip future-dated entries

      const songs = parseSetlistSongs(entry);
      if (songs.length < 3) continue; // ignore sparse/empty setlists

      taken += 1;

      const result: { created: boolean } = await ctx.runMutation(
        internalRef.setlistfmHistory.upsertHistoricalSetlist,
        {
          artistId: args.artistId,
          setlistfmId,
          date,
          venueName,
          venueCity,
          venueState: entry?.venue?.city?.stateCode || undefined,
          venueCountry: entry?.venue?.city?.country?.name || undefined,
          songs,
        },
      );

      if (result.created) {
        imported += 1;
      } else {
        skipped += 1;
      }
    }

    await ctx.runMutation(internalRef.setlistfmHistory.recordHistorySync, {
      artistId: args.artistId,
      setlistfmMbid: learnedMbid,
      lastSetlistfmHistorySyncAt: now,
    });

    console.log(
      `🎼 setlistfmHistory: ${artist.name} — imported ${imported}, skipped ${skipped} (candidates ${entries.length}${learnedMbid ? ", learned mbid" : ""})`,
    );
    return { imported, skipped, artistName: artist.name };
  },
});

// Cron-driven backfill: drain artists that never had a history sync, gently.
export const backfillArtistHistories = internalAction({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ scheduled: v.number(), artists: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const batchSize = Math.max(1, Math.min(args.batchSize ?? 10, 50));
    const candidates: Array<{ artistId: Id<"artists">; name: string }> = await ctx.runQuery(
      internalRef.setlistfmHistory.getBackfillCandidates,
      { limit: batchSize },
    );

    const artists: string[] = [];
    for (let i = 0; i < candidates.length; i += 1) {
      // Stagger 3s apart to stay well under setlist.fm's ~2 req/s limit.
      await ctx.scheduler.runAfter(i * 3000, internalRef.setlistfmHistory.importArtistHistory, {
        artistId: candidates[i].artistId,
      });
      artists.push(candidates[i].name);
    }

    console.log(
      `🗓️ setlistfmHistory backfill: scheduled ${artists.length} artists${artists.length ? ` (${artists.join(", ")})` : ""}`,
    );
    return { scheduled: artists.length, artists };
  },
});

// Fan-facing trigger: visiting an artist page whose history was never imported
// schedules an import immediately instead of waiting for the backfill cron.
// Server-side guards make this abuse-resistant: it only schedules when the
// artist has never synced (or is stale), and importArtistHistory itself skips
// anything synced within the freshness window.
export const requestArtistHistoryImport = action({
  args: { artistId: v.id("artists") },
  returns: v.object({ scheduled: v.boolean() }),
  handler: async (ctx, args) => {
    const artist = await ctx.runQuery(internalRef.artists.getByIdInternal, { id: args.artistId });
    if (!artist) return { scheduled: false };
    if (
      typeof artist.lastSetlistfmHistorySyncAt === "number" &&
      Date.now() - artist.lastSetlistfmHistorySyncAt < HISTORY_FRESHNESS_MS
    ) {
      return { scheduled: false };
    }
    await ctx.scheduler.runAfter(0, internalRef.setlistfmHistory.importArtistHistory, {
      artistId: args.artistId,
    });
    return { scheduled: true };
  },
});
