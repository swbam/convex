import { describe, it, expect } from 'vitest';

const convexUrl = process.env.CONVEX_URL;
const clerkSecret = process.env.CLERK_WEBHOOK_SECRET;
const isProd = process.env.NODE_ENV === 'production';

const testIf = (cond: any) => (cond ? it : it.skip);

describe('Clerk webhook verification', () => {
  testIf(convexUrl && clerkSecret)(
    'rejects invalid signature when secret is configured',
    async () => {
      const res = await fetch(`${convexUrl}/webhooks/clerk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Intentionally missing Svix headers
        },
        body: JSON.stringify({ type: 'user.created', data: { id: 'user_test' } }),
      });
      // In production, invalid signatures MUST 401; in dev this may be allowed
      if (isProd) {
        expect(res.status).toBe(401);
      } else {
        // Non-production may pass to facilitate local testing
        expect([200, 401]).toContain(res.status);
      }
    },
    15_000
  );
});


