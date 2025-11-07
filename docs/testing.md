# Testing Guide

This repo ships with integration-focused tests. No mocks are used; tests are gated by environment variables and will be skipped when requirements are not met.

## Prerequisites
- A running Convex deployment (local `convex dev` or cloud). Export `CONVEX_URL` for HTTP tests.
- Optional: `ENABLE_CONVEX_RUN=true` to allow tests to invoke `npx convex run`.
- Clerk test user (for UI smoke): `CLERK_TEST_EMAIL`, `CLERK_TEST_PASSWORD`.
- Playwright UI base URL: `PLAYWRIGHT_BASE_URL`.
- Spotify app credentials: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`.
- Optional data IDs for deeper tests: `TEST_SETLIST_ID`, `TEST_SHOW_ID`, `TEST_SETLISTFM_ID`.

## Running
- Unit/UI tests: `npm run test` or `npm run test:run`
- Playwright UI: `npm run test` (UI tests are conditionally skipped without env)

## What’s covered
- Auth & webhooks: signature verification enforced in production.
- Health: `/health` HTTP endpoint, `health.validateEnvironment` action.
- Votes: setlist vote summary; song votes (anonymous limit).
- Sync queue: failed imports query (smoke).
- setlist.fm: happy path & 404 handling.
- Trending: shows query shape.
- Spotify refresh: action runs (when creds present).

## Notes
- Set `ENABLE_CONVEX_RUN=true` to run CLI-based tests that call live functions.
- Tests are designed to be harmless and read-mostly unless explicit IDs are provided.


