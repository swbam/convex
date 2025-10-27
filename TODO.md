# setlists.live Remediation TODO

- [x] **Fix missing imports** – added `import { Music } from "lucide-react";` to `src/App.tsx:1-40` so the artist-not-found state compiles.
- [x] **Safe slug navigation** – refactored `handleArtistClick` / `handleShowClick` in `src/App.tsx:168-199` to pass slugs separately, wait for Convex IDs, and avoid casting slugs to `Id`.
- [x] **Schema vs. mutation mismatch** – extended the users table with an optional `bio` field in `convex/schema.ts:6-26` (with regenerated types) to match `convex/users.ts:34-71`.
- [ ] **Secure Spotify OAuth tokens** – tokens are stored via the `spotifyTokens` table (`convex/spotifyAuth.ts:1-220`), but encryption still needs to be added using a Node runtime action.
- [x] **Spotify token queries** – replaced the users table scan in `convex/users.ts:337-349` by reading stored token owners.
- [x] **Batch activity hydration** – optimized `convex/activity.ts:30-160` to batch `ctx.db.get` calls instead of N+1 fetching.
- [ ] **Setlist import completeness** – ensure Setlist.fm ingestion populates `actualSetlist` (see empty arrays in production, e.g., `setlists/kd7agevpwrfz1h4czvsahpyss57t93t9`) and rerun the sync jobs.
- [ ] **Auth/Clerk handshake audit** – confirm the `convex` Clerk JWT template exists, validate env vars on startup (partially addressed in `convex/auth.config.ts:1-14`), and verify `ensureUserExists` runs so Convex users persist after sign-in.
- [x] **Mobile nav polish** – refreshed the bottom nav in `src/components/MobileBottomNav.tsx:1-128` to add an activity tab and clean auth handling.
- [x] **Activity view UX** – added a setup state in `src/components/ActivityPage.tsx:61-94` to avoid the post-login “Sign In” flash.
- [ ] **Admin route gating** – pair `AuthGuard` with `SignedIn` checks for `/admin` so unauthorized users never see the shell (`src/router.tsx`, `src/components/AppLayout.tsx:240-360`).
- [ ] **Observability & logs** – add structured logging/error reporting for cron jobs (`convex/crons.ts:5-41`) and key mutations; review Toaster alerts for backend failures.
