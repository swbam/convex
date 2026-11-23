// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FunctionReturnType } from 'convex/server';
import { convexTest } from 'convex-test';
import schema from '../../convex/schema';
import { api } from '../../convex/_generated/api';
const modules = import.meta.glob('../../convex/**/*.{ts,js}');
const NOW = Date.parse('2026-09-30T12:00:00Z');
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });
async function fixture() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const venueId = await t.run(ctx => ctx.db.insert('venues', { name: 'Club', city: 'Austin', country: 'US' }));
  return { t, venueId };
}

describe('full artist directory', () => {
  it('paginates beyond the trending limit with no popularity or cached-count prerequisite', async () => {
    const { t, venueId } = await fixture();
    await t.run(async ctx => {
      for (let i = 0; i < 120; i++) {
        const artistId = await ctx.db.insert('artists', { name: `Artist ${String(i).padStart(3, '0')}`, slug: `artist-${i}`, isActive: true, popularity: 0, upcomingShowsCount: 0 });
        await ctx.db.insert('shows', { artistId, venueId, date: '2026-11-01', status: 'upcoming' });
      }
    });
    let cursor: string | null = null; const names: string[] = [];
    for (let i = 0; i < 20; i++) {
      const page: FunctionReturnType<typeof api.artistDirectory.browse> = await t.query(api.artistDirectory.browse, { paginationOpts: { cursor, numItems: 12 }, upcomingOnly: true });
      names.push(...page.page.map(a => a.name));
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    expect(names).toHaveLength(120);
    expect(new Set(names).size).toBe(120);
    expect(names[119]).toBe('Artist 119');
  });
  it('does not end the directory at an empty filtered page; ignores expired or cancelled shows', async () => {
    const { t, venueId } = await fixture();
    await t.run(async ctx => {
      for (const [name, status, date] of [['A Past', 'upcoming', '2020-01-01'], ['B Cancelled', 'cancelled', '2026-11-01'], ['C Touring', 'upcoming', '2026-11-01']] as const) {
        const artistId = await ctx.db.insert('artists', { name, slug: name, isActive: true, upcomingShowsCount: 200 });
        await ctx.db.insert('shows', { artistId, venueId, date, status });
      }
    });
    const first = await t.query(api.artistDirectory.browse, { paginationOpts: { cursor: null, numItems: 2 } });
    expect(first.page).toHaveLength(0); expect(first.isDone).toBe(false);
    const next = await t.query(api.artistDirectory.browse, { paginationOpts: { cursor: first.continueCursor, numItems: 2 } });
    expect(next.page.map(a => a.name)).toEqual(['C Touring']); expect(next.isDone).toBe(true);
    const all = await t.query(api.artistDirectory.browse, { paginationOpts: { cursor: null, numItems: 24 }, upcomingOnly: false });
    expect(all.page).toHaveLength(3);
  });
  it('searches across the catalog and preserves distinct artists with the same name', async () => {
    const { t, venueId } = await fixture();
    await t.run(async ctx => {
      for (let i = 0; i < 75; i++) await ctx.db.insert('artists', { name: `Earlier Artist ${i}`, slug: `earlier-${i}`, isActive: true });
      for (const slug of ['satellites-a', 'satellites-b', 'inactive']) {
        const artistId = await ctx.db.insert('artists', { name: 'The Satellites', slug, isActive: slug !== 'inactive' });
        await ctx.db.insert('shows', { artistId, venueId, date: '2026-11-01', status: 'upcoming' });
      }
    });
    const found = await t.query(api.artistDirectory.browse, { search: 'Satellites', paginationOpts: { cursor: null, numItems: 24 } });
    expect(found.page.map(a => a.slug).sort()).toEqual(['satellites-a', 'satellites-b']);
  });
  it('skips an ended show today to find the next performance, and respects explicit overnight times', async () => {
    const { t, venueId } = await fixture();
    await t.run(async ctx => {
      const artistId = await ctx.db.insert('artists', { name: 'Touring', slug: 'touring', isActive: true });
      await ctx.db.insert('shows', { artistId, venueId, date: '2026-09-30', status: 'upcoming', startsAt: NOW - 10 * 3_600_000, endsAt: NOW - 5 * 3_600_000 });
      await ctx.db.insert('shows', { artistId, venueId, date: '2026-10-02', status: 'upcoming' });
      const overnight = await ctx.db.insert('artists', { name: 'Overnight', slug: 'overnight', isActive: true });
      await ctx.db.insert('shows', { artistId: overnight, venueId, date: '2026-09-29', status: 'upcoming', startsAt: NOW - 3_600_000, endsAt: NOW + 3_600_000 });
    });
    const found = await t.query(api.artistDirectory.browse, { paginationOpts: { cursor: null, numItems: 24 } });
    expect(found.page.find(a => a.slug === 'touring')?.nextShowDate).toBe('2026-10-02');
    expect(found.page.find(a => a.slug === 'overnight')).toBeDefined();
  });
});
