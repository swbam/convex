import { internalMutation, internalQuery } from "./_generated/server";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { escapeHtml, SITE_URL, STATIC_PAGES } from "../shared/seo";
import { isSitemapRecordIndexable } from "./seoEligibility";
const stepRef = makeFunctionReference<"mutation">("sitemaps:step");
const cleanupRef = makeFunctionReference<"mutation">("sitemaps:cleanup");
const KINDS = ["artists", "shows", "venues", "festivals"] as const;
const PARTS_PER_SITEMAP = 16;
export function urlset(paths: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${escapeHtml(SITE_URL + path)}</loc></url>`).join("")}</urlset>`;
}
export const refresh = internalMutation({
  args: {}, handler: async ctx => {
    for (const kind of KINDS) {
      const state = await ctx.db.query("seoSitemapStates").withIndex("by_kind", q => q.eq("kind", kind)).unique();
      // Resume a failed batch at its committed cursor, preserving the previous
      // published generation throughout the refresh. No request scans tables.
      if (state?.building) {
        await ctx.scheduler.runAfter(0, stepRef, { kind, generation: state.generation, cursor: state.cursor });
        continue;
      }
      const generation = Date.now();
      const fields = { kind, generation, cursor: null, lastIncludedSlug: null, building: true, updatedAt: generation, nextShard: 0, urlCount: 0 };
      if (state) await ctx.db.patch(state._id, fields); else await ctx.db.insert("seoSitemapStates", fields);
      await ctx.scheduler.runAfter(0, stepRef, { kind, generation, cursor: null });
    }
    await ctx.scheduler.runAfter(0, cleanupRef, {});
  },
});
export const step = internalMutation({
  args: { kind: v.string(), generation: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const state = await ctx.db.query("seoSitemapStates").withIndex("by_kind", q => q.eq("kind", args.kind)).unique();
    if (!state?.building || state.generation !== args.generation || state.cursor !== args.cursor) return;
    if (!KINDS.includes(args.kind as any)) throw new Error("Unknown sitemap kind");
    // A cursor from an in-progress, older generation belongs to the creation-time index.
    const catalog = ctx.db.query(args.kind as typeof KINDS[number]);
    const sortedBySlug = state.lastIncludedSlug !== undefined;
    const scan = sortedBySlug ? catalog.withIndex("by_slug") : catalog;
    const result = await scan.paginate({ cursor: args.cursor, numItems: 80, maximumBytesRead: 512_000 });
    const paths: string[] = [];
    let lastIncludedSlug = state.lastIncludedSlug;
    for (const doc of result.page) {
      if (!doc.slug || (sortedBySlug && doc.slug === lastIncludedSlug)) continue;
      if (await isSitemapRecordIndexable(ctx, args.kind, doc)) {
        paths.push(`/${args.kind}/${encodeURIComponent(doc.slug)}`);
        lastIncludedSlug = doc.slug;
      }
    }
    let nextShard = state.nextShard;
    if (paths.length) {
      await ctx.db.insert("seoSitemapShards", { kind: args.kind, generation: args.generation, part: nextShard++, xml: urlset(paths), urlCount: paths.length });
    }
    const urlCount = state.urlCount + paths.length;
    if (result.isDone && (state.publishedUrlCount || 0) >= 20 && urlCount < state.publishedUrlCount! / 2) {
      throw new Error(`Sitemap ${args.kind} lost over half its URLs; retaining published generation for investigation`);
    }
    await ctx.db.patch(state._id, {
      cursor: result.continueCursor, nextShard, urlCount, updatedAt: Date.now(), building: !result.isDone,
      ...(sortedBySlug ? { lastIncludedSlug } : {}),
      ...(result.isDone ? { publishedGeneration: args.generation, publishedShards: nextShard, publishedAt: Date.now(), publishedUrlCount: urlCount } : {}),
    });
    if (!result.isDone) await ctx.scheduler.runAfter(0, stepRef, { ...args, cursor: result.continueCursor });
  },
});
export const index = internalQuery({ args: {}, handler: async ctx => {
  const states = await ctx.db.query("seoSitemapStates").take(10);
  const entries = [`${SITE_URL}/sitemaps/static.xml`, `${SITE_URL}/sitemaps/blog.xml`];
  for (const state of states) {
    const count = Math.ceil((state.publishedShards || 0) / PARTS_PER_SITEMAP);
    for (let part = 0; part < count; part++) entries.push(`${SITE_URL}/sitemaps/${state.kind}-${part}.xml`);
  }
  return { ready: KINDS.every(kind => states.some(state => state.kind === kind && state.publishedGeneration !== undefined)), xml: `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(url => `<sitemap><loc>${escapeHtml(url)}</loc></sitemap>`).join("")}</sitemapindex>`, states };
} });
export const publishedFile = internalQuery({
  args: { kind: v.string(), part: v.number() },
  handler: async (ctx, { kind, part }) => {
    const state = await ctx.db.query("seoSitemapStates").withIndex("by_kind", q => q.eq("kind", kind)).unique();
    const first = part * PARTS_PER_SITEMAP;
    if (!Number.isSafeInteger(first) || first < 0 || state?.publishedGeneration === undefined || first >= (state.publishedShards || 0)) return null;
    const rows = await ctx.db.query("seoSitemapShards").withIndex("by_generation_part", q =>
      q.eq("kind", kind).eq("generation", state.publishedGeneration!).gte("part", first).lt("part", first + PARTS_PER_SITEMAP)
    ).take(PARTS_PER_SITEMAP);
    const urls = rows.map(row => row.xml.slice(row.xml.indexOf("<url>"), row.xml.lastIndexOf("</urlset>")));
    return urlset([]).replace("</urlset>", () => urls.join("") + "</urlset>");
  },
});
export const shard = internalQuery({ args: { kind: v.string(), generation: v.number(), part: v.number() }, handler: async (ctx, a) => (await ctx.db.query("seoSitemapShards").withIndex("by_generation_part", q => q.eq("kind", a.kind).eq("generation", a.generation).eq("part", a.part)).unique())?.xml ?? null });
export const cleanup = internalMutation({ args: {}, handler: async ctx => {
  const states = await ctx.db.query("seoSitemapStates").take(10);
  const candidates = await ctx.db.query("seoSitemapShards").withIndex("by_generation", q => q.lt("generation", Date.now() - 7 * 86400_000)).take(100);
  let deleted = 0;
  for (const shard of candidates) if (!states.some(s => s.kind === shard.kind && (s.generation === shard.generation || s.publishedGeneration === shard.generation))) { await ctx.db.delete(shard._id); deleted++; }
  if (deleted === 100) await ctx.scheduler.runAfter(0, cleanupRef, {});
} });
export const staticSitemap = () => urlset(Object.keys(STATIC_PAGES));
