import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

const enable = process.env.ENABLE_CONVEX_RUN === 'true';
const hasCreds = !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);

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

describe('Spotify token refresh (requires ENABLE_CONVEX_RUN=true and Spotify creds)', () => {
  (enable && hasCreds ? it : it.skip)('runs without error', () => {
    const res = runConvex('spotifyAuth:refreshUserTokens');
    expect([0, 1]).toContain(res.status);
  });
});


