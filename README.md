# setlists.live — Crowdsourced Concert Setlist Predictions

**setlists.live** is a real-time web application that enables music fans to discover upcoming concerts, predict setlists, vote on songs, and compare their predictions against actual setlists from Setlist.fm. Built with React 19, Convex (real-time backend), Clerk (authentication), and integrations with Ticketmaster, Spotify, and Setlist.fm APIs.

The platform features a sophisticated multi-phase data synchronization system that:
1. **Discovers trending artists and shows** from Ticketmaster
2. **Enriches artist data** with Spotify metadata (popularity, followers, images, genres)
3. **Imports song catalogs** from Spotify for setlist predictions
4. **Fetches actual setlists** from Setlist.fm after concerts complete
5. **Compares predictions** to actual performances, tracking user accuracy

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Database Schema](#database-schema)
4. [Sync System Architecture](#sync-system-architecture)
5. [Cron Jobs](#cron-jobs)
6. [API Integrations](#api-integrations)
7. [Key Convex Functions](#key-convex-functions)
8. [Authentication](#authentication)
9. [Admin Dashboard](#admin-dashboard)
10. [Frontend Architecture](#frontend-architecture)
11. [Environment Variables](#environment-variables)
12. [Development](#development)
13. [Deployment](#deployment)
14. [Recent Implementations](#recent-implementations)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Framer Motion |
| UI Components | Radix UI, shadcn/ui, MagicUI |
| Backend | Convex (real-time serverless functions) |
| Authentication | Clerk (OAuth, Email, Social logins) |
| Database | Convex (document-based, real-time subscriptions) |
| APIs | Ticketmaster Discovery, Spotify Web API, Setlist.fm |
| Styling | Tailwind CSS with next-themes (dark/light mode) |
| Deployment | Vercel (frontend), Convex Cloud (backend) |

---

## Project Structure

```
convex-app/
├── convex/                    # Backend (Convex functions)
│   ├── schema.ts              # Database schema definitions
│   ├── crons.ts               # Scheduled background jobs
│   ├── http.ts                # HTTP endpoints (webhooks)
│   ├── admin.ts               # Admin dashboard functions
│   ├── admin/                 # Admin sub-modules
│   │   └── errorMonitoring.ts # Error tracking & Sentry integration
│   ├── artists.ts             # Artist CRUD & queries
│   ├── shows.ts               # Show/concert management
│   ├── songs.ts               # Song catalog management
│   ├── setlists.ts            # Setlist predictions & voting
│   ├── songVotes.ts           # Individual song upvotes
│   ├── trending.ts            # Trending calculations & caching
│   ├── ticketmaster.ts        # Ticketmaster API integration
│   ├── spotify.ts             # Spotify API (catalog sync)
│   ├── setlistfm.ts           # Setlist.fm API (actual setlists)
│   ├── maintenance.ts         # Cleanup & maintenance jobs
│   ├── syncJobs.ts            # Background job queue
│   ├── notifications.ts       # Email notifications via Resend
│   └── deployment.ts          # Post-deployment hooks
├── src/                       # Frontend (React)
│   ├── components/            # React components
│   │   ├── ui/                # shadcn/ui & MagicUI components
│   │   ├── AppLayout.tsx      # Main layout with navigation
│   │   ├── PublicDashboard.tsx# Homepage
│   │   ├── ArtistDetail.tsx   # Artist page
│   │   ├── ShowDetail.tsx     # Show page with setlist voting
│   │   ├── AdminDashboard.tsx # Admin controls
│   │   └── ...
│   ├── pages/                 # Route pages
│   ├── hooks/                 # Custom React hooks
│   ├── main.tsx               # App entry point with providers
│   └── index.css              # Global styles & theme variables
├── scripts/                   # Build & deployment scripts
└── package.json
```

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (synced from Clerk via webhooks) |
| `artists` | Artist profiles with Spotify/Ticketmaster IDs |
| `venues` | Concert venues with location data |
| `shows` | Individual concerts linking artists to venues |
| `songs` | Song catalog (from Spotify) |
| `artistSongs` | Many-to-many: artists ↔ songs |
| `setlists` | Predicted setlists with songs array |
| `songVotes` | Individual song upvotes within setlists |
| `votes` | Overall setlist accuracy votes |

### Sync & Caching Tables

| Table | Purpose |
|-------|---------|
| `trendingArtists` | Cached trending artists from Ticketmaster |
| `trendingShows` | Cached trending shows from Ticketmaster |
| `syncJobs` | Background job queue with progress tracking |
| `syncStatus` | Global sync state |
| `maintenanceLocks` | Prevents overlapping maintenance runs |

### Admin & Monitoring Tables

| Table | Purpose |
|-------|---------|
| `errorLogs` | Error tracking with Sentry integration |
| `userActions` | Audit log for rate limiting |
| `contentFlags` | User-reported content moderation |
| `cronSettings` | Admin-configurable cron intervals |
| `clerkWebhookEvents` | Idempotency tracking for webhooks |

---

## Sync System Architecture

The app uses a **progressive import system** that fetches data on-demand and in the background:

### Phase 1: Artist Discovery
When a user searches or views trending content:
1. Ticketmaster API returns artist with `ticketmasterId`
2. Artist record created with `syncStatus.phase = "basics"`
3. Spotify API enriches: name matching → `spotifyId`, `followers`, `popularity`, `images`

### Phase 2: Show Import
When viewing an artist page:
1. `ticketmaster.searchAndSyncArtistShows()` fetches upcoming events
2. Shows created with venue lookups (upsert by `ticketmasterId`)
3. `syncStatus.showsImported = true`

### Phase 3: Catalog Sync
When viewing a show that needs a setlist:
1. `spotify.syncArtistCatalog()` fetches artist's tracks from Spotify
2. Songs stored with `artistSongs` relationships
3. `syncStatus.catalogImported = true`, `syncStatus.songCount` updated

### Phase 4: Auto-Setlist Generation
1. `setlists.autoGenerateSetlist()` creates prediction from top songs
2. Weighted by Spotify popularity + performance frequency
3. Users can add songs and upvote predictions

### Phase 5: Actual Setlist Import (Post-Show)
1. Cron job `setlistfm.checkCompletedShows()` runs every 2 hours
2. Searches Setlist.fm by artist name, date, venue city
3. Updates setlist with `actualSetlist` array
4. Calculates accuracy vs predictions

### Circuit Breaker Pattern
Artists track sync failures to prevent infinite retries:
```typescript
catalogSyncStatus: "never" | "pending" | "syncing" | "completed" | "failed"
catalogSyncFailureCount: number     // Consecutive failures
catalogSyncBackoffUntil: number     // Block syncs until this timestamp
```

---

## Cron Jobs

All cron jobs are defined in `convex/crons.ts`:

| Job | Interval | Function | Purpose |
|-----|----------|----------|---------|
| `update-trending` | 4 hours | `maintenance.syncTrendingData` | Refresh trending from Ticketmaster |
| `check-completed-shows` | 2 hours | `setlistfm.checkCompletedShows` | Import actual setlists |
| `daily-cleanup` | 24 hours | `maintenance.cleanupOrphanedRecords` | Remove orphaned data |
| `cleanup-operational-data` | 24 hours | `maintenance.cleanupOldOperationalData` | Prune old logs |
| `setlistfm-scan` | 30 min | `setlistfm.scanPendingImports` | Queue setlist imports |
| `process-setlist-queue` | 30 min | `syncJobs.processSetlistImportQueue` | Process import queue |
| `update-artist-show-counts` | 2 hours | `trending.updateArtistShowCounts` | Update upcoming show counts |
| `update-artist-trending` | 4 hours | `trending.updateArtistTrending` | Recalculate artist scores |
| `update-show-trending` | 4 hours | `trending.updateShowTrending` | Recalculate show scores |
| `auto-transition-shows` | 2 hours | `shows.autoTransitionStatuses` | Mark shows as completed |
| `populate-missing-fields` | 1 hour | `maintenance.populateMissingFields` | Fill in missing data |
| `spotify-refresh` | 12 hours | `spotifyAuth.refreshUserTokens` | Refresh user Spotify tokens |
| `refresh-auto-setlists` | 6 hours | `setlists.refreshMissingAutoSetlists` | Generate missing setlists |

---

## API Integrations

### Ticketmaster Discovery API
- **Purpose**: Artist discovery, show listings, venue data
- **Key Files**: `convex/ticketmaster.ts`
- **Functions**:
  - `getTrendingArtists()` – Top music artists
  - `getTrendingShows()` – Popular upcoming events
  - `searchArtists()` – Search by name
  - `syncArtistShows()` – Import shows for an artist
  - `searchShowsByZipCode()` – Location-based search

### Spotify Web API
- **Purpose**: Artist enrichment, song catalogs, user's top artists
- **Key Files**: `convex/spotify.ts`, `convex/spotifyAuth.ts`
- **Functions**:
  - `enrichArtistBasics()` – Match Ticketmaster artist to Spotify
  - `syncArtistCatalog()` – Import tracks for setlist generation
  - `storeSpotifyTokens()` – Store OAuth tokens for user imports
  - `importUserSpotifyArtistsWithToken()` – Import user's followed artists

### Setlist.fm API
- **Purpose**: Actual setlists from past concerts
- **Key Files**: `convex/setlistfm.ts`
- **Functions**:
  - `syncActualSetlist()` – Fetch setlist by artist/date/venue
  - `checkCompletedShows()` – Cron: batch import completed shows
  - `triggerSetlistSync()` – Manual import trigger

---

## Key Convex Functions

### Public Queries
| Function | Purpose |
|----------|---------|
| `artists.getBySlugOrId` | Fetch artist by slug or ID |
| `shows.getBySlugOrId` | Fetch show by slug or ID |
| `setlists.getByShow` | Get all setlists for a show |
| `setlists.getSetlistWithVotes` | Get setlist with vote counts & actual comparison |
| `songVotes.getSetlistSongVotes` | Get per-song vote counts |
| `trending.getTrendingArtists` | Paginated trending artists |
| `trending.getTrendingShows` | Paginated trending shows |

### Public Mutations
| Function | Purpose |
|----------|---------|
| `setlists.addSongToSetlist` | Add song to show's prediction |
| `songVotes.voteOnSong` | Upvote a song in a setlist |
| `artists.followArtist` | Follow/unfollow an artist |
| `auth.ensureUserExists` | Sync Clerk user to Convex |

### Public Actions (API calls)
| Function | Purpose |
|----------|---------|
| `ticketmaster.triggerFullArtistSync` | Import artist with all shows |
| `ticketmaster.searchShowsByZipCode` | Location-based show search |
| `setlists.ensureAutoSetlistForShow` | Generate prediction setlist |
| `setlistfm.triggerSetlistSync` | Manually import actual setlist |

### Admin-Only Functions
| Function | Purpose |
|----------|---------|
| `admin.syncTrending` | Manual trending sync |
| `admin.resyncArtistCatalog` | Force re-sync artist songs |
| `admin.triggerSetlistSync` | Trigger setlist imports |
| `admin.cleanupNonStudioSongs` | Remove live/remix tracks |
| `admin.getAdminStats` | Dashboard statistics |
| `admin.getAllUsers` | User management |

---

## Authentication

### Clerk Integration
- **Provider**: Clerk (`@clerk/clerk-react`)
- **Supported Auth**: Email, Google OAuth, Spotify OAuth
- **Webhook Sync**: `convex/http.ts` → `/webhooks/clerk`

### User Roles
| Role | Capabilities |
|------|--------------|
| `user` | Vote, add songs, follow artists |
| `admin` | Full dashboard access, sync controls, user management |

### Admin Promotion
Admins are auto-promoted on deployment via `convex/deployment.ts`:
```typescript
// Ensures sethbamb@gmail.com is always admin
await ctx.runMutation(internal.admin.ensureAdminByEmailInternal, {
  email: "sethbamb@gmail.com"
});
```

### Anonymous Actions
Users can perform 1 free action (add song, upvote) before sign-in prompt:
- Tracked via `localStorage` with anonymous ID
- `songVotes.userId` accepts `Id<"users"> | string`

---

## Admin Dashboard

Located at `/admin`, the dashboard provides:

### Statistics
- Total artists, shows, setlists, songs, votes, users
- Active sync jobs and their progress

### Sync Controls
- **Sync Trending**: Refresh from Ticketmaster
- **Sync Setlists**: Import from Setlist.fm
- **Resync Artist Catalog**: Force Spotify re-import
- **Cleanup Tools**: Remove orphaned records, non-studio songs

### User Management
- View all users
- Toggle user roles (admin/user)
- Ban/unban users

### Error Monitoring
- Recent backend errors with context
- Mark resolved, send to Sentry
- Filter by operation/severity

### System Health
- API configuration status
- Database record counts
- Last sync timestamps

---

## Frontend Architecture

### Theme System
- **Provider**: `next-themes` with `attribute="class"`
- **Default**: Dark mode with warm gray light mode variant
- **Toggle**: `ThemeToggle` component in header
- **CSS Variables**: Defined in `src/index.css` with `.light` class overrides

### Key Components

| Component | Purpose |
|-----------|---------|
| `AppLayout` | Main layout with nav, sidebar, footer |
| `PublicDashboard` | Homepage with search, trending artists/shows |
| `ArtistDetail` | Artist page with shows, top songs |
| `ShowDetail` | Show page with setlist voting/viewing |
| `AdminDashboard` | Admin controls and statistics |

### Design System
- **Cards**: Glass morphism with `glass-card` class
- **Animations**: Framer Motion for page transitions, hover effects
- **Typography**: Overpass font family, responsive text classes
- **Responsive**: Mobile-first with `sm:`, `md:`, `lg:` breakpoints

---

## Environment Variables

### Required (Convex)
```bash
TICKETMASTER_API_KEY=        # Ticketmaster Discovery API
SPOTIFY_CLIENT_ID=           # Spotify app client ID
SPOTIFY_CLIENT_SECRET=       # Spotify app client secret
SETLISTFM_API_KEY=           # Setlist.fm API key
CLERK_WEBHOOK_SECRET=        # Clerk webhook signing secret
CLERK_SECRET_KEY=            # Clerk backend secret key
CLERK_ISSUER_URL=            # Clerk issuer domain
```

### Optional
```bash
RESEND_API_KEY=              # Resend.com API key (email notifications)
SENTRY_DSN=                  # Error tracking (optional)
```

### Frontend (.env)
```bash
VITE_CONVEX_URL=             # Convex deployment URL
VITE_CLERK_PUBLISHABLE_KEY=  # Clerk frontend key
```

---

## Development

### Prerequisites
- Node.js 22+
- npm
- Convex account
- Clerk account

### Setup
```bash
# Install dependencies
npm install

# Start development (frontend + backend)
npm run dev

# This runs:
# - Vite dev server (frontend)
# - Convex dev (backend with hot reload)
# - Auto-triggers trending sync after 10 seconds
```

### Useful Commands
```bash
# Run trending sync
npm run sync:trending

# Seed missing setlists
npm run seed:setlists

# Import completed show setlists
npm run import:past-setlists

# Build for production
npm run build

# Run type checking
npm run lint
```

---

## Deployment

### Backend (Convex)
```bash
npm run deploy:backend
# Deploys to Convex Cloud
# Triggers onDeploy hook to ensure admin user
```

### Frontend (Vercel)
```bash
npm run deploy:frontend
# Deploys to Vercel
```

### Full Deployment
```bash
npm run all
# deploy:backend → deploy:frontend → sync:trending
```

### Post-Deployment
The `deployment.ts` action runs automatically:
1. Ensures admin user exists
2. Logs deployment timestamp

---

## Recent Implementations

### UI/UX Improvements (This Session)
1. **Consistent Font Sizing**: Top nav bar uses `text-base` (16px) across all links
2. **Compact Section Headers**: "Shows", "Top Songs", "Setlist" use `text-lg sm:text-xl`
3. **Smaller Tabs**: Upcoming/Past tabs reduced padding, compact styling
4. **Artist Header Height**: Increased desktop padding (`lg:py-8`)
5. **Dark/Light Mode**: Full implementation with `next-themes`
   - Theme toggle in header
   - CSS variables for colors
   - Glass cards adapt to theme
   - Warm gray light mode background

### Previous Session Highlights
- **Post-show setlist UX**: Actual setlist replaces voting after show completes
- **Vote integration**: Shows vote counts inline with actual setlist songs
- **Mobile responsive headers**: Image left, text right on all breakpoints
- **Admin button styling**: Outline buttons with visible text
- **Homepage streamlining**: Removed duplicate sections, clean grid layout
- **Shows/Artists pages**: Compact search headers, consistent card grids

---

## Production Checklist

Before launch, verify:

- [ ] All environment variables set in Convex dashboard
- [ ] Clerk webhook configured and verified
- [ ] Trending sync runs successfully
- [ ] Admin user can access dashboard
- [ ] Anonymous voting works (1 free action)
- [ ] Setlist.fm imports work for completed shows
- [ ] Light/dark mode functions correctly
- [ ] Mobile responsive on all pages
- [ ] Error monitoring active (errorLogs table)

---

## Contact

**Owner**: sethbamb@gmail.com (admin user)
**Production URL**: https://setlists.live

