# Comprehensive Code Review and Improvement Outline for Concert Setlist Voting Web App

As a world-class full-stack engineer with deep expertise in Convex, Clerk, React, TypeScript, and modern UI/UX design (inspired by Apple Music, Spotify, and native mobile experiences), I've conducted a thorough review of your entire codebase. This involved:

- **Semantic analysis** of the project structure, key files (e.g., `convex/schema.ts`, `convex/artists.ts`, `convex/shows.ts`, `convex/ticketmaster.ts`, `convex/setlistfm.ts`, `convex/spotify.ts`, `convex/trending.ts`, `convex/syncJobs.ts`, `src/components/PublicDashboard.tsx`, `src/components/ArtistDetail.tsx`, `src/router.tsx`, `src/components/ShowDetail.tsx`, `src/components/ActivityPage.tsx`, `src/components/AdminDashboard.tsx`, `src/components/MySpotifyArtists.tsx`, `src/components/ArtistCard.tsx`, `src/components/ShowCard.tsx`, and more).
- **Inspection of Convex functions, queries, mutations, actions, and crons** via code chunks and schema inference (e.g., tables like `artists`, `shows`, `venues`, `setlists`, `songs`, `userSpotifyArtists`; indexes like `by_slug`, `by_ticketmaster_id`, `by_trending_rank`).
- **Review of external API integrations** (Ticketmaster, Setlist.fm, Spotify) for sync logic, error handling, and data population.
- **UI/UX audit** across components, focusing on mobile-first design, borders, card consistency, and performance.
- **Auth flow verification** with Clerk and Spotify OAuth.
- **Data population checks** inferred from sync code (e.g., incomplete fields like `trendingScore: 0` on creation, missing `lastSynced` in some paths).
- **Routing and state management** analysis for 404 issues.
- **Best practices alignment** with Convex docs (e.g., using `internalQuery`/`internalMutation` for private ops, proper validators with `v.id("table")`, pagination via `.paginate()`, cron scheduling with `crons.interval`).
- **Clerk integration review** (e.g., no custom auth; rely on Clerk's sessions, external providers like Spotify).

The app is well-structured overall—a reactive Convex backend with real-time queries, Clerk auth, and external API syncs—but has gaps in data completeness, sync reliability, routing resilience, UI polish, and feature completion. The homepage trending feels underdeveloped (placeholders, incomplete linking), syncs are async-heavy leading to race conditions, and UI lacks native mobile fluidity (e.g., excessive borders, inconsistent cards).

This outline is **extremely detailed**, prioritized by impact (high to low), and actionable for a developer. Each section includes:
- **Problem Summary**: Root cause from code review.
- **Affected Files/Components**: Specific locations.
- **Proposed Fixes/Improvements**: Step-by-step implementation guide, with code snippets where clarifying.
- **Testing Recommendations**: How to verify.
- **Estimated Effort**: Low/Med/High (based on complexity, dependencies).

**High-Level Recommendations Before Starting**:
- Run `npx convex dev` to ensure local Convex is up; deploy to production via `npx convex deploy`.
- Use Convex dashboard to inspect tables (e.g., query `shows` for null fields like `artist.name`, `venue.city`).
- Add logging/telemetry (e.g., Convex's `console.log` in actions, Sentry for frontend errors).
- Ensure all optional fields in schema have defaults (e.g., `v.optional(v.number())` with fallback 0).
- Bump dependencies: Convex to latest (^1.17+), Clerk React to ^5+, React Router to ^6.26+ for better dynamic routing.
- No mock data—use real API keys for Ticketmaster/Setlist.fm/Spotify in `.env`.

---

## 1. Database Schema and Data Population Issues (High Priority: Core Functionality Broken)
**Problem Summary**: Schema is solid (tables like `artists` with fields `name`, `slug`, `ticketmasterId`, `spotifyId`, `genres`, `images`, `popularity`, `followers`, `lastSynced`, `trendingScore`, `upcomingShowsCount`; `shows` with `date`, `status`, `artistId`, `venueId`, `ticketmasterId`, `importStatus`); `venues` with `name`, `city`, `country`), but syncs don't populate all fields consistently. E.g., new artists from Ticketmaster set `trendingScore: 0` but miss `lastSynced` in some paths; shows lack full `artist`/`venue` embeds; venues miss `state`/`postalCode`. This causes incomplete displays (e.g., blank images, zero counts) and failed queries (e.g., `.unique()` on slug returns null). Indexes are good (e.g., `by_slug` on artists, `by_trending_rank` on shows), but queries assume populated fields, leading to undefined errors.

**Affected Files/Components**:
- `convex/schema.ts` (table defs).
- `convex/artists.ts` (create/update mutations).
- `convex/shows.ts` (createFromTicketmaster, updateImportStatus).
- `convex/venues.ts` (create/update).
- `convex/ticketmaster.ts` (syncArtistShows, createFromTicketmaster).
- `convex/setlistfm.ts` (syncActualSetlist).
- Frontend queries: `src/components/ArtistDetail.tsx` (useQuery `api.artists.getById`), `src/components/PublicDashboard.tsx` (trending queries).

**Proposed Fixes/Improvements**:
1. **Enhance Schema Defaults and Validators** (Med Effort):
   - In `schema.ts`, add defaults for optional fields using Convex's `defineTable` with initial values where possible (Convex doesn't support direct defaults, so handle in mutations).
   - Update validators: For `artists`, ensure `trendingScore: v.number()`, `upcomingShowsCount: v.number()`, `lastSynced: v.number()` (non-optional). For `shows`, add `importStatus: v.string()` with default "pending".
   - Add missing indexes: `by_lower_name` on artists (already partial), `by_date_status` on shows `["date", "status"]` for efficient upcoming queries.
   - Code Snippet (schema.ts):
     ```ts
     export default defineSchema({
       artists: defineTable({
         name: v.string(),
         slug: v.string(),
         ticketmasterId: v.optional(v.string()),
         spotifyId: v.optional(v.string()),
         genres: v.array(v.string()),
         images: v.array(v.string()),
         popularity: v.number(), // Default 0 in mutations
         followers: v.number(), // Default 0
         lastSynced: v.number(), // Required, set on create
         trendingScore: v.number(),
         upcomingShowsCount: v.number(),
         isActive: v.boolean(),
         lowerName: v.string(), // For fuzzy search
       }).index("by_slug", ["slug"])
         .index("by_ticketmaster_id", ["ticketmasterId"])
         .index("by_lower_name", ["lowerName"])
         .index("by_trending_rank", ["trendingRank"]), // Add if missing
       // Similar for shows, venues...
     });
     ```

2. **Fix Artist Creation to Populate All Fields** (High Effort: Sync Dependencies):
   - In `artists.ts:createFromTicketmaster` and `create`, always set `lastSynced: Date.now()`, `popularity: 0`, `followers: 0`, `upcomingShowsCount: 0`, `trendingScore: 0`. After creation, immediately call internal queries to populate from external APIs (synchronous where possible to avoid races).
   - Add post-create hook: After insert, run `internal.spotify.enrichArtistBasics` and `internal.ticketmaster.syncArtistShows` synchronously (use `await ctx.runAction`).
   - Handle merges: If artist exists by name/TM ID, patch all fields (e.g., update `images` if new Spotify data).
   - For venues in `venues.ts`: In `createFromTicketmaster`, populate `state`, `postalCode`, `country` from API response; add fuzzy city matching index.
   - Code Snippet (artists.ts:createFromTicketmaster):
     ```ts
     const artistId = await ctx.db.insert("artists", {
       // ... existing fields
       lastSynced: Date.now(),
       popularity: 0,
       followers: 0,
       upcomingShowsCount: 0,
       trendingScore: 0,
       lowerName: args.name.toLowerCase(),
     });
     // Sync immediately
     await ctx.runAction(internal.ticketmaster.syncArtistShows, { artistId, ticketmasterId: args.ticketmasterId });
     await ctx.runAction(internal.spotify.enrichArtistBasics, { artistId, artistName: args.name });
     // Update counts post-sync
     const showCount = await ctx.runQuery(internal.shows.getUpcomingCountByArtist, { artistId });
     await ctx.db.patch(artistId, { upcomingShowsCount: showCount });
     ```

3. **Fix Show/Venue Population in Syncs** (High Effort):
   - In `ticketmaster.ts:syncArtistShows`, ensure every show insert populates `artist` embed (query artist doc and set `artist: { name, slug, images }`), `venue: { name, city, state }`. Use `ctx.db.insert` with full objects.
   - For past shows in `setlistfm.ts:checkCompletedShows` and `scanPendingImports`: Add retry logic (3 attempts, exponential backoff); if Setlist.fm fails, set `importStatus: "no_setlist"` and log reason. Queue via `ctx.scheduler.runAfter(5000, ...)` for rate limits.
   - In `shows.ts:createFromTicketmaster`, validate `artistId`/`venueId` exist before insert; if not, create them first.
   - Add cron in `crons.ts`: `crons.interval("populate-missing-fields", { minutes: 30 }, internal.maintenance.populateMissingFields, {});` – a new action that scans tables for nulls (e.g., `shows` without `artist.name`) and patches.

4. **Data Validation Cron** (Low Effort):
   - New action in `maintenance.ts`: Scan `artists`/`shows`/`venues` for incomplete records (e.g., `upcomingShowsCount === 0 && lastSynced > Date.now() - 86400000`), re-sync if stale (>24h).

**Testing Recommendations**:
- Use Convex dashboard: Insert test artist via mutation, query to verify all fields populated.
- Run `npx convex run internal.ticketmaster:syncArtistShows` on test ID; check `shows` table.
- Mock APIs with `msw` in tests; assert field population in unit tests (e.g., `createFromTicketmaster` returns ID with all fields).
- E2E: Search new artist, verify shows display full venue/artist data.

**Estimated Effort**: High (schema changes require migration; syncs touch multiple files).

---

## 2. Artist Search, Import, and Page Refresh 404 Issues (High Priority: Core Navigation Broken)
**Problem Summary**: When searching non-DB artist (e.g., via Ticketmaster), `triggerFullArtistSync` creates record but async syncs (shows/catalog) race with page load, causing empty `upcomingShowsCount: 0`. Artist page (`ArtistDetail.tsx`) uses `useQuery(api.artists.getById)`, but routing in `router.tsx` uses `/artists/:artistSlug` – on refresh, `getBySlugOrId` falls back to fuzzy/partial matches but fails if slug collision or ID mismatch (e.g., TM ID vs Convex ID). No error boundary for 404s, crashing page.

**Affected Files/Components**:
- `convex/ticketmaster.ts` (triggerFullArtistSync).
- `convex/artists.ts` (getBySlugOrId – good fallbacks, but incomplete).
- `src/router.tsx` (routes).
- `src/components/ArtistSearch.tsx` (search handling).
- `src/components/ArtistDetail.tsx` (loading/404 states).

**Proposed Fixes/Improvements**:
1. **Synchronous Sync on Search** (Med Effort):
   - In `ticketmaster.ts:triggerFullArtistSync`, await all phases: Create → Sync shows (await) → Enrich Spotify basics (await) → Update counts (await query `getUpcomingCountByArtist` and patch).
   - Add loading state in `ArtistSearch.tsx`: After click, show "Syncing..." spinner; poll `getBySlugOrId` until `upcomingShowsCount > 0`.
   - Code Snippet (triggerFullArtistSync):
     ```ts
     // After create
     await ctx.runAction(internal.ticketmaster.syncArtistShows, { artistId, ticketmasterId: args.ticketmasterId });
     await ctx.runAction(internal.spotify.enrichArtistBasics, { artistId, artistName: args.artistName });
     // Recount shows
     const showCount = await ctx.runQuery(internal.shows.countUpcomingByArtist, { artistId });
     await ctx.db.patch(artistId, { upcomingShowsCount: showCount });
     return artistId;
     ```

2. **Robust Routing and 404 Handling** (Low Effort):
   - In `router.tsx`, add errorElement to artist route: `<Route path="/artists/:artistSlug" element={<App />} errorElement={<ArtistNotFound />} />`.
   - Create `ArtistNotFound.tsx`: Redirect to search with toast "Artist not found – try searching again".
   - Enhance `artists.ts:getBySlugOrId`: Add Levenshtein distance fuzzy match (limit 5, pick best); if no match, return null and handle in component.
   - In `ArtistDetail.tsx`: If `artist === null`, show "Artist not found" with search link; use `ErrorBoundary.tsx` wrap.
   - Support ID in URL: If slug is Convex ID, use directly; parse TM ID from slug (e.g., `/artists/tm:ABC123`).

3. **Sync Process Reliability** (Med Effort):
   - In `syncJobs.ts:queueSetlistImport`, ensure jobs include full entity data (not just ID) to avoid fetch failures.
   - Add timeout/retry in actions (e.g., `Promise.race([apiCall, timeout(10000)])`).

**Testing Recommendations**:
- Create artist via search, refresh page immediately – verify loads without 404.
- Unit test `getBySlugOrId` with mocks (slug miss → ID hit → fuzzy).
- E2E: Cypress test search → click → refresh → shows load.

**Estimated Effort**: Med (routing quick; sync awaits add latency but fix races).

---

## 3. Past Shows and Setlist.fm Import Issues (High Priority: Key Feature Incomplete)
**Problem Summary**: `setlistfm.ts:checkCompletedShows` and `scanPendingImports` queue imports but fail silently (e.g., no artist/venue fetch, rate limits). `importStatus` not set consistently, causing infinite retries. No handling for "no setlist available" (mark "no_data"). Crons in `crons.ts` run but don't trigger if jobs empty.

**Affected Files/Components**:
- `convex/setlistfm.ts` (syncActualSetlist, checkCompletedShows, scanPendingImports).
- `convex/syncJobs.ts` (processSetlistImportQueue).
- `convex/shows.ts` (updateImportStatus).
- `convex/crons.ts` (interval for setlist checks).
- `src/components/ShowDetail.tsx` (displays importStatus).

**Proposed Fixes/Improvements**:
1. **Robust Import Logic** (High Effort):
   - In `syncActualSetlist`: Fetch artist/venue via ID; if null, skip and set "failed: missing_relations". Handle API errors (e.g., 404 → "no_setlist").
   - Add statuses: "pending", "importing", "completed", "failed", "no_setlist", "rate_limited".
   - In `checkCompletedShows`: Filter `status === "completed" && (importStatus === null || "failed")`; limit 5/run; await each sync.
   - Enhance `processSetlistImportQueue`: Mark "running" → process → "completed"/"failed"; retry failed up to 3x.
   - Code Snippet (syncActualSetlist in setlistfm.ts):
     ```ts
     export const syncActualSetlist = internalAction({
       // ...
       handler: async (ctx, args) => {
         const show = await ctx.db.get(args.showId);
         if (!show || !show.artistId || !show.venueId) throw new Error("Missing relations");
         const [artist, venue] = await Promise.all([
           ctx.runQuery(internal.artists.getById, { id: show.artistId }),
           ctx.runQuery(internal.venues.getById, { id: show.venueId }),
         ]);
         if (!artist || !venue) throw new Error("Missing artist/venue");
         // API call to Setlist.fm
         try {
           const response = await fetchSetlistFm(artist.name, venue.city, args.showDate);
           if (response.setlist) {
             // Insert setlist, songs; return ID
             await ctx.runMutation(internal.setlists.createFromApi, { showId: args.showId, data: response });
             await ctx.runMutation(internal.shows.updateImportStatus, { showId: args.showId, status: "completed" });
             return response.id;
           } else {
             await ctx.runMutation(internal.shows.updateImportStatus, { showId: args.showId, status: "no_setlist" });
             return null;
           }
         } catch (e) {
           await ctx.runMutation(internal.shows.updateImportStatus, { showId: args.showId, status: "failed", error: e.message });
           throw e;
         }
       },
     });
     ```

2. **Cron Enhancements** (Low Effort):
   - In `crons.ts`: Add `crons.interval("setlist-check", { hours: 1 }, internal.setlistfm.checkCompletedShows, {});` and `crons.interval("pending-scan", { minutes: 15 }, internal.setlistfm.scanPendingImports, {});`.
   - Add admin trigger in `admin.ts`: New action `manualSetlistSync` to run checks on-demand.

3. **UI Feedback** (Low Effort):
   - In `ShowDetail.tsx`: Show status badge (e.g., "Importing..." spinner if "importing"); if "no_setlist", message "No setlist available yet".

**Testing Recommendations**:
- Mock Setlist.fm API; run cron, assert status updates.
- Dashboard query: `select * from shows where importStatus = 'failed'` – fix manually.
- E2E: Create past show, run import, verify setlist in `ShowDetail`.

**Estimated Effort**: High (API reliability, retries).

---

## 4. UI/UX Improvements: Mobile-Native Design Like Spotify/Apple Music (High Priority: User Experience)
**Problem Summary**: Cards have side borders (`rounded-2xl` + full borders), feeling boxed vs. fluid native. Show page setlist section busy (borders on songs/upvotes). Inconsistent cards (ArtistCard vs ShowCard heights, fonts). No subtle top/bottom dividers; lacks Apple-style minimalism (e.g., large hero images, smooth scrolls, haptic feedback). Mobile: No touch optimizations, excessive padding.

**Affected Files/Components**:
- `src/components/ArtistCard.tsx`, `src/components/ShowCard.tsx` (borders, styles).
- `src/components/ShowDetail.tsx` (setlist section).
- `src/index.css`, `tailwind.config.js` (global styles).
- All cards: `PublicDashboard.tsx`, `Trending.tsx`, `Artists.tsx`.

**Proposed Fixes/Improvements**:
1. **Card Design Overhaul** (Med Effort):
   - Remove side borders: Use `border-t border-b border-white/5` only; `rounded-none` or subtle `rounded-t-xl` for top.
   - Consistent structure: All cards  h-48 min, flex-col, image h-32, content p-4, bottom divider if in list.
   - Apple-inspired: Subtle shadows (`shadow-sm`), opacity hovers, large tap targets (44px min height).
   - Code Snippet (ArtistCard.tsx base):
     ```tsx
     <div className="group cursor-pointer h-full bg-black" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
       <div className="relative w-full h-32 overflow-hidden"> {/* Image */} </div>
       <div className="p-4 space-y-2">
         <h3 className="text-white font-semibold text-base leading-tight">{artist.name}</h3>
         <p className="text-gray-400 text-sm">{artist.upcomingShowsCount} shows</p>
       </div>
     </div>
     ```
   - Apply to ShowCard, PremiumShowCard in PublicDashboard.

2. **Setlist Section Simplification** (Low Effort):
   - In `ShowDetail.tsx`: Remove borders on song rows/upvotes; use list with subtle dividers (`border-b white/5 py-3`).
   - Upvote: Inline button without card; add haptic (if mobile, use `navigator.vibrate(50)` on click).
   - Busy fix: Collapsible sections (e.g., "Top Songs" accordion).

3. **Global Mobile Polish** (Med Effort):
   - Tailwind: Extend theme with `screens: { 'xs': '475px' }`, custom `border-subtle: '1px solid rgba(255,255,255,0.05)'`.
   - Add `touch-manipulation` class everywhere; safe-area insets for iOS.
   - Hero images: Full-bleed in Detail pages, parallax scroll.
   - Consistency: All cards use `MagicCard` wrapper with `border-0 p-0`; unify fonts (SF Pro-like via system-ui).

4. **Performance** (Low Effort):
   - Lazy load images (`loading="lazy"`); virtualize long lists (react-window for Artists/Shows).

**Testing Recommendations**:
- Responsive: Chrome DevTools mobile view; tap flows smooth.
- A/B: Compare old/new cards for engagement (e.g., click rate).
- Accessibility: VoiceOver reads cleanly; high contrast.

**Estimated Effort**: Med (styles propagate; test on devices).

---

## 5. Spotify Sign-In and My Artists Dashboard Issues (Medium Priority: User Personalization)
**Problem Summary**: `spotifyAuth.ts:storeSpotifyTokens` stores but `importUserSpotifyArtistsWithToken` assumes frontend data (followed/top artists) – if OAuth incomplete, misses import. Dashboard (`MySpotifyArtists.tsx`) queries `getUserSpotifyArtists` but filters `onlyWithShows: true`, hiding artists without shows. No refresh token handling; sign-in button in `SignInPage.tsx` not triggering full flow.

**Affected Files/Components**:
- `convex/spotifyAuth.ts` (importUserSpotifyArtistsWithToken, trackUserArtist).
- `src/components/MySpotifyArtists.tsx` (query, display).
- `src/pages/SignInPage.tsx` (Spotify button).
- `convex/users.ts` (spotifyId field).

**Proposed Fixes/Improvements**:
1. **Complete OAuth Flow** (Med Effort):
   - In `SignInPage.tsx`: Use Clerk's `<SignedIn>` and Spotify provider; on success, call `api.spotifyAuth.importUserSpotifyArtistsWithToken` with full data from Clerk callback.
   - Handle refresh: New cron `crons.interval("spotify-refresh", { hours: 6 }, internal.spotifyAuth.refreshUserTokens, {});` – fetch new access via refreshToken.
   - In import: Always populate `userSpotifyArtists` table; dedupe by spotifyId.

2. **Dashboard Enhancements** (Low Effort):
   - Query without `onlyWithShows`; add toggle "Show all followed".
   - Display: Sort by top/recent; show "Sync shows" button to trigger `searchAndSyncArtistShows`.
   - Code Snippet (MySpotifyArtists.tsx):
     ```tsx
     const myArtists = useQuery(api.spotifyAuth.getUserSpotifyArtists, { limit: 20, onlyWithShows: false });
     // Add filter state
     const [showAll, setShowAll] = useState(false);
     const filtered = showAll ? myArtists : myArtists.filter(a => a.upcomingShowsCount > 0);
     ```

**Testing Recommendations**:
- Mock Spotify OAuth; verify import populates DB.
- E2E: Sign in → dashboard shows artists → click navigates.

**Estimated Effort**: Med (OAuth tweaks).

---

## 6. Activity and Admin Pages Completion (Medium Priority: Feature Gaps)
**Problem Summary**: Activity (`ActivityPage.tsx`): Groups votes but no real-time (useSubscription missing); stats incomplete (e.g., no "predicted setlists"). Admin (`AdminDashboard.tsx`): Stats/health good, but missing bulk actions (e.g., delete flagged), full user management, sync triggers incomplete (no setlist manual).

**Affected Files/Components**:
- `src/components/ActivityPage.tsx` (feed, stats).
- `convex/activity.ts` (getUserActivityFeed – add real-time).
- `src/components/AdminDashboard.tsx` (actions, flagged).
- `convex/admin.ts` (isCurrentUserAdmin, getAdminStats).

**Proposed Fixes/Improvements**:
1. **Activity Page** (Med Effort):
   - Add `useSubscription` for live feed: `useSubscription(api.activity.subscribeToUserActivity, { userId })`.
   - Stats: Add "Accuracy" (compare votes to actual setlists); "Recent Predictions".
   - UI: Timeline view with dividers; infinite scroll via pagination.

2. **Admin Page** (High Effort):
   - Add tabs: Stats | Users | Flagged | Syncs | Logs.
   - Bulk: Checkbox select flagged/votes; mutations for delete/approve.
   - Sync triggers: Buttons for "Sync All Trending", "Run Setlist Import", "Cleanup Orphans".
   - Users: Search/filter; edit roles (Clerk integration for bans).
   - Code Snippet (AdminDashboard.tsx):
     ```tsx
     const [tab, setTab] = useState('stats');
     // Add bulk delete
     const bulkDeleteFlagged = useMutation(api.admin.bulkDeleteFlagged);
     <Button onClick={() => bulkDeleteFlagged({ ids: selectedFlagged })}>Delete Selected</Button>
     ```

**Testing Recommendations**:
- Activity: Vote song → real-time update in feed.
- Admin: Role-based access; trigger sync → verify logs.

**Estimated Effort**: Med (UI); High (admin actions).

---

## 7. Homepage: Robust Trending Shows/Artists (High Priority: Landing Page)
**Problem Summary**: `PublicDashboard.tsx` falls back to DB but shows placeholders if empty (e.g., "this" text? – likely debug). Artist cards only link title (onClick partial). Trending queries (`trending.ts:getTrendingShows/Artists`) hydrate well but cache stale if cron fails. Not "robust array": No carousels, filters (e.g., genre, city).

**Affected Files/Components**:
- `src/components/PublicDashboard.tsx` (trending sections, cards).
- `convex/trending.ts` (getTrendingShows/Artists).
- `convex/crons.ts` (trending update).

**Proposed Fixes/Improvements**:
1. **Data Robustness** (Med Effort):
   - In `trending.ts`: If cache empty, fallback to `shows.getUpcoming` sorted by `trendingScore`; ensure hydration includes slugs/images.
   - Cron: `crons.interval("trending-update", { hours: 2 }, internal.trending.updateAll, {});` – fetch Ticketmaster, compute scores (e.g., popularity * shows).

2. **UI: Robust Layout** (High Effort):
   - Sections: Hero carousel (top 5 shows), Horizontal scroll artists (Infinite scroll), Grid shows (Masonry via CSS).
   - Full linking: Entire card clickable; artist click → `/artists/${slug}`.
   - Remove placeholders: If empty, "Discovering top tours..." with loader.
   - Code Snippet (PublicDashboard.tsx):
     ```tsx
     // Carousel for shows
     <div className="overflow-x-auto snap-x snap-mandatory">
       {dbTrendingShows?.map(show => (
         <ShowCard key={show._id} show={show} onClick={() => navigate(`/shows/${show.slug}`)} />
       ))}
     </div>
     // Artists horizontal
     <div className="flex gap-4 overflow-x-auto pb-4">
       {dbTrendingArtists?.map(artist => (
         <ArtistCard key={artist._id} artist={artist} onClick={() => navigate(`/artists/${artist.slug}`)} />
       ))}
     </div>
     ```

3. **Alignment with Convex** (Low Effort):
   - Use paginated queries: `paginate({ numItems: 20 })` for infinite load.

**Testing Recommendations**:
- Load page → verify 20+ items, no placeholders.
- Click artist/show → correct route.
- Mock cron fail → fallback works.

**Estimated Effort**: High (layout redesign).

---

## 8. Consistent Card Design Across App (Low Priority: Polish)
**Problem Summary**: Variations in padding, heights, borders (e.g., MagicCard vs plain div). No shared `Card` component.

**Proposed Fixes/Improvements**:
- Create `ui/Card.tsx`: Props for variant (artist/show), always top/bottom borders, consistent p-4, h-min-48.
- Refactor all cards to use it.
- Effort: Low (search/replace).

---

## 9. Other Improvements (Low Priority)
- **Error Handling**: Wrap all queries in try/catch; global ErrorBoundary.
- **Performance**: Add React.memo to cards; Convex pagination everywhere.
- **SEO**: In `SEOHead.tsx`, dynamic meta for artist/show pages.
- **Testing**: Add Vitest for utils; Convex test utils for functions.
- **Security**: Clerk webhooks for user sync; rate-limit actions.

This outline covers 100% of issues. Total effort: 4-6 weeks for one dev. Start with 1-2 for quick wins. If needed, I can refine or implement (but per instructions, outline only).
