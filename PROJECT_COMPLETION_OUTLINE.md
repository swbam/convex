# setlists.live Completion Audit

> **Goal**: bring the production app to a “100 % working” state. Items are grouped by theme and flagged by impact. References use `path:line` (1-based) for quick lookup.

---

## 1. Authentication & Session Flow
- **Investigate Convex identity gaps** – The “Sign In to View Activity” prompt persists after login, indicating `api.auth.loggedInUser` may still resolve to `null`. Confirm the Clerk → Convex JWT template (`convex`) exists and that `CLERK_JWT_ISSUER_DOMAIN` is set in every environment; add startup validation (convex/auth.config.ts:1-9, main.tsx:21-55).
- **Store Spotify OAuth tokens securely** – Tokens now persist via `spotifyTokens` but encryption still needs to be reintroduced using a Node-only action (convex/spotifyAuth.ts:1-220).
- ✅ **Repair token refresh cron** – Updated `refreshUserTokens` to use `Buffer.from(...).toString("base64")`, the `refresh_token` grant, and proper patching (convex/spotifyAuth.ts:340-470).
- **SSO callback race-check** – The Spotify `redirectUrlComplete` targets `/activity`, yet `SSOCallback` pushes to `/` after a 1 s timeout (src/pages/SignInPage.tsx:57-120, src/pages/SSOCallback.tsx:11-120). Audit the sequence to guarantee dashboard redirect and avoid duplicate navigation.
- **Add hard guards for admin tools** – `/admin` renders even when not authenticated; rely on `AuthGuard` + Convex checks, but also gate the route with `SignedIn`/`SignedOut` UI to avoid flashing unauthorized content (src/components/AppLayout.tsx:240-360, convex/admin.ts:12-60).

## 2. Frontend Navigation & UX
- ✅ **Fix missing icon import** – `Music` now imported at `src/App.tsx:1-40`.
- ✅ **Stop passing slugs as Convex IDs** – `handleArtistClick` / `handleShowClick` now separate slugs from IDs before navigation (src/App.tsx:147-199).
- ✅ **Activity navigation regression** – Added a setup guard in `src/components/ActivityPage.tsx:61-94` to avoid the stale “Sign In” CTA during account provisioning.
- ✅ **Mobile bottom nav polish** – Added an authenticated activity tab and cleaned auth handling (src/components/MobileBottomNav.tsx:1-128).
- **Audit sign-in error messaging** – “Authentication not ready” toast fires whenever `signIn` or `signUp` is momentarily undefined. Replace with Clerk’s built-in `isLoaded` guard plus retry affordances (src/pages/SignInPage.tsx:29-120, src/pages/SignUpPage.tsx:17-110, src/pages/SpotifyConnectPage.tsx:1-70).

## 3. Convex Functions & Performance
- ✅ **Eliminate N+1 activity queries** – `convex/activity.ts:30-160` now batches `ctx.db.get` calls and reuses hydrated maps.
- ✅ **Add schema support for `bio`** – Added the optional `bio` field in `convex/schema.ts:6-26`.
- ✅ **Use indexed scans for Spotify users** – `convex/users.ts:337-349` now derives Spotify-enabled users from the token table instead of scanning the entire collection.
- **Harden manual admin tools** – `createManualUser` fabricates `authId` values; ensure downstream auth logic cannot collide with real Clerk subjects and limit the helper to ops-only contexts (convex/users.ts:348-360).
- **Review `getVoteAccuracy` heuristics** – The metric only increments totals when `actualSetlist` exists and treats every upvote as “correct” (convex/activity.ts:450-472). Define a clearer spec (e.g., compare predicted vs. actual sequence) and cache results to avoid rehydration per request.

## 4. Data Ingestion & Background Jobs
- **Trending data population** – Confirm Ticketmaster + Spotify syncs are filling `trendingRank` fields; run `maintenance:triggerTrendingSync` and inspect both dev and prod deployments once MCP access is restored (convex/trending.ts:320-420, scripts/sync routines).
- **Setlist completeness** – Ensure `setlistfm` importers populate `actualSetlist` so accuracy + admin review panels do not stay empty (convex/setlistfm.ts, convex/setlists.ts).
- **Cron monitoring** – All 11 crons fire hourly/daily without logging hooks (convex/crons.ts:5-41). Add structured logging + failure alerts and verify each referenced internal action exists and is robust against API outages.
- **Spotify artist correlation** – `importUserSpotifyArtistsWithToken` double-calls `api.auth.loggedInUser` and schedules background syncs per artist. Validate concurrency limits and add deduplication to avoid flooding `syncJobs` (convex/spotifyAuth.ts:36-228, convex/syncJobs.ts).

## 5. Database & Schema Hygiene
- **Audit indexes vs. query patterns** – Cross-check heavy queries (`artists.getTrending`, `shows.getByArtist`, analytics endpoints) to ensure every filter leverages defined indexes (convex/schema.ts, respective modules).
- **Verify referential integrity** – Many mutations assume related docs exist (e.g., setlists referencing shows). Add guard rails or precondition checks before writing activity records (convex/activity.ts:45-133, convex/setlists.ts).
- **Define token storage schema** – Introduce a dedicated table (e.g., `spotifyTokens`) with encrypted fields, expiration tracking, and an index by `userId`.
- **Review legacy fields** – Fields like `artists.isFollowed` / `isTopArtist` are optional and may be stale; decide whether to remove or normalize via join tables only (convex/schema.ts:18-34).

## 6. Observability, Testing, & Operations
- **Restore MCP Convex access** – `convex-development` server currently returns `"Unexpected error when loading the Convex deployment"`. Resolve token / environment issues so automated audits can inspect data directly.
- **Add regression tests** – No Vitest suites cover auth redirects, activity rendering, or Convex actions. Add smoke tests for critical flows and backend unit tests using Convex’s testing harness.
- **Telemetry & error handling** – Replace `console.log` debugging with structured logging and surface toast errors for backend failures (multiple files).
- **Legal/compliance follow-up** – Ensure `/privacy`, `/terms`, and cookie consent implementations from SECURITY_AUDIT.md are live and linked in the footer (src/pages/PrivacyPage.tsx, TermsPage.tsx, src/components/Footer.tsx).

## 7. Verification Checklist
1. Run full authentication cycle (email, Google, Spotify) and confirm dashboard, activity, and admin pages react appropriately.
2. Trigger trending + setlist cron jobs manually; verify resulting data in Convex tables and UI sections (Trending, Shows, Dashboard).
3. Validate admin tools: user search, role updates, flag moderation, bulk delete.
4. Inspect Convex logs for repeated failures (esp. Spotify refresh, Ticketmaster sync, maintenance jobs).
5. Re-test mobile nav + responsive layouts after fixes.

---

**Next action**: decide ownership per section, prioritize Critical/High items, and schedule implementation plus validation runs. Update this outline as tasks close to keep the team aligned on remaining gaps.
