# Artist Portal + Analytics: Build Outline (setlists.live)

This document is an engineering-focused outline for implementing the **artist-side experience** (onboarding + “tour dashboard”) on top of the existing fan product, Convex backend, Clerk auth, and the current sync + cron architecture.

It is intentionally concrete to this repo’s reality:
- Convex tables already exist for `artists`, `shows`, `setlists`, `songVotes`, `songs`, `artistSongs`.
- There is an efficient sync system (Ticketmaster + Spotify catalog + setlist.fm) and an orchestrated cron subsystem (`convex/crons.ts`, `convex/cronOrchestrator.ts`).
- Clerk + OAuth (Spotify + Google) is already wired in the client (`src/pages/SignInPage.tsx`, `src/pages/SpotifyConnectPage.tsx`, `src/pages/SSOCallback.tsx`) and Convex auth identity sync exists (`convex/auth.ts`).

The missing piece is **an authorization + UX layer that turns fan-generated demand into actionable touring decisions for the artist/team**.

---

## 1) Current System Snapshot (So We Don’t Break It)

### 1.1 Data Flows That Already Work
- **Artist/show discovery + upcoming schedule**: Ticketmaster → `artists` + `shows` (plus cached `trendingArtists`/`trendingShows`).
- **Catalog**: Spotify import → `songs` + `artistSongs`.
- **Predictions**: community setlist (“prediction setlist”) exists per show and fans add songs + vote songs (`setlists` + `songVotes`).
- **Ground truth after the show**: setlist.fm import populates `setlists.actualSetlist`.
- **Trending & operations**: cron orchestrator keeps ranks and counts updated.

### 1.2 Engagement Signals Available Today (Artist dashboard can use immediately)
- `songVotes` (ProductHunt-style upvotes for songs on a show’s prediction setlist).
- `setlists.songs` (songs that were added to the prediction setlist, even before votes).
- `shows.voteCount` / `shows.setlistCount` (lightweight engagement rollups).

### 1.3 Constraints / Reality Checks
- `songVotes` are keyed by `setlistId`, not directly by `showId` → the artist dashboard must resolve “which setlist is the prediction setlist for this show?” consistently.
- setlist.fm data lags (often 1–3 days) → post-show analytics must be resilient and clearly label freshness.
- Spotify OAuth does **not** reliably prove “this user manages this artist page” via public Spotify API; verification must be handled intentionally (see verification section).

---

## 2) Product Definition: Artist Portal (What “Done” Means)

### 2.1 Primary Job To Be Done
Help artists on tour answer:
1) **What do fans want at tonight’s show?**
2) **How is demand different by city/date?**
3) **What should we rotate / add / cut to maximize crowd satisfaction?**
4) **After the show: did we hit the fan favorites?**

### 2.2 Success Criteria (Measurable)
- Artist can onboard + claim access in < 3 minutes (with a clear “pending verification” path).
- Artist can open a show page and immediately see:
  - top requested songs (and trend vs last 7 days),
  - “surprises” (songs with sudden momentum),
  - and a suggested rotation set.
- Artist can review tour-wide insights (city deltas / momentum) without waiting on heavy computations.
- System is safe + cheap: no accidental full-table scans, no exploding cron costs.

---

## 3) Architecture Principles (How We Build Without Regressions)

1) **Don’t add “artist” as a global user role.**
   - Keep `users.role` for platform privileges (admin).
   - Use **membership tables** to grant access to an artist.
2) **Write-time aggregation first, cron second.**
   - Anything that updates on every fan vote should be maintained incrementally.
   - Cron jobs should do heavy recalculations and sanity reconciliation, not act as the only source of truth.
3) **Never block fan UX.**
   - Artist dashboard queries should not slow down the show page mutations (`songVotes.voteOnSong`, `setlists.addSongToSetlist`).
4) **Design for team access.**
   - Most touring acts have managers, tour managers, label, etc.
   - The portal must support multiple users per artist.

---

## 4) Data Model Additions (Focused: Access + Analytics)

### 4.1 Artist Access & Claims (Authorization Layer)
Add tables:
- `artistClaims`
  - `userId: Id<"users">`
  - `artistId: Id<"artists">`
  - `status: "pending" | "approved" | "rejected"`
  - `submittedAt: number`
  - `evidence: { type, value }[]` (links/screenshots/email domain, etc.)
  - `spotifyProviderUserId?: string` (for convenience, not proof)
  - `reviewedAt?: number`, `reviewedBy?: Id<"users">`, `reviewNote?: string`
  - Indexes: `by_status`, `by_user`, `by_artist`, `by_user_artist`

- `artistMembers`
  - `artistId: Id<"artists">`
  - `userId: Id<"users">`
  - `role: "owner" | "manager" | "viewer"`
  - `createdAt: number`
  - Indexes: `by_artist`, `by_user`, `by_user_artist`

Optional (later): `artistInvites` to invite team members via email.

Why this is correct:
- avoids `users.role` explosion,
- supports a manager owning multiple artists,
- keeps access logic enforceable in Convex queries/mutations.

### 4.2 Demand Aggregations (Performance Layer)
Add incremental rollup tables so artist screens don’t scan `songVotes`:
- `showSongDemand`
  - `showId: Id<"shows">`
  - `songKey: string` (normalized title key)
  - `songTitle: string` (display title)
  - `upvotes: number`
  - `uniqueVoters?: number` (optional, can be approximated to save cost)
  - `lastVoteAt: number`
  - Indexes: `by_show`, `by_show_upvotes`, `by_show_lastVoteAt`

Optionally, for tour charts:
- `artistSongDemandDaily`
  - `artistId`, `day`, `songKey`, `upvotesDelta`, `uniqueVotersDelta`
  - Keeps “momentum” cheap to compute.

### 4.3 Explicitly Out Of Scope (For Now)
To stay focused on **artist onboarding + dashboard**, we are not building:
- Song tags (opener/closer/ballad/etc.)
- Complex setlist planners / playbooks / rotation pools
- Any “notes/CRM” feature set

We can add these only after artists are actively using the dashboard and requesting them.

---

## 5) Backend (Convex) Modules To Add

### 5.1 Authorization Helpers
Create a small module (e.g., `convex/artistAccess.ts`) with:
- `requireArtistMember(ctx, artistId)` → throws if not a member
- `listMyArtists(ctx)` → returns all artists the logged-in user can access
- `isArtistMember(ctx, artistId)` → boolean helper for the UI

Use the existing patterns in:
- `convex/auth.ts` (`getAuthUserId`, `ensureUserExists`)
- `convex/admin.ts` (`requireAdmin`, skip-gated admin queries)

### 5.2 Claim & Approval Flow (Public + Admin)
New functions:
- Public:
  - `artistClaims.create({ artistId, evidence })`
  - `artistClaims.getMyClaims()`
  - `artistClaims.getMyMemberships()`
- Admin:
  - `artistClaims.listPending()`
  - `artistClaims.approve({ claimId })` → creates `artistMembers`
  - `artistClaims.reject({ claimId, note })`

Integrate into Admin dashboard UI similarly to other admin sections.

### 5.3 Analytics Queries (Artist Dashboard API)
New query layer (e.g., `convex/artistDashboard.ts`):
- `getTourOverview({ artistId })`
  - upcoming shows, venue/city, engagement rollups, last activity timestamps
- `getShowDemand({ showId })`
  - returns ranked `showSongDemand` + “recent delta”
- `getTourInsights({ artistId, startDate, endDate })`
  - city deltas, momentum, “deep cut opportunities”
- `getPostShowReport({ showId })`
  - once actual setlist exists: top requested vs played, missed favorites

Keep these queries purely read-only and cheap.

### 5.4 Write-Time Rollups (Where The Real Value Is)
Modify existing mutations (later implementation) to update `showSongDemand`:
- `songVotes.voteOnSong`: on add/remove, update `showSongDemand` for the show.
- `setlists.addSongToSetlist`: optionally treat “song added” as a weak demand signal (separate metric) or simply ensure it appears in show plan suggestions.

Key detail:
- To update `showSongDemand`, you need `showId`. `songVotes` only has `setlistId`, so resolve `setlists.showId` in the mutation.

### 5.5 Cron Jobs (Use The Orchestrator, Don’t Add More Fixed Crons)
Add an orchestrated job only when needed:
- `refresh-artist-analytics`
  - reconciles rollups against source-of-truth (rarely, or nightly)
  - rebuilds daily deltas
  - sanity checks for drift

This keeps the cost-efficient cron design intact.

---

## 6) Frontend: Routes + UX (Artist Portal Without Colliding With Fan Routes)

### 6.1 New Private Route Namespace
Add routes under something like:
- `/studio` (choose artist, onboarding status)
- `/studio/:artistId` (artist home)
- `/studio/:artistId/shows/:showId` (show demand)
- `/studio/:artistId/insights` (tour-wide)

Why:
- `/artists/:slug` is public fan-facing; keep it clean and SEO-friendly.
- `/studio` is explicitly private and team-oriented.

### 6.2 Artist Onboarding UX (Practical + Spotify-First)
Flow:
1) User signs in (Clerk).
2) User connects Spotify (**required** to access `/studio`).
   - We already have a Spotify connect + callback path wired via `SpotifyConnectPage` and `SSOCallback`.
   - On callback we:
     - store their Spotify tokens (`spotifyTokens` via `spotifyAuth.storeSpotifyTokens`);
     - fetch `/v1/me/top/artists` + `/v1/me/following?type=artist` (already implemented via `spotifyOAuth.completeSpotifyImport`);
     - import those artists into `artists` + `userSpotifyArtists`.
3) “Claim your artist” screen:
   - primary list: artists from `userSpotifyArtists` (artists this Spotify account follows / streams heavily).
   - fallback search: existing `artists` (by name/slug/ticketmasterId) if needed.
   - user selects the artist they want to manage → creates `artistClaims` with their `spotifyUserId` attached.
4) Pending approval screen:
   - clear expectations + ability to add more evidence (links, social, etc.).

### 6.3 Artist Dashboard Screens (Actionable Defaults)
**Artist Home (Tour Overview)**
- Upcoming shows list
- “Tonight” highlight (next show)
- Demand pulse (votes last 24–72h)
- Quick buttons: open show demand, export “Tonight” view, share fan link

**Show Demand (Tonight’s Decision Screen)**
- Ranked songs: “Most requested” with delta and recency badges
- “Simple suggestions” (no tagging system):
  - “Top requested not in the prediction list yet”
  - “Low-demand songs currently in the prediction list”
- Confidence labels:
  - unique voters, total votes, recency

**Insights**
- City deltas (over-index by location)
- Momentum (rising songs this week)
- Deep-cut opportunities (rare in actual setlists but high demand)

**Post-show report**
- Top requested vs played
- “Missed favorites” list
- “Prediction accuracy” (leverages `actualSetlist` vs prediction)

---

## 7) Spotify-First Onboarding & Verification (How “Official Spotify Account” Works)

Important reality from the Spotify Web API:
- OAuth + standard scopes (`user-read-email`, `user-top-read`, `user-follow-read`, etc.) authenticate a **Spotify user account**, not an artist object.
- There is no public “Spotify for Artists” API to cryptographically prove this user is an official admin of a given artist profile.

Given that, we define “verified artist Spotify account” for this product as:
- a Spotify user account that:
  - has completed OAuth with the scopes we require; and
  - has the artist in its followed/top-artist list; and
  - has passed our verification workflow (manual or future automated checks).

Recommended staged verification:
1) **Stage 1 (Immediate): manual approval**
   - Claim requires Spotify sign-in + evidence.
   - We only allow claiming artists that appear in that Spotify account’s `userSpotifyArtists` list (top/followed artists we imported).
   - Admin approves claim in the existing admin dashboard.
2) **Stage 2: domain verification**
   - If artist has a website domain, request DNS TXT or email verification.
3) **Stage 3: stronger automation (optional)**
   - Integrate additional systems (label/management provider, ticketing partner, etc.) if needed.

This avoids “fake claiming” while letting real artists onboard quickly.

---

## 8) Spotify Auth Technical Notes (Make Spotify Sign-In Reliable)

Before the artist portal depends on Spotify, confirm the end-to-end contract:
1) **What token do we actually have in the client after Spotify OAuth?**
   - `src/pages/SSOCallback.tsx` calls `getToken({ template: "spotify" })`. That may be a Clerk-issued JWT template, not a Spotify access token.
2) **Where do we get real Spotify access/refresh tokens?**
   - `SSOCallback` already inspects `spotifyAccount` from Clerk’s external accounts and pulls out `refresh_token`, `scope`, `token_type`, `expires_in`.
   - `convex/spotifyAuth.storeSpotifyTokens` encrypts + writes those to `spotifyTokens` (set `SPOTIFY_TOKEN_ENC_KEY` in prod).
3) **Scopes needed for artist onboarding**
   - `user-read-email` (optional; for contact).
   - `user-top-read` and `user-follow-read` to fetch top/followed artists and populate `userSpotifyArtists`.
4) **Minimum requirement for onboarding**
   - We do not need ongoing Spotify API calls for the dashboard itself.
   - We *do* require:
     - Spotify external account is linked;
     - we have a valid access token at least once to call `/v1/me/top/artists` and `/v1/me/following`;
     - we capture `providerUserId` (`spotifyUserId`) and persist it alongside the artist claim for auditability.

For the initial artist portal release, keep dashboards independent of Spotify API calls:
- Use the existing artist catalog already imported into `songs`/`artistSongs`.
- Use fan demand data from `songVotes` + `showSongDemand` rollups.

---

## 9) Analytics Logic (Concert-Touring Specific, Not Generic BI)

### 9.1 Demand Scoring
For each show, for each song:
- Base signal: `upvotes`
- Optional: recency-weighted score (e.g., half-life 7 days)
- Optional: normalize by unique voters to resist brigading

### 9.2 City Delta (“What This City Wants”)
Compute per song:
- `cityScore(song) - tourAvgScore(song)`
This yields:
- strong “local favorites”
- songs that underperform locally (possible skip/rotation candidates)

### 9.3 Rotation Suggestions (Tour Manager UX)
Inputs:
- predicted setlist songs (community setlist)
- top requested songs (votes)

Output:
- recommend 2–4 swaps with rationale:
  - “Song A is trending +35% in this city”
  - “Song B has low demand and was played last 3 shows”

Note: “played last 3 shows” requires post-show actual setlist history (available via setlist.fm imports, but delayed).

---

## 10) Admin Tooling (Leverage What Exists)

Extend `src/components/AdminDashboard.tsx` with:
- “Artist Claims” section:
  - list pending claims
  - approve/reject
  - add team members
- Audit everything:
  - use `adminAuditLogs` for approvals and membership edits

This keeps ops centralized and avoids building a second admin surface.

---

## 11) Delivery Plan (Incremental, Safe, No Big-Bang)

Phase 0 — Hardening prerequisites
- Confirm Spotify token handling + encryption key.
- Verify indexes exist for new rollup queries (design them before coding).

Phase 1 — Spotify-first artist access layer
- Add `artistClaims` + `artistMembers` tables + minimal API.
- Gate `/studio` behind “Spotify connected”.
- Add `/studio` route with “claim artist” UX.
- Add admin approval UI.

Phase 2 — Show demand dashboard
- Add `showSongDemand` rollup.
- Update `songVotes.voteOnSong` to maintain rollups.
- Build `/studio/:artistId/shows/:showId` with ranked demand.

Phase 3 — Tour insights + post-show report
- Add city delta + momentum queries.
- Build post-show report from `actualSetlist` vs demand.
- Optional orchestrated nightly reconciliation job.

Optional (only if artists ask) — Lightweight exports
- Add a print/PDF-friendly “Tonight” view for the show demand screen.

---

## 12) Engineering Checklist (Non-negotiables)

- Every artist dashboard query enforces membership with `requireArtistMember`.
- No full scans of `songVotes` in hot paths; use indexes/rollups.
- Every new cron job goes through `cronOrchestrator` unless there’s a compelling reason otherwise.
- All privileged actions are audited (reuse `adminAuditLogs`).
- UI is resilient to delayed sync (setlist.fm lag, show importStatus, etc.).
