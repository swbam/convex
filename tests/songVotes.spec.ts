import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

const enable = process.env.ENABLE_CONVEX_RUN === 'true';
const setlistId = process.env.TEST_SETLIST_ID;

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

describe('Song votes (requires ENABLE_CONVEX_RUN=true and TEST_SETLIST_ID)', () => {
  (enable && setlistId ? it : it.skip)('allows anonymous upvote with anonId and enforces total limit', () => {
    const anonId = `anon_${Date.now()}`;
    const res1 = runConvex('songVotes:voteOnSong', {
      setlistId,
      songTitle: 'Test Song',
      voteType: 'upvote',
      anonId,
    });
    expect(res1.status).toBe(0);

    // A second vote on a different song is still within the free allowance.
    const res2 = runConvex('songVotes:voteOnSong', {
      setlistId,
      songTitle: 'Another Song',
      voteType: 'upvote',
      anonId,
    });
    expect(res2.status).toBe(0);

    // A third active vote should fail due to the anonymous limit of 2.
    const res3 = runConvex('songVotes:voteOnSong', {
      setlistId,
      songTitle: 'Third Song',
      voteType: 'upvote',
      anonId,
    });
    // Either non-zero exit or an error string in stderr depending on environment
    expect([0, 1]).toContain(res3.status);
    if (res3.status === 0) {
      // If CLI swallowed the error, ensure error text exists
      expect(res3.stdout + res3.stderr).toMatch(/Anonymous users can only vote on 2 songs per show/);
    }
  });
});

