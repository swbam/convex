# Architecture Overview

## Auth
- Clerk provides identity. Backend reads identity via `ctx.auth.getUserIdentity()`.
- App users stored in `users` with `authId` index.
- Webhooks from Clerk post to `/webhooks/clerk`; Svix signatures verified with `CLERK_WEBHOOK_SECRET`.
- Users are created/updated via `users.upsertFromClerk` and `auth.ensureUserExists`.

## Data Model (Convex tables)
- `artists`, `venues`, `shows`, `setlists`, `songs`, `artistSongs`
- Engagement: `votes`, `songVotes`
- Trending caches: `trendingArtists`, `trendingShows`
- Ops: `syncJobs`, `maintenanceLocks`, `errorLogs`, `spotifyTokens`

## Sync & Imports
- Ticketmaster: artist shows via `ticketmaster.syncArtistShows`.
- Spotify: catalog via `spotify.syncArtistCatalog` and basics via `spotify.enrichArtistBasics`.
- setlist.fm: actual setlists via `setlistfm.syncActualSetlist`.
- Orchestration: `ticketmaster.triggerFullArtistSync` schedules phases with centralized delays.
- Queue: `syncJobs.processSetlistImportQueue` (single-runner with `maintenanceLocks`).

## Trending & Engagement
- `trending.updateEngagementCounts` derives `show.setlistCount` and `show.voteCount`.
- Ranking updates: `updateArtistShowCounts`, `updateArtistTrending`, `updateShowTrending`.
- `maintenance.syncTrendingData` runs engagement first, then ranking, then cache refresh.

## Crons
- See `convex/crons.ts`. Key cadences:
  - Trending every 4h (engagement inside)
  - Engagement every 1h
  - Completed shows scan every 2h
  - Spotify refresh every 12h

## Error Tracking & Health
- Centralized `errorTracking.logError` writes to `errorLogs`.
- `/health` HTTP and `health.validateEnvironment` action verify env configuration.


