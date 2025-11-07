import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

// These tests exercise the live Convex deployment via CLI.
// They are skipped unless explicitly enabled and required env is present.

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

describe.skipIf ? describe.skipIf : describe('Votes integration (requires ENABLE_CONVEX_RUN=true)', () => {
  (enable ? it : it.skip)('can fetch votes summary for a setlist when provided', () => {
    const setlistId = process.env.TEST_SETLIST_ID;
    if (!setlistId) return;
    const res = runConvex('votes:getSetlistVotes', { setlistId });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('accuracy');
  });
});


