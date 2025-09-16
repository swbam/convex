# Environment & Deployment Setup

This project runs a Vite frontend and a Convex backend. Local development uses test
keys, while production relies on environment variables configured in Vercel and the
Convex dashboard.

## 1. Local Development

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in the following values in `.env.local`:
   ```env
   VITE_CONVEX_URL=https://<your-dev-deployment>.convex.cloud
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   ```
3. Start Convex locally (`npm run dev` launches both servers). If you use a hosted
   Convex dev deployment, make sure the URL above matches the project you created in the
   Convex dashboard.

### Convex environment variables for development
Set these under *Project → Settings → Environment Variables* in the Convex dashboard
(or via `npx convex env set`):

```bash
CLERK_ISSUER_URL=https://<your-clerk-instance>.clerk.accounts.dev
CLERK_JWKS_URL=https://<your-clerk-instance>.clerk.accounts.dev/.well-known/jwks.json
SITE_URL=http://localhost:5173
TICKETMASTER_API_KEY=...           # optional locally
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SETLISTFM_API_KEY=...
```

## 2. Production (Vercel + Convex)

### Vercel Environment Variables
Add these under **Project → Settings → Environment Variables** before triggering a build:

```bash
VITE_CONVEX_URL=https://<your-prod-deployment>.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

If the frontend needs direct access to third-party keys, remember that only variables
prefixed with `VITE_` are exposed to the browser.

### Convex Production Variables
Use the Convex dashboard or CLI to set the server-side secrets:

```bash
CLERK_ISSUER_URL=https://<your-clerk-instance>.clerk.accounts.dev
CLERK_JWKS_URL=https://<your-clerk-instance>.clerk.accounts.dev/.well-known/jwks.json
SITE_URL=https://<your-production-domain>
TICKETMASTER_API_KEY=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SETLISTFM_API_KEY=...
```

These values are read by actions/mutations at runtime. Convex never exposes them to the
client.

### Deployment Checklist
1. Confirm both Vercel and Convex environment variables are in place.
2. Run `npm run build` locally to ensure the project compiles with the configured env vars.
3. Deploy Convex (`npx convex deploy`) if backend changes were made.
4. Deploy the frontend to Vercel.
5. After deployment, verify:
   - Clerk sign-in/sign-up works.
   - The frontend can reach the Convex deployment (`VITE_CONVEX_URL`).
   - Ticketmaster/Spotify/Setlist.fm sync functions run without missing credentials.

Keeping the configuration in sync between local, staging, and production environments
prevents the “undefined Convex URL” and similar runtime errors that Vite would otherwise
bake into the build.
