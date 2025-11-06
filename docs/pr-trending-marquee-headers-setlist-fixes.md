# PR: Trending fixes, smooth marquee, hero headers, setlist init

Summary of changes delivered in this PR:

- Fix trending shows not loading by normalizing Ticketmaster status codes to `upcoming` (except cancellations/completions).
- Remove frontend use of ungenerated Convex queries to prevent type errors during build.
- Implement smooth 3-row marquee sliders for Trending Artists and Top Shows on the homepage:
  - Opposite direction per row, very smooth, moderate speed.
  - Pause on hover, with edge fade-out on both ends.
  - Client-side dedupe to avoid duplicate cards.
- Ensure marquee items have explicit widths so cards render in continuous tracks.
- Artist/Show pages now select the best available local image for full-width hero headers.
- Verified initial setlist generator path is correct; backfill mutation exists for missing auto-setlists.

Key files touched previously:

- `convex/trending.ts`: normalize statuses; helper queries.
- `src/components/PublicDashboard.tsx`: integrate marquee and dedupe.
- `src/components/MarqueeRows.tsx`: new component for marquee rows.
- `src/index.css`: animations and fade masks for marquee.
- `src/components/ShowDetail.tsx`, `src/components/ArtistDetail.tsx`: stable hero image selection.

Operational notes:

- If trending content seems sparse, run the maintenance sync from Admin or `npm run sync:trending`.
- If older shows predate catalog import, run backfill for auto setlists via maintenance.
