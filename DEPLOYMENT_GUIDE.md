# 🚀 Deployment Guide - Concert Setlist Voting App

## Quick Deploy (One Command)

```bash
npm run all
```

This single command will:
1. ✅ Deploy backend to Convex
2. ✅ Build frontend (create `dist/` folder)
3. ✅ Deploy frontend to Vercel

---

## What Each Command Does

### `npm run all`
Complete deployment: backend + frontend + Vercel deployment

### `npm run deploy:backend`
Deploys only the backend to Convex (all functions, schema, cron jobs)

### `npm run deploy:frontend`
Builds and deploys only the frontend to Vercel

### `npm run build`
Just builds the frontend (creates `dist/` folder) - doesn't deploy

---

## First-Time Setup

### 1. Install Vercel CLI (if not already installed)
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Link Your Project (first time only)
```bash
vercel link
```

This creates a `.vercel` folder with your project configuration.

---

## Environment Variables

### Convex (Backend)
Set these in your Convex dashboard or via CLI:

```bash
npx convex env set SPOTIFY_CLIENT_ID "your_spotify_client_id"
npx convex env set SPOTIFY_CLIENT_SECRET "your_spotify_client_secret"
npx convex env set TICKETMASTER_API_KEY "your_ticketmaster_api_key"
npx convex env set SETLISTFM_API_KEY "your_setlistfm_api_key"
```

### Vercel (Frontend)
Set these in Vercel dashboard or via CLI:

```bash
vercel env add VITE_CONVEX_URL
# Enter: https://exuberant-weasel-22.convex.cloud

vercel env add VITE_CLERK_PUBLISHABLE_KEY
# Enter: pk_test_...
```

---

## Understanding the Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│                    YOUR APP                         │
└─────────────────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌──────────────┐              ┌──────────────────┐
│   FRONTEND   │              │     BACKEND      │
│   (Vercel)   │◄────calls────│    (Convex)      │
└──────────────┘              └──────────────────┘
        │                               │
        │                               │
   Built from                      Built from
   src/ → dist/                    convex/ files
        │                               │
  Deployed via                    Deployed via
  npm run all                     npm run all
```

### What Goes Where:

**Vercel (Static Frontend)**:
- `src/` → compiled to → `dist/`
- React components
- Routing (React Router)
- UI/UX (Tailwind CSS)
- Client-side logic

**Convex (Backend)**:
- `convex/` files
- Database schema
- Queries, mutations, actions
- Cron jobs
- Business logic

**They Communicate**:
```typescript
// Frontend calls backend:
const artist = useQuery(api.artists.getById, { id: artistId });
const followArtist = useMutation(api.artists.followArtist);
```

---

## Deployment Workflows

### Full Deployment (Production)
```bash
npm run all
```

### Development Workflow
```bash
# Terminal 1: Start Convex dev server
npx convex dev

# Terminal 2: Start Vite dev server
npm run dev:frontend

# Or both at once:
npm run dev
```

### Backend Only
```bash
npm run deploy:backend
```

### Frontend Only
```bash
npm run deploy:frontend
```

---

## What Happens When You Run `npm run all`

```bash
Step 1: npm run deploy:backend
  → npx convex deploy --yes
  → Pushes convex/ files to Convex cloud
  → Updates schema, functions, cron jobs
  → ✅ Backend live at https://exuberant-weasel-22.convex.cloud

Step 2: npm run deploy:frontend
  → npm run build
    → tsc (TypeScript check)
    → vite build (compile React → dist/)
    → ✅ dist/ folder created
  
  → vercel --prod --yes
    → Uploads dist/ to Vercel CDN
    → ✅ Frontend live at your Vercel URL
```

---

## Vercel Auto-Deployment (Recommended)

For the best experience, connect your Git repository to Vercel:

1. Go to https://vercel.com/new
2. Import your Git repository
3. Vercel will detect `vercel.json` settings automatically
4. Click "Deploy"

**After setup**: Every `git push` auto-deploys! No manual commands needed.

---

## Troubleshooting

### "vercel: command not found"
```bash
npm install -g vercel
```

### "No existing credentials found"
```bash
vercel login
```

### Build fails
```bash
# Check TypeScript errors
npm run build:check

# Fix any linting errors
npm run lint
```

### Convex deployment fails
```bash
# Check if you're logged in
npx convex dev

# Redeploy
npx convex deploy --yes
```

---

## CI/CD Setup (Optional)

For automated deployments on every Git push, add to `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      # Deploy backend
      - name: Deploy to Convex
        run: |
          npm install
          npx convex deploy --yes
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
      
      # Deploy frontend
      - name: Deploy to Vercel
        run: |
          npm run build
          vercel --prod --yes
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

---

## Summary

✅ **`npm run all`** - Deploy everything (backend + frontend + Vercel)  
✅ **`dist/` folder** - Built frontend code (auto-created, auto-deployed)  
✅ **Vercel integration** - Fully configured via `vercel.json`  
✅ **One command deployment** - Ready to use!  

**Try it now**: `npm run all` 🚀
