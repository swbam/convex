import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, internalRef } from "./adminHelpers";
import { normalizeFestivalText } from "./lib/festivalIdentity";
import { safeImageUrl } from "./lib/festivalMedia";

const entry = v.object({ name: v.string(), dayNumber: v.optional(v.number()) });
const args = { festivalId: v.id("festivals"), entries: v.array(entry), source: v.string(), sourceUrl: v.optional(v.string()), verified: v.optional(v.boolean()), year: v.number(), startDate: v.optional(v.string()), endDate: v.optional(v.string()) };
async function store(ctx: any, a: any) {
  const f = await ctx.db.get(a.festivalId); if (!f || a.year !== f.year) throw new Error("Festival edition does not match");
  if (a.entries.length > 500 || a.entries.length === 0) throw new Error("Provide 1–500 lineup artists");
  if (a.sourceUrl && !safeImageUrl(a.sourceUrl)) throw new Error("Use an HTTPS source URL");
  if (a.verified && !a.sourceUrl) throw new Error("A verified lineup requires its source URL");
  const startDate = a.startDate ?? f.startDate, endDate = a.endDate ?? f.endDate;
  const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10) === d;
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate || Number(startDate.slice(0,4)) !== a.year || Date.parse(endDate) - Date.parse(startDate) > 90 * 86400000) throw new Error("Invalid edition dates");
  const unique = new Map<string, { name: string; dayNumber?: number }>();
  for (const e of a.entries) {
    const name = e.name.trim(), key = normalizeFestivalText(name);
    if (!key || name.length > 160) throw new Error("Invalid artist name");
    if (e.dayNumber !== undefined && (!Number.isInteger(e.dayNumber) || e.dayNumber < 1 || e.dayNumber > (Date.parse(endDate)-Date.parse(startDate))/86400000+1)) throw new Error("Artist day is outside this edition");
    unique.set(key, { name, dayNumber: e.dayNumber });
  }
  // Failed/thinner automated sources never erase a previously verified roster.
  if (f.lineupStatus === "verified" && !a.verified) return { count: f.lineupExpectedCount ?? unique.size, preserved: true };
  const existing = await ctx.db.query("festivalLineupEntries").withIndex("by_festival", (q: any) => q.eq("festivalId", f._id)).take(600);
  for (const [key, e] of unique) {
    const old = existing.find((x: any) => x.nameKey === key);
    const artists = await ctx.db.query("artists").withIndex("by_lower_name", (q: any) => q.eq("lowerName", e.name.toLowerCase())).take(2);
    const row = { name: e.name, dayNumber: e.dayNumber ?? old?.dayNumber, source: a.source, sourceUrl: a.sourceUrl, updatedAt: Date.now(), artistId: old?.artistId ?? (artists.length === 1 ? artists[0]._id : undefined) };
    if (old) await ctx.db.patch(old._id, row);
    else await ctx.db.insert("festivalLineupEntries", { festivalId: f._id, nameKey: key, ...row });
  }
  // Keep historical performance links. Only an explicitly verified roster can
  // remove superseded roster-only rows; lower-confidence imports are additive.
  if (a.verified) for (const old of existing) if (!unique.has(old.nameKey)) await ctx.db.delete(old._id);
  const names = new Set([...(a.verified ? [] : existing.map((x: any) => x.nameKey)), ...unique.keys()]);
  const shows = await ctx.db.query("shows").withIndex("by_festival", (q: any) => q.eq("festivalId", f._id)).take(600);
  for (const show of shows) {
    if (show.date < startDate || show.date > endDate) continue;
    const venue = await ctx.db.get(show.venueId);
    const [city, state] = f.location.split(",").map(normalizeFestivalText);
    if (venue && city && city !== "tba" && (normalizeFestivalText(venue.city) !== city || (state && normalizeFestivalText(venue.state ?? "") !== state))) continue;
    const artist = await ctx.db.get(show.artistId); if (artist) names.add(normalizeFestivalText(artist.name));
  }
  await ctx.db.patch(f._id, { startDate, endDate, lineupSource: a.source, lineupSourceUrl: a.sourceUrl, lineupCheckedAt: Date.now(), lineupStatus: a.verified ? "verified" : "partial", lineupExpectedCount: unique.size, artistCount: names.size });
  return { count: unique.size, preserved: false };
}
export const storeInternal = internalMutation({ args, handler: store });
export const save = mutation({ args, handler: async (ctx, a) => {
  const actorUserId = await requireAdmin(ctx);
  const result = await store(ctx, a);
  await ctx.db.insert("adminAuditLogs", { actorUserId, action: "festival.roster", args: { festivalId: a.festivalId, sourceUrl: a.sourceUrl, count: result.count, verified: a.verified }, createdAt: Date.now(), success: true });
  await ctx.scheduler.runAfter(0, internalRef.festivalLineupImport.startFestivalLineupImportInternal, { festivalId: a.festivalId });
  return result;
}});
export const linkArtist = internalMutation({ args: { festivalId: v.id("festivals"), name: v.string(), artistId: v.id("artists") }, handler: async (ctx, a) => {
  const row = await ctx.db.query("festivalLineupEntries").withIndex("by_festival_name", q => q.eq("festivalId", a.festivalId).eq("nameKey", normalizeFestivalText(a.name))).unique();
  if (row) await ctx.db.patch(row._id, { artistId: a.artistId });
}});
