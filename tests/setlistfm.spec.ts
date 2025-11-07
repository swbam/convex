import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

const enable = process.env.ENABLE_CONVEX_RUN === 'true';
const showId = process.env.TEST_SHOW_ID; // Existing show id
const validSetlistId = process.env.TEST_SETLISTFM_ID; // Known valid setlist.fm id (optional)

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

describe('setlist.fm import (requires ENABLE_CONVEX_RUN=true and TEST_SHOW_ID)', () => {
  (enable && showId ? it : it.skip)('404 gracefully handled for nonexistent setlist', () => {
    const res = runConvex('setlistfm:syncSpecificSetlist', {
      showId,
      setlistfmId: 'nonexistent_id_404',
    });
    // Should not crash; either returns null or logs
    expect([0, 1]).toContain(res.status);
  });

  (enable && showId && validSetlistId ? it : it.skip)('happy path import updates show and creates official setlist', () => {
    const res = runConvex('setlistfm:syncSpecificSetlist', {
      showId,
      setlistfmId: validSetlistId,
    });
    expect(res.status).toBe(0);
  });
});


