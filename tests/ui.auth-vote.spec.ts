import { test, expect } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const email = process.env.CLERK_TEST_EMAIL;
const password = process.env.CLERK_TEST_PASSWORD;

test.describe('Auth + voting smoke (requires PLAYWRIGHT_BASE_URL and Clerk creds)', () => {
  test.skip(!baseURL || !email || !password, 'Missing env for UI smoke');

  test('can load home page', async ({ page }) => {
    await page.goto(baseURL!);
    await expect(page).toHaveTitle(/setlist/i);
  });
});


