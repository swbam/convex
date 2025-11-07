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

    // Second vote on a different song should fail due to anon limit of 1
    const res2 = runConvex('songVotes:voteOnSong', {
      setlistId,
      songTitle: 'Another Song',
      voteType: 'upvote',
      anonId,
    });
    // Either non-zero exit or an error string in stderr depending on environment
    expect([0, 1]).toContain(res2.status);
    if (res2.status === 0) {
      // If CLI swallowed the error, ensure error text exists
      expect(res2.stdout + res2.stderr).toMatch(/Anonymous users can only upvote one song total/);
    }
  });
});


