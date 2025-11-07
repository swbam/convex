# setlists.live

Production-ready web app using Convex (backend) and Clerk (auth).

## Quick Start

```bash
npm install
npm run dev
# Frontend: Vite, Backend: Convex
```

## Docs
- Architecture: `docs/architecture.md`
- Testing: `docs/testing.md`

## Useful Scripts
- `npm run build:check` – Type checks (frontend + backend)
- `npm run build` – Production build
- `npm run sync:trending` – Trigger trending refresh
- `npm run seed:setlists` – Seed auto-setlists
- `npm run import:past-setlists` – Trigger setlist.fm imports for completed shows

## Environment
Set these in Convex/hosting provider before deploying:
- `CLERK_JWT_ISSUER_DOMAIN` (or `CLERK_ISSUER_URL`)
- `CLERK_WEBHOOK_SECRET`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_TOKEN_ENC_KEY`
- `TICKETMASTER_API_KEY`
- `SETLISTFM_API_KEY`

## Deployment
- Backend: `npm run deploy:backend`
- Frontend: `npm run deploy:frontend`
