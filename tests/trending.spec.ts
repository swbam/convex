import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

const enable = process.env.ENABLE_CONVEX_RUN === 'true';

function runConvex(cmd: string, args: Record<string, any> = {}) {
  const arg = Object.keys(args).length ? JSON.stringify(args) : '';
  const full = arg ? `${cmd} '${arg}'` : cmd;
  const res = spawnSync('npx', ['-y', 'convex', 'run', ...full.split(' ')], {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 60_000,
  });
  return res;
}

describe('Trending queries (requires ENABLE_CONVEX_RUN=true)', () => {
  (enable ? it : it.skip)('getTrendingShows returns objects with page field', () => {
    const res = runConvex('trending:getTrendingShows', { limit: 5 });
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/"page"/);
  });
});


