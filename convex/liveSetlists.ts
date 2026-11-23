import { v } from "convex/values";
import { query, mutation, internalMutation, internalAction, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internalRef, requireAdmin } from "./adminHelpers";
import { performanceValidator, requestValidator, livePhase } from "./lib/liveSetlistValidators";
import { DMB_MBID, HOUR, MINUTE, LIVE_REQUEST_CAP, isDmb, nextLiveCheck, parsePerformances } from "../shared/liveSetlist";
import { selectSetlistMatch } from "./lib/setlistMatch";
import { getRequestCounts } from "./lib/songVoteCounts";
import { setlistProviderFetch } from "./lib/setlistProviderFetch";

const idArgs = { showId: v.id("shows") };
const stateValidator = v.object({
  phase: livePhase, startsAt: v.number(), nextCheckAt: v.optional(v.number()),
  lastCheckedAt: v.optional(v.number()), confirmedAt: v.optional(v.number()),
  frozenAt: v.optional(v.number()), delayed: v.boolean(),
});
function scheduleKey(show: Doc<"shows">) {
  return `${show.artistId}|${show.venueId}|${show.date}|${show.startsAt}|${show.status === "cancelled"}`;
}
function state(session: Doc<"liveSetlistSessions">) {
  return { phase: session.phase, startsAt: session.startsAt, nextCheckAt: session.nextCheckAt,
    lastCheckedAt: session.lastCheckedAt, confirmedAt: session.confirmedAt,
    frozenAt: session.frozenAt, delayed: !!session.lastError };
}
async function sessionFor(ctx: Pick<QueryCtx, "db">, showId: Id<"shows">) {
  return ctx.db.query("liveSetlistSessions").withIndex("by_show", q => q.eq("showId", showId)).unique();
}
async function snapshotFor(ctx: Pick<QueryCtx, "db">, showId: Id<"shows">) {
  return ctx.db.query("liveSetlistSnapshots").withIndex("by_show", q => q.eq("showId", showId)).unique();
}
async function schedule(ctx: MutationCtx, id: Id<"liveSetlistSessions">, at: number) {
  await ctx.db.patch(id, { nextCheckAt: at, leaseUntil: undefined });
  await ctx.scheduler.runAfter(Math.max(0, at - Date.now()), internalRef.liveSetlists.poll, { sessionId: id });
}

export const getState = query({ args: idArgs, returns: v.union(v.null(), stateValidator),
  handler: async (ctx, { showId }) => { const session = await sessionFor(ctx, showId); return session ? state(session) : null; },
});

// Content does not read the operational session: an unchanged provider response never
// invalidates the potentially larger performance/request subscription.
export const getContent = query({ args: idArgs, returns: v.union(v.null(), v.object({
  songs: v.array(performanceValidator), requests: v.array(requestValidator),
  sourceUrl: v.optional(v.string()), version: v.optional(v.string()),
  sourceUpdatedAt: v.optional(v.number()), updatedAt: v.number(),
})), handler: async (ctx, { showId }) => {
  const snapshot = await snapshotFor(ctx, showId);
  if (snapshot) { const { _id, _creationTime, showId: _, ...content } = snapshot; return content; }
  const show = await ctx.db.get(showId);
  if (!show || !isDmb(await ctx.db.get(show.artistId))) return null;
  const lists = await ctx.db.query("setlists").withIndex("by_show", q => q.eq("showId", showId)).take(100);
  const official = lists.find(list => list.isOfficial && list.setlistfmData);
  if (!official) return null;
  try { return { songs: parsePerformances(official.setlistfmData), requests: [], updatedAt: official.lastUpdated ?? official._creationTime,
    sourceUrl: safeSourceUrl(official.setlistfmData?.url) }; } catch { return null; }
} });

function safeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try { const url = new URL(value); return url.protocol === "https:" && ["setlist.fm", "www.setlist.fm"].includes(url.hostname) ? url.href : undefined; }
  catch { return undefined; }
}

async function enroll(ctx: MutationCtx, showId: Id<"shows">) {
  const existing = await sessionFor(ctx, showId);
  if (existing) return existing._id;
  const show = await ctx.db.get(showId);
  if (!show || !isDmb(await ctx.db.get(show.artistId))) throw new Error("This pilot is restricted to Dave Matthews Band.");
  if (!show.startsAt || show.status !== "upcoming" || Date.now() >= show.startsAt + 4 * HOUR) throw new Error("Choose an upcoming DMB show with a confirmed start time.");
  const sessions = await ctx.db.query("liveSetlistSessions").take(4);
  if (sessions.length >= 3) throw new Error("The pilot is limited to three shows in total.");
  const id = await ctx.db.insert("liveSetlistSessions", { showId, artistId: show.artistId, startsAt: show.startsAt,
    phase: "scheduled", generation: 0, requestsUsed: 0, failures: 0, scheduleKey: scheduleKey(show) });
  await ctx.db.insert("liveSetlistSnapshots", { showId, songs: [], requests: [], updatedAt: Date.now() });
  await schedule(ctx, id, Math.max(Date.now(), show.startsAt - 30 * MINUTE));
  return id;
}
export const enrollShow = mutation({ args: idArgs, returns: v.id("liveSetlistSessions"), handler: async (ctx, { showId }) => {
  await requireAdmin(ctx); return enroll(ctx, showId);
} });
// Operational deployment hook; not callable from a browser.
export const enrollInternal = internalMutation({ args: idArgs, returns: v.id("liveSetlistSessions"), handler: async (ctx, { showId }) => enroll(ctx, showId) });

export const adminList = query({ args: {}, returns: v.object({
  candidates: v.array(v.object({ showId: v.id("shows"), title: v.string(), startsAt: v.number(), slug: v.optional(v.string()) })),
  sessions: v.array(v.object({ showId: v.id("shows"), title: v.string(), slug: v.optional(v.string()),
    state: stateValidator, requestsUsed: v.number(), lastError: v.optional(v.string()), version: v.optional(v.string()),
    songs: v.array(performanceValidator), sourceUrl: v.optional(v.string()) })),
}), handler: async ctx => {
  await requireAdmin(ctx);
  const sessions = await ctx.db.query("liveSetlistSessions").take(4);
  const artist = await ctx.db.query("artists").withIndex("by_slug", q => q.eq("slug", "dave-matthews-band")).unique();
  const shows = artist ? await ctx.db.query("shows").withIndex("by_artist_and_date", q => q.eq("artistId", artist._id).gte("date", new Date(Date.now() - 86400000).toISOString().slice(0, 10))).take(50) : [];
  const title = async (show: Doc<"shows">) => `${(await ctx.db.get(show.venueId))?.name ?? "Venue"} · ${show.date}`;
  return {
    candidates: await Promise.all(shows.filter(show => show.status === "upcoming" && !!show.startsAt && show.startsAt + 4 * HOUR > Date.now() && !sessions.some(s => s.showId === show._id)).map(async show => ({ showId: show._id, title: await title(show), startsAt: show.startsAt!, slug: show.slug }))),
    sessions: await Promise.all(sessions.map(async session => {
      const show = await ctx.db.get(session.showId), snapshot = await snapshotFor(ctx, session.showId);
      return { showId: session.showId, title: show ? await title(show) : "Deleted show", slug: show?.slug,
        state: state(session), requestsUsed: session.requestsUsed, lastError: session.lastError,
        version: snapshot?.version, songs: snapshot?.songs ?? [], sourceUrl: snapshot?.sourceUrl };
    })),
  };
} });

export const control = mutation({ args: { ...idArgs, operation: v.union(v.literal("pause"), v.literal("resume"), v.literal("refresh")) }, returns: v.null(), handler: async (ctx, args) => {
  await requireAdmin(ctx);
  const session = await sessionFor(ctx, args.showId);
  if (!session) throw new Error("Pilot show not found");
  if (args.operation === "pause") {
    await ctx.db.patch(session._id, { phase: "paused", generation: session.generation + 1, nextCheckAt: undefined, leaseUntil: undefined });
  } else {
    if (session.requestsUsed >= LIVE_REQUEST_CAP || Date.now() > session.startsAt + 72 * HOUR) throw new Error("This pilot has reached its request or time limit.");
    // Refresh cannot bypass a worker, provider quota, or an existing scheduled cooldown.
    if ((session.leaseUntil ?? 0) > Date.now()) return null;
    const next = Math.max(Date.now(), session.startsAt - 30 * MINUTE, session.lastCheckedAt ? session.lastCheckedAt + 3 * MINUTE : 0);
    await ctx.db.patch(session._id, { phase: "scheduled", generation: session.generation + 1 });
    await schedule(ctx, session._id, next);
  }
  return null;
} });

export const claim = internalMutation({ args: { sessionId: v.id("liveSetlistSessions") }, returns: v.union(v.null(), v.object({
  generation: v.number(), sourceId: v.optional(v.string()), artistName: v.string(), artistMbid: v.string(),
  venueName: v.string(), city: v.string(), date: v.string(),
})), handler: async (ctx, { sessionId }) => {
  const session = await ctx.db.get(sessionId), now = Date.now();
  if (!session || session.phase === "paused" || session.phase === "finished" || session.nextCheckAt === undefined || session.nextCheckAt > now || (session.leaseUntil ?? 0) > now) return null;
  const show = await ctx.db.get(session.showId);
  const artist = show ? await ctx.db.get(show.artistId) : null;
  const venue = show ? await ctx.db.get(show.venueId) : null;
  if (!show || !isDmb(artist) || !venue || scheduleKey(show) !== session.scheduleKey) {
    await ctx.db.patch(sessionId, { phase: "paused", nextCheckAt: undefined, leaseUntil: undefined, lastError: "Show identity, cancellation, or schedule changed; review before resuming." });
    return null;
  }
  // A recovery worker may execute the final 72-hour follow-up slightly late.
  if (session.requestsUsed >= LIVE_REQUEST_CAP || now > session.startsAt + 73 * HOUR) {
    await ctx.db.patch(sessionId, { phase: "finished", nextCheckAt: undefined, leaseUntil: undefined }); return null;
  }
  if (!session.frozenAt && now >= session.startsAt) {
    const lists = await ctx.db.query("setlists").withIndex("by_show", q => q.eq("showId", session.showId)).take(101);
    if (lists.length > 100) {
      await ctx.db.patch(sessionId, { phase: "paused", nextCheckAt: undefined, leaseUntil: undefined, lastError: "Too many setlists to safely freeze requests; review required." });
      return null;
    }
    const community = lists.find(list => !list.isOfficial && !list.userId);
    let requests;
    try {
      requests = community ? (await getRequestCounts(ctx, community, 500)).map(({ songTitle, upvotes }) => ({ songTitle, upvotes })) : [];
      if (requests.length > 500) throw new Error("Too many requested songs to safely freeze");
    } catch {
      await ctx.db.patch(sessionId, { phase: "paused", nextCheckAt: undefined, leaseUntil: undefined,
        lastError: "Fan vote totals need repair before this pilot can run. No partial totals were saved." });
      return null;
    }
    const snapshot = await snapshotFor(ctx, session.showId);
    if (!snapshot) throw new Error("Missing pilot snapshot");
    await ctx.db.patch(snapshot._id, { requests, updatedAt: now });
    await ctx.db.patch(sessionId, { frozenAt: session.startsAt });
  }
  const generation = session.generation + 1;
  await ctx.db.patch(sessionId, { generation, leaseUntil: now + 2 * MINUTE,
    phase: now < session.startsAt ? "scheduled" : now < session.startsAt + 4 * HOUR ? "monitoring" : "followup" });
  return { generation, sourceId: session.sourceId, artistName: artist!.name, artistMbid: DMB_MBID, venueName: venue.name, city: venue.city, date: show.date };
} });

export const applyResult = internalMutation({ args: {
  sessionId: v.id("liveSetlistSessions"), generation: v.number(), error: v.optional(v.string()),
  retryAt: v.optional(v.number()), result: v.optional(v.object({ id: v.string(), version: v.string(), songs: v.array(performanceValidator),
    sourceUrl: v.optional(v.string()), sourceUpdatedAt: v.optional(v.number()) })),
}, returns: v.boolean(), handler: async (ctx, args) => {
  const session = await ctx.db.get(args.sessionId), now = Date.now();
  if (!session || session.generation !== args.generation || !session.leaseUntil || session.phase === "paused") return false;
  const show = await ctx.db.get(session.showId);
  if (!show || scheduleKey(show) !== session.scheduleKey) {
    await ctx.db.patch(session._id, { phase: "paused", nextCheckAt: undefined, leaseUntil: undefined, lastError: "Show changed during provider request; review required." }); return false;
  }
  const snapshot = await snapshotFor(ctx, session.showId);
  if (!snapshot) throw new Error("Missing pilot snapshot");
  let changed = false;
  const result = args.result;
  if (result && (!snapshot.sourceUpdatedAt || !result.sourceUpdatedAt || result.sourceUpdatedAt >= snapshot.sourceUpdatedAt)) {
    changed = JSON.stringify(snapshot.songs) !== JSON.stringify(result.songs) || snapshot.version !== result.version;
    if (changed) {
      await ctx.db.patch(snapshot._id, { songs: result.songs, version: result.version, sourceUrl: result.sourceUrl, sourceUpdatedAt: result.sourceUpdatedAt, updatedAt: now });
      // A corrected source invalidates manual completeness confirmation. It must be reviewed
      // again; live data can never silently overwrite a finalized official setlist.
      if (session.confirmedAt) await ctx.db.patch(session._id, { confirmedAt: undefined });
    }
  }
  const failures = args.error ? session.failures + 1 : 0;
  const lastChangedAt = changed ? now : session.lastChangedAt;
  const next = nextLiveCheck(session.startsAt, now, lastChangedAt, failures);
  await ctx.db.patch(session._id, { lastCheckedAt: now, lastChangedAt, failures,
    lastError: args.error, sourceId: result?.id ?? session.sourceId, leaseUntil: undefined });
  if (next !== undefined && session.requestsUsed < LIVE_REQUEST_CAP) {
    const due = Math.max(next, args.retryAt ?? 0);
    if (due <= session.startsAt + 73 * HOUR) await schedule(ctx, session._id, due);
    else await ctx.db.patch(session._id, { phase: "finished", nextCheckAt: undefined });
  } else await ctx.db.patch(session._id, { phase: "finished", nextCheckAt: undefined });
  return true;
} });

export const poll = internalAction({ args: { sessionId: v.id("liveSetlistSessions") }, returns: v.null(), handler: async (ctx, args) => {
  const claim = await ctx.runMutation(internalRef.liveSetlists.claim, args);
  if (!claim) return null;
  const reservation = { ...args, generation: claim.generation };
  try {
    const key = process.env.SETLISTFM_API_KEY;
    if (!key) throw new Error("Provider API key is not configured");
    const [year, month, day] = claim.date.split("-");
    const path = claim.sourceId ? `setlist/${encodeURIComponent(claim.sourceId)}`
      : `search/setlists?artistMbid=${DMB_MBID}&date=${day}-${month}-${year}&cityName=${encodeURIComponent(claim.city)}`;
    const response = await setlistProviderFetch(ctx, `https://api.setlist.fm/rest/1.0/${path}`, {
      headers: { "x-api-key": key, Accept: "application/json", "User-Agent": "setlists.live/1.0" },
    }, reservation);
    if (response.status === 404) { await ctx.runMutation(internalRef.liveSetlists.applyResult, reservation); return null; }
    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After"));
      await ctx.runMutation(internalRef.liveSetlists.applyResult, { ...reservation, error: "Provider requests paused by the shared budget or provider throttle.", retryAt: Date.now() + Math.max(15 * MINUTE, Number.isFinite(seconds) ? seconds * 1000 : 0) });
      return null;
    }
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
    const data = await response.json();
    const match = selectSetlistMatch(claim.sourceId ? [data] : Array.isArray(data.setlist) ? data.setlist : [], claim);
    if (!match || (claim.sourceId && match.id !== claim.sourceId)) throw new Error("No unambiguous match for this artist, venue, and concert date.");
    if (typeof match.id !== "string" || typeof match.versionId !== "string") throw new Error("Provider response has no revision identity");
    const songs = parsePerformances(match);
    const updated = Date.parse(match.lastUpdated);
    await ctx.runMutation(internalRef.liveSetlists.applyResult, { ...reservation, result: {
      id: match.id, version: match.versionId, songs, sourceUrl: safeSourceUrl(match.url),
      ...(Number.isFinite(updated) ? { sourceUpdatedAt: updated } : {}),
    } });
  } catch (error) {
    await ctx.runMutation(internalRef.liveSetlists.applyResult, { ...reservation,
      error: error instanceof Error ? error.message.slice(0, 200) : "Provider request failed" });
  }
  return null;
} });

export const recover = internalMutation({ args: {}, returns: v.number(), handler: async ctx => {
  const due = await ctx.db.query("liveSetlistSessions").withIndex("by_due", q => q.gt("nextCheckAt", 0).lte("nextCheckAt", Date.now())).take(3);
  let count = 0;
  for (const session of due) if (session.phase !== "paused" && session.phase !== "finished" && (session.leaseUntil ?? 0) < Date.now()) {
    await ctx.scheduler.runAfter(0, internalRef.liveSetlists.poll, { sessionId: session._id }); count++;
  }
  return count;
} });

export const confirmComplete = mutation({ args: { ...idArgs, version: v.string() }, returns: v.null(), handler: async (ctx, args) => {
  await requireAdmin(ctx);
  const session = await sessionFor(ctx, args.showId), snapshot = await snapshotFor(ctx, args.showId);
  if (!session || !session.frozenAt || Date.now() < session.startsAt + 4 * HOUR) throw new Error("Wait until the live monitoring window has ended before confirming completeness.");
  const show = await ctx.db.get(args.showId);
  if (!show || scheduleKey(show) !== session.scheduleKey || !isDmb(await ctx.db.get(show.artistId))) throw new Error("The show identity or schedule changed; review the pilot first.");
  if (!snapshot?.songs.length || snapshot.version !== args.version || !session.sourceId) throw new Error("The source changed or is empty. Review its latest version first.");
  // Commit the confirmation and normal official import together, including all existing
  // search/catalog/analytics hooks. Generic imports are blocked until this point.
  await ctx.db.patch(session._id, { confirmedAt: Date.now() });
  const sections = new Map<number, { encore: number; song: unknown[] }>();
  for (const song of snapshot.songs) {
    if (!sections.has(song.setNumber)) sections.set(song.setNumber, { encore: song.encore ? 1 : 0, song: [] });
    sections.get(song.setNumber)!.song.push({ name: song.title, ...(song.guest ? { with: { name: song.guest } } : {}),
      ...(song.cover ? { cover: { name: song.cover } } : {}), ...(song.notes ? { info: song.notes } : {}) });
  }
  await ctx.runMutation(internalRef.setlists.createFromApi, { showId: args.showId, data: { id: session.sourceId, versionId: snapshot.version, url: snapshot.sourceUrl, sets: { set: [...sections.values()] } } });
  return null;
} });

export const isReserved = internalQuery({ args: idArgs, returns: v.boolean(), handler: async (ctx, { showId }) => !!(await sessionFor(ctx, showId)) });
