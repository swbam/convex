# Environment & Deployment Setup

This project uses Vite (frontend), Convex (backend), and Clerk (auth). Configure dev and prod as below.

## URLs
- Dev Convex: https://necessary-mosquito-453.convex.cloud
- Prod Convex: https://exuberant-weasel-22.convex.cloud
- Dev App (Vercel): https://convex-sable.vercel.app/
- Prod App (planned): https://setlists.ai

## Vite environment variables
Vite embeds variables at build time. Only VITE_* are exposed to the browser.

Set these per environment:

- Development (.env.local locally, or export before `npm run dev`):

VITE_CONVEX_URL=https://necessary-mosquito-453.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cXVpZXQtcG9zc3VtLTcxLmNsZXJrLmFjY291bnRzLmRldiQ

- Production (Vercel → Project → Settings → Environment Variables):

VITE_CONVEX_URL=https://exuberant-weasel-22.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

References: https://necessary-mosquito-453.convex.cloud, https://exuberant-weasel-22.convex.cloud, https://convex-sable.vercel.app/

## Convex server variables
Set in Convex dashboard → Settings → Environment Variables:

CLERK_ISSUER_URL=https://quiet-possum-71.clerk.accounts.dev
CLERK_JWKS_URL=https://quiet-possum-71.clerk.accounts.dev/.well-known/jwks.json
SITE_URL=https://setlists.ai

Notes:
- convex/auth.config.ts reads CLERK_ISSUER_URL (fallbacks to the dev issuer).
- SITE_URL can be https://convex-sable.vercel.app/ in dev.

Docs: https://docs.convex.dev/, https://vercel.com/docs, https://clerk.com/docs, https://vitejs.dev/guide/env-and-mode.html

## Domain setup (prod)
- Vercel: add setlists.ai to the project as Production domain.
- Frontend builds must use VITE_CONVEX_URL=https://exuberant-weasel-22.convex.cloud

## Checklist
1) On Vercel (Production):
   - Add VITE_CONVEX_URL=https://exuberant-weasel-22.convex.cloud
   - Add VITE_CLERK_PUBLISHABLE_KEY=...
   - Redeploy
2) On Convex (Dev & Prod):
   - Add CLERK_ISSUER_URL and CLERK_JWKS_URL
   - Optionally SITE_URL (dev: https://convex-sable.vercel.app/; prod: https://setlists.ai)
3) Locally (Development):
   - .env.local with dev VITE_* values above
4) Verify:
   - Dashboard loads, auth works, trending queries succeed

## Commands
- Deploy Convex: npx convex deploy
- Dev (local): npm run dev
- Build: npm run build

Troubleshooting:
- If the app shows a blank screen or reconnect loops, confirm Vite envs were present at build time and match the target Convex URL.
