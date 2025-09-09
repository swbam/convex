# 🎵 setlists.live - Concert Setlist Voting App

A modern, real-time web application for predicting and voting on concert setlists. Built with **Apple-level design** and **Magic UI components**.

## ✨ Features

- **🎤 Artist Discovery**: Browse trending artists with Spotify integration
- **🎵 Show Management**: Upcoming shows via Ticketmaster API
- **🗳️ Setlist Voting**: Real-time collaborative setlist predictions
- **📊 Live Updates**: WebSocket-powered real-time voting
- **🔍 Smart Search**: Debounced artist search with filters
- **📱 Responsive Design**: Mobile-first with Magic UI components

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Convex (real-time database and serverless functions)
- **Authentication**: Clerk (seamless auth integration)
- **Styling**: Tailwind CSS + shadcn/ui + Magic UI
- **Icons**: Lucide React
- **Data Sources**: Ticketmaster, Spotify, Setlist.fm APIs

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone <repository-url>
cd convex-app
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env.local
# Configure your API keys (see .env.example)
```

### 3. Development
```bash
# Start both frontend and Convex backend
npm run dev

# Or run separately:
npm run dev:frontend  # Vite dev server
npm run dev:backend   # Convex dev server
```

## 📦 Deployment

### Vercel + Convex Deployment

This app is optimized for **Vercel deployment** with **Convex backend**:

```bash
# Deploy to Vercel
vercel --prod

# Convex will auto-deploy with the build process
```

### Environment Variables for Production

Set these in your Vercel dashboard:

```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your-clerk-key
CONVEX_DEPLOY_KEY=your-convex-deploy-key
CLERK_SECRET_KEY=sk_live_your-clerk-secret

# External APIs
TICKETMASTER_API_KEY=your-ticketmaster-key
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SETLISTFM_API_KEY=your-setlistfm-key
```

## 🏗️ Architecture

```
Frontend (Vercel)     Backend (Convex)     External APIs
├── React App    ←→   ├── Queries         ├── Ticketmaster
├── Magic UI         ├── Mutations       ├── Spotify  
├── Tailwind         ├── Actions         └── Setlist.fm
└── Clerk Auth   ←→   └── Cron Jobs
```

## 📱 Key Features

### Real-time Setlist Voting
- **Single shared setlist** per show
- **Instant song addition** from dropdown
- **Live vote counts** with Magic UI animations
- **No save buttons** - everything is instant

### Apple-Level Design
- **Magic UI components** throughout
- **Black/white theme** (shadcn dark mode)
- **Overpass font** globally
- **Micro-interactions** and smooth animations

### Smart Data Management
- **Studio-only songs** (filtered from Spotify)
- **Deduplication logic** for clean catalogs
- **Background sync jobs** with progress tracking
- **SEO-friendly URLs** for artists and shows

## 🔧 Scripts

```bash
npm run dev          # Start both frontend and backend
npm run dev:frontend # Vite dev server only
npm run dev:backend  # Convex dev server only
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Type checking and linting
```

## 📚 Documentation

- **[CONVEX.md](./CONVEX.md)**: Convex implementation details
- **[PRD.md](./PRD.md)**: Product requirements and features
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Detailed deployment guide

## 🎨 Design System

- **Theme**: Black/white shadcn dark mode
- **Font**: Overpass (Google Fonts)
- **Components**: Magic UI + shadcn/ui
- **Icons**: Lucide React
- **Animations**: Framer Motion

Built with ❤️ for the music community.