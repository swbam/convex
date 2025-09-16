# Deployment Checklist for Vercel

Use this checklist when pushing a new production build.

## Environment Variables
- **Vercel (frontend):**
  - `VITE_CONVEX_URL` – points to the production Convex deployment.
  - `VITE_CLERK_PUBLISHABLE_KEY` – Clerk publishable key for the production instance.
- **Convex (server-side):**
  - `CLERK_ISSUER_URL`, `CLERK_JWKS_URL`, `SITE_URL`.
  - API keys for Ticketmaster, Spotify, and Setlist.fm.

Set the values *before* triggering a build so Vite can inline them correctly.

## Build Commands
- Convex deploy (if backend changed): `npx convex deploy`
- Frontend build: `npm run build`

Vercel automatically runs `npm run build` using the settings from `vercel.json` (output folder `dist`).

## Post-Deployment Verification
1. Open the deployed URL and confirm there are no console errors.
2. Sign in and sign out via Clerk.
3. Navigate to an artist and a show page to ensure Convex queries resolve correctly.
4. Trigger a manual setlist sync from the admin tools if needed and watch Convex logs.

## Troubleshooting
- Double-check environment variables if you see `undefined` URLs in the network tab.
- Use `npx convex dashboard` to inspect backend logs and confirm cron jobs are running.
- Run `npm run build` locally to reproduce build-time errors before pushing.
