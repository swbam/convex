import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

const convexUrl = process.env.CONVEX_URL;
const testIf = (cond: any) => (cond ? it : it.skip);
const enable = process.env.ENABLE_CONVEX_RUN === 'true';

function runConvex(cmd: string, args: Record<string, any> = {}) {
  const arg = Object.keys(args).length ? JSON.stringify(args) : '';
  const full = arg ? `${cmd} '${arg}'` : cmd;
  const res = spawnSync('npx', ['-y', 'convex', 'run', ...full.split(' ')], {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 30_000,
  });
  return res;
}

describe('Health endpoint', () => {
  testIf(convexUrl)('GET /health returns status and env flags', async () => {
    const res = await fetch(`${convexUrl}/health`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(typeof data.status).toBe('string');
    expect(typeof data.timestamp).toBe('number');
    expect(data.environment).toBeTruthy();
  });

  (enable ? it : it.skip)('validateEnvironment action returns shape', async () => {
    const res = runConvex('health:validateEnvironment');
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/"valid"/);
  });
});


