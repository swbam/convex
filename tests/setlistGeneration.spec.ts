import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

const enable = process.env.ENABLE_CONVEX_RUN === 'true';

function runConvex(cmd: string, args: Record<string, any> = {}) {
  const arg = Object.keys(args).length ? JSON.stringify(args) : '';
  const full = arg ? `${cmd} '${arg}'` : cmd;
  const res = spawnSync('npx', ['-y', 'convex', 'run', ...full.split(' ')], {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 120_000,
  });
  return res;
}

describe('Setlist Generation Tests (requires ENABLE_CONVEX_RUN=true)', () => {
  (enable ? it : it.skip)('diagnostic: find shows without setlists', () => {
    const res = runConvex('diagnostics:findShowsWithoutSetlists', { limit: 50 });
    expect(res.status).toBe(0);
    // Should return an array (might be empty if all shows have setlists)
    expect(res.stdout).toMatch(/\[/);
  });

  (enable ? it : it.skip)('diagnostic: find artists without songs', () => {
    const res = runConvex('diagnostics:findArtistsWithoutSongs', { limit: 50 });
    expect(res.status).toBe(0);
    // Should return an array
    expect(res.stdout).toMatch(/\[/);
  });

  (enable ? it : it.skip)('backfill: can trigger backfill for missing setlists', () => {
    const res = runConvex('internal.admin:testBackfillMissingSetlists', { limit: 10 });
    expect(res.status).toBe(0);
    // Should return success and counts
    expect(res.stdout).toMatch(/(processed|generated)/i);
  });

  (enable ? it : it.skip)('refresh: can refresh missing auto-setlists (upcoming only)', () => {
    const res = runConvex('setlists:refreshMissingAutoSetlistsAction', { limit: 10 });
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/\{/); // Should return object with counts
  });
});

