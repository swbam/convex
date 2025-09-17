# Convex Backend Overview

This application uses [Convex](https://docs.convex.dev) for all backend data storage,
API routes, and background jobs. The code lives in the `convex/` directory and is
written entirely in TypeScript.

## Data Model

The schema is defined in [`convex/schema.ts`](convex/schema.ts). Key tables include:

- **`users`** – profile information linked to Clerk (`authId`, `email`, `username`, role, preferences).
- **`artists`** – core metadata from Spotify/Ticketmaster with trending scores and sync timestamps.
- **`venues`** – venue details including optional geolocation data.
- **`shows`** – one document per event. Stores the artist/venue references, date, status (`upcoming`, `completed`, `cancelled`), and
  external identifiers (`ticketmasterId`, `setlistfmId`).
- **`setlists`** – holds community predictions and official setlists. Important fields:
  - `songs`: for predictions this is the community queue; for official entries it's a normalized
    copy of the confirmed tracks so legacy UIs keep working (array of `{ title, album, duration,
    songId }`).
  - `actualSetlist`: the confirmed setlist from setlist.fm (`{ title, setNumber, encore, ... }`).
  - `isOfficial`: `true` for canonical setlist.fm entries, `false` for community predictions.
  - `accuracy`/`comparedAt`: cached prediction accuracy once an official setlist is known.
- **`votes`** – user-level votes for entire setlists (`accurate` vs `inaccurate`).
- **`songVotes`** – per-song up-votes used to power the “fan favorite” UI badges.
- **`syncJobs`**, **`syncStatus`** – background job queues and health tracking for the Spotify/Ticketmaster import pipeline.

Indexes are defined for the common access patterns (by slug, by status, by show, etc.) to keep queries reactive and efficient.

## Authentication

Authentication is handled by Clerk. The Convex configuration lives in
[`convex/auth.config.ts`](convex/auth.config.ts) and [`convex/auth.ts`](convex/auth.ts):

- `auth.config.ts` wires up Clerk JWT verification for both `dev` and `prod` issuers.
- `auth.ts` exposes helpers such as `getAuthUserId`, `createAppUser`, and the
  `loggedInUser` query which maps Clerk users to the internal `users` table.

## Shows & Setlists Workflow

### Creating and Updating Predictions
- `setlists.create` / `setlists.addSongToSetlist` manage the community prediction for a show.
  Anonymous users may add a limited number of songs before authentication is required.
- `setlists.submitVote` and `songVotes.voteOnSong` record fan sentiment about a prediction or a specific song.

### Importing Actual Setlists
Setlist.fm integration lives in [`convex/setlistfm.ts`](convex/setlistfm.ts):

1. **Cron Trigger** – `crons.ts` schedules `internal.setlistfm.checkCompletedShows` every 6 hours.
   The action marks past `shows` as `completed` and calls `syncActualSetlist` for each one.
2. **External Lookup** – `syncActualSetlist` queries the setlist.fm REST API using
   multiple search strategies (by artist, city, date) to find the best matching setlist.
3. **Persistence** – `setlists.updateWithActualSetlist` updates the data model:
   - attaches the `actualSetlist` to the shared community prediction (and computes accuracy),
   - creates or refreshes an official `setlists` document for archival data,
   - updates the `shows` document with the `setlistfmId`, `status: "completed"`, and a fresh `lastSynced` timestamp.

The frontend show page subscribes to `setlists.getByShow`, so once the mutation finishes the
confirmed setlist automatically replaces the prediction UI.

## Show Queries

[`convex/shows.ts`](convex/shows.ts) exposes helpers used across the app:
- `getUpcoming`, `getRecent`, `getRecentlyUpdated` – for dashboard sections.
- `getBySlugOrId` – resolves either a Convex document ID or SEO slug.
- `markCompleted` – internal mutation used by the cron job before fetching setlists.

Slug generation happens inside `shows.ts` to keep artist/venue/date combinations SEO friendly.

## Additional Integrations

- [`spotify.ts`](convex/spotify.ts) & [`spotifyAuth.ts`](convex/spotifyAuth.ts) manage catalog imports and user-connected Spotify accounts.
- [`ticketmaster.ts`](convex/ticketmaster.ts) fetches upcoming events and creates venue/show records.
- [`maintenance.ts`](convex/maintenance.ts) contains housekeeping jobs (trending recalculations, data cleanup, etc.).

## Cron Jobs

[`convex/crons.ts`](convex/crons.ts) registers interval jobs with Convex:

- `update-trending` – refresh artist/show trending scores.
- `fix-missing-artist-data` – backfills Spotify data if something failed during an import.
- `data-cleanup` – removes orphaned records.
- `check-completed-shows` – runs the setlist.fm sync described above.

Convex automatically runs these jobs on the hosted deployment; no additional scheduler is required.

## Development Tips

- Run `npm run dev` to start both the Vite frontend and Convex backend locally.
- Convex functions are reactive: any mutation of a document invalidates subscribed queries (e.g. the show page).
- Use `npx convex dashboard` during development to inspect database documents and logs in real time.
