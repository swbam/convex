import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import { query } from './_generated/server';

/** Browse the artist catalog, independently of the curated Trending cache. */
export const browse = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    upcomingOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const search = args.search?.trim().slice(0, 100) ?? '';
    const options = { ...args.paginationOpts, numItems: Math.max(1, Math.min(48, args.paginationOpts.numItems)), maximumRowsRead: 96 };
    // One cursor over the entire catalog. Namesakes keep their separate IDs.
    const result = search
      ? await ctx.db.query('artists').withSearchIndex('search_name', q => q.search('name', search).eq('isActive', true)).paginate(options)
      : await ctx.db.query('artists').withIndex('by_active_name', q => q.eq('isActive', true)).order('asc').paginate(options);
    const now = Date.now();
    const hour = 3_600_000;
    // Date-only provider records use the same conservative 42-hour window as
    // showTiming's fallback. Explicit start/end timestamps take precedence.
    const dateCutoff = new Date(now - 42 * hour).toISOString().slice(0, 10);
    const rows = await Promise.all(result.page.map(async artist => {
      if (!artist.name.trim() || artist.name === 'Unknown Artist') return null;
      // Existence, not the stale/capped summary count, decides touring eligibility.
      // The compound index seeks straight to this artist's current/future shows.
      const nextShow = await ctx.db.query('shows')
        .withIndex('by_artist_status_and_date', q => q.eq('artistId', artist._id).eq('status', 'upcoming').gte('date', dateCutoff))
        .filter(q => q.or(
          q.gt(q.field('endsAt'), now - hour),
          q.and(q.eq(q.field('endsAt'), undefined), q.gt(q.field('startsAt'), now - 6 * hour)),
          q.and(q.eq(q.field('startsAt'), undefined), q.gt(q.field('date'), dateCutoff)),
        )).first();
      if (args.upcomingOnly !== false && !nextShow) return null;
      return {
        _id: artist._id, name: artist.name, slug: artist.slug,
        images: artist.images?.slice(0, 1), genres: artist.genres?.slice(0, 3),
        nextShowDate: nextShow?.date,
      };
    }));
    // Filtering a bounded page can produce fewer results; preserve the cursor
    // and isDone from the underlying scan so later artists never disappear.
    return { ...result, page: rows.filter((row): row is NonNullable<typeof row> => row !== null) };
  },
});
