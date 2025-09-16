# Manual Regression Checklist

Use this list before shipping changes to confirm the core music fan flows still work.

1. **Search & Artist Import**
   - Start the dev servers (`npm run dev`).
   - Search for a new artist (e.g. "Treaty Oak Revival") and start an import.
   - Wait for the background job to finish and ensure the artist, shows, and catalog records appear.

2. **Artist Page**
   - Verify upcoming shows render with venue/location data.
   - Open at least one show from the artist page.

3. **Show Page – Predictions**
   - Confirm the shared community setlist shows five seeded songs.
   - Add a song from the dropdown; the entry should appear instantly without refreshing.
   - Up-vote a song; the vote count should update in real time.

4. **Show Page – Actual Setlist (after a completed show)**
   - Run the setlist sync (`npx convex run setlistfm:triggerCompletedShowsCheck` or trigger the cron).
   - The UI should switch to “Official Setlist” with the setlist.fm data.
   - Confirm the fan prediction accuracy summary calculates correctly and the “fan favorite” badges appear for songs that were requested.

5. **Authentication Guardrails**
   - Sign out and try to add more than two songs/votes; the UI should prompt for sign-in.
   - Sign in with Clerk and repeat the actions with unlimited access.

6. **Dashboard & Trending**
   - Visit `/`, `/trending`, and `/activity` to make sure data loads without errors.

If any step fails, inspect Convex logs (`npx convex dashboard`) and browser console output before deploying.
