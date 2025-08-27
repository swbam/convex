TheSet – Ultra‑Detailed Product Requirements Document (PRD)
1 Project Vision & Goals
The Set is a modern web application that lets concert‑goers vote on songs they want to hear at upcoming shows, track set‑lists in real time and discover artists.  It must deliver:
Discovery – let users explore artists, shows, venues and songs with rich metadata; surface trending acts and upcoming events.

Engagement – allow logged‑in fans to follow artists, contribute set‑lists and up‑vote/down‑vote songs.

Collaboration – empower concert‑goers to build predicted set‑lists, verify real set‑lists and curate show pages.

Transparency – provide real‑time progress as the system imports artist catalogues and event data via server‑sent events (SSE) and background workers .

Reliability – maintain freshness of data with automated background jobs for active and trending artists and full system maintenance .

Performance – deliver fast page loads, efficient database queries and intelligent caching; monitor key performance metrics and alert on failures .

2 Target Users & Personas
Music Fans – people who want to browse artists, discover upcoming shows and vote on songs.

Concert Goers – attendees who contribute and verify set‑lists for past shows.

Industry Professionals – promoters and management teams interested in show metrics.

Venue Operators – maintain venue information and manage event listings.

3 Functional Overview

3.1 Artist Discovery & Profiles
Search & Discovery – full‑text search across artists using the Ticketmaster API; the global search bar queries only the artists endpoint (not shows or venues) and returns artist names, images and popularity.  Search results can be filtered by genre or popularity but are limited to artists.

Artist Profile – each artist page displays biography, images, genres, popularity, follower counts and links to official pages.

Upcoming & Past Shows – list upcoming events with date, venue, city, ticket links and sold‑out status; show history includes set‑list data.

Trending Artists – algorithmically identify trending artists based on recent shows, vote counts and followers (see section 5.2).

3.2 Show & Venue Management
Show Pages – display event details, location, ticket information, status (upcoming/ongoing/completed/cancelled) and embedded set‑lists.

Venue Profiles – maintain venue name, address, capacity, geographic coordinates (for mapping), past and upcoming show lists.

Venue Discovery – users can browse venues and filter by city, capacity or upcoming events.

3.3 Set‑list & Voting System
Predicted Set‑lists – users assemble predicted set‑lists for upcoming shows, selecting songs from the artist’s catalogue.

Voting – community can up‑vote or down‑vote songs on a predicted set‑list; vote counts are denormalised for performance.

Actual Set‑lists – after a show, the system imports the real set‑list from external APIs (e.g., setlist.fm); community members can verify or correct them.

Accuracy Scoring – predicted lists are scored against actual set‑lists for gamification.

3.4 Search & Discovery
Global Search – unified search bar across the app but limited to artists; uses the Ticketmaster API’s artist search endpoint.  Users cannot search shows or venues from this bar.

Search Result Cards – results include image, name and popularity; clicking navigates to the artist page.

Filtering & Sorting – filter by genre or popularity; sort by alphabetical order or trending status.

3.5 Authentication & User Management
User Accounts – support email/password, Google and Spotify login; optional magic‑link login for passwordless access.

OAuth Integration – integrate with Spotify to personalise discovery and enable features requiring Spotify scopes (e.g., library read).

Session Management – maintain persistent sessions on client and server; handle refresh tokens and auto refresh.

Role‑Based Access Control – roles include user, moderator and admin. Moderators can curate set‑lists and manage content; admins have full privileges.

User Profiles – users can view and edit their profile, including avatar, favourite artists and show history.

Security – enforce password policies, CSRF protections, rate limiting and secure cookies.

3.6 Real‑Time Features & Notifications
Server‑Sent Events (SSE) – deliver real‑time updates during import and sync operations.  As a job processes, the server publishes progress updates to a channel; clients connected via SSE receive JSON messages showing the current stage and percentage complete .

Live Voting Updates – update vote counts on set‑lists without page refresh; use websockets or SSE channels for live changes.

4 System Architecture

4.1 High‑Level Architecture
The system follows a modular architecture with a web application, background workers and shared packages:
TheSet
├── Web Client             # React/Next.js web application
│   ├── Pages & Routes     # Artists, shows, venues, set‑lists, account
│   ├── Components         # Shared UI, music‑specific components
│   └── API Routes         # Import, sync, search, authentication
├── Worker Processes       # Background jobs using a queue (e.g., BullMQ)
│   ├── Job Queue          # Redis‑backed queue for import tasks
│   ├── Cron Scheduler     # Schedules periodic sync tasks
│   └── Workers            # Execute jobs and publish progress
├── Database & Storage     # PostgreSQL database with RLS; object storage for images
├── Caching Layer          # Redis primary cache; in‑memory LRU fallback; edge caching
└── External Services      # Spotify, Ticketmaster, Setlist.fm; Email; CDN

4.2 Data Flow & Multi‑Phase Import
When a user searches for an artist not yet in the database, the system initiates a multi‑phase import flow to provide instant feedback while processing large datasets :
Phase 1 – Instant Response (≤ 3 s) – create a placeholder artist record with basic identifiers (name, external IDs, slug) and return the artist page; this synchronous step ensures the user sees a page immediately .

Phase 2 – Show & Venue Import (3–15 s) – in the background, queue a job to fetch upcoming and recent shows from Ticketmaster, create venue records and attach them to the artist.  Progress is streamed to the client via SSE .

Phase 3 – Full Catalog Import (15–90 s) – import the artist’s complete studio catalogue from Spotify, filter live and remix tracks, deduplicate by ISRC and update the database .

Phase 4 – Ongoing Sync – recurring cron jobs (see section 5) keep artist data current by syncing active artists, trending artists and performing full catalogue refreshes .

The system stores progress in a sync_jobs table with fields for status, type, priority and retry counts, and uses a related sync_progress table to track steps and metrics such as items processed, success/failure counts and messages .

4.3 Caching Strategy
A multi‑layer caching system improves performance and reduces external API calls :
Redis Primary Cache – centralised cache with pattern‑based invalidation and clustering support.

Smart Prefetching – predictive cache warming for popular artists/shows based on trending data.

Artists – core artist data including Ticketmaster, Spotify and MusicBrainz identifiers, names, slugs, images, genres, popularity metrics, follower counts and sync timestamps .

Songs – individual tracks with Spotify identifiers, metadata (title, album, track number, duration, popularity) and flags such as live/remix .

Shows – events with date, start time, status (upcoming/ongoing/completed/cancelled), Ticketmaster ID, venue ID, headliner artist ID and associated metrics .

Venues – venues with location, capacity and geographic coordinates (via PostGIS); relationship to shows.

Setlists – predicted or actual set‑lists linked to shows and artists, with accuracy score, vote counts and moderation status .

SetlistSongs – junction table connecting set‑lists to songs with position order, notes, play time and vote counts .

ArtistSongs – many‑to‑many junction table between artists and songs, with isPrimaryArtist flag .

Votes – up‑vote/down‑vote records for set‑list songs (upvotes − downvotes yields net_votes); triggers update vote totals.

Follows – user_follows_artists linking users to followed artists for notifications.

SyncJobs & SyncProgress – track import jobs and progress as described above .

4.5 External API Clients & Services
For data import and enrichment, the system integrates with several external services:
Spotify API – fetches artist profiles, albums, tracks and audio features; requires OAuth 2.0 authentication; rate‑limited at ~100 requests per minute.

Ticketmaster API – retrieves upcoming and past shows, venue details and ticket links; uses API key authentication.  For search, only the Ticketmaster artist search endpoint is used to ensure the global search returns artists exclusively.

Setlist.fm API – obtains historical set‑lists with minimal rate limits; used to fetch actual set‑lists after shows.

SpotifySyncJob – syncs an artist’s Spotify data (profile, albums, tracks or full import) .

TicketmasterSyncJob – syncs shows or venues from Ticketmaster .

5 Background Jobs & Cron System

5.1 Active Artists Sync
Purpose – refresh data for artists with recent user activity (votes, follows, page views).

Schedule – every 6 hours via the cron scheduler .

5.2 Trending Artists Sync
Purpose – deep refresh for top trending artists to keep trending lists fresh.

Schedule – daily at 02:00 (server time) .

Features – refresh complete discographies, filter live tracks and duplicates, optimise album art caching, implement smart retry logic and store progress for monitoring .

5.3 Complete Catalog Sync
Purpose – weekly maintenance to ensure data integrity across all artists, shows, venues and songs .

Process – multi‑phase execution:

Sync artists (ensuring all basic info is up to date).

Sync shows for each artist.

Perform data cleanup (remove duplicates and orphaned records).

Run integrity checks (e.g., verifying foreign keys).

Rate Limits – apply conservative delays (e.g., 5 s) between batches to respect external API limits .

6 User Interface & Experience

6.1 Design System & Components
Atomic Design – UI components follow a hierarchy of atoms (buttons, inputs, badges), molecules (cards, search boxes) and organisms (grids, lists).

Music‑Specific Components – artist cards display images, names, genres and follower counts; show cards summarise event details; vote buttons allow up‑voting/down‑voting songs.

Templates & Layouts – page layouts for artist pages, show pages, set‑lists, auth pages and dashboards; responsive design with mobile optimisations.

Theming – extend base theme with music‑specific colours (Spotify green, stage orange) and typography tokens.

6.2 Pages & Navigation
Home Page – display trending artists/shows, search bar and quick links.

Artist Page – includes biography, upcoming shows, song catalogue preview, trending songs and follow button.

Show Page – event details, ticket links, predicted/actual set‑list with voting and comments, venue information and interactive map.

Venue Page – lists upcoming and past shows, capacity and location.

User Dashboard – manage profile, followings, contributions and notifications.

Admin/Moderator Pages – manage flagged content, oversee votes and verify set‑lists.