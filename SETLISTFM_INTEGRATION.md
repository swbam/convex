# Setlist.fm API Integration

This document describes how the application fetches and stores official setlists after a show
has completed.

## Overview
- Fetch the confirmed setlist from setlist.fm.
- Mark the show as completed and store the `setlistfmId` on the show document.
- Merge the confirmed songs into the community prediction so accuracy can be calculated.
- Create (or update) an official setlist record for archival purposes.

## API Functions

### Public Actions
- **`triggerSetlistSync`** – manually sync one show by providing the `showId`, artist name, venue city, and show date.
- **`triggerCompletedShowsCheck`** – batch job that scans all upcoming shows, marks past ones as completed, and attempts to sync their official setlists.

### Internal Actions & Mutations
- **`syncActualSetlist`** – executes the external HTTP requests to setlist.fm. It tries multiple search strategies (by artist + city + date, by artist + date, and by artist only) to maximise hit rate.
- **`checkCompletedShows`** – invoked by the cron job. Finds any `shows` with `status: "upcoming"` and a date before today, marks them as completed, and calls `syncActualSetlist`.
- **`setlists.updateWithActualSetlist`** – persists the results:
  - Updates the community prediction with the `actualSetlist`, `setlistfmId`, and computed accuracy.
  - Inserts or refreshes an official `setlists` document flagged with `isOfficial: true`.
  - Patches the `shows` document with `status: "completed"`, `setlistfmId`, and `lastSynced`.

## Database Shape

```ts
setlists: {
  showId: Id<"shows">,
  userId?: Id<"users">,
  songs: Array<{
    title: string;
    album?: string;
    duration?: number;
    songId?: Id<"songs">;
  }>,
  actualSetlist?: Array<{
    title: string;
    setNumber: number;
    encore: boolean;
    album?: string;
    duration?: number;
  }>,
  isOfficial?: boolean,
  source: "user_submitted" | "setlistfm",
  lastUpdated: number,
  confidence?: number,
  upvotes?: number,
  downvotes?: number,
  setlistfmId?: string,
  setlistfmData?: unknown,
  accuracy?: number,
  comparedAt?: number,
}
```

The frontend reads `setlists.getByShow`, which returns both the community prediction and any
official setlist. Once `actualSetlist` exists, the show page automatically switches to the
“Official Setlist” view.

## Testing

For development you can trigger the flow manually:

```bash
# Start dev servers
npm run dev

# In another terminal, trigger the completed shows check
npx convex run setlistfm:triggerCompletedShowsCheck
```

Alternatively, call `api.setlistfm.triggerSetlistSync` from the Convex dashboard with the
appropriate arguments to fetch a single show. Watch the Convex logs to see which setlist.fm
entry was matched.

## Rate Limits

Setlist.fm does not publish strict rate limits but recommends spacing requests. The sync code
includes a one second delay between show syncs when iterating over completed shows to stay
within expected usage.
