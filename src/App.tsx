import React, { useEffect } from "react";
import { useQuery } from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { DetailPageSkeleton } from "./components/LoadingSkeleton";
import { Music } from "lucide-react";


import { ArtistDetail } from "./components/ArtistDetail";
import { ShowDetail } from "./components/ShowDetail";
import { Artists } from "./components/Artists";
import { Shows } from "./components/Shows";
import { Festivals } from "./components/Festivals";
import { FestivalDetail } from "./components/FestivalDetail";
import { VenueDetail } from "./components/VenueDetail";

import { Trending } from "./components/Trending";

import { AppLayout } from "./components/AppLayout";
import { ScrollToTop } from "./components/ScrollToTop";
import { UserDashboard } from "./components/UserDashboard";
import { ActivityPage } from "./components/ActivityPage";
import { toast } from "sonner";

import { ErrorBoundary } from "./components/ErrorBoundary";
import AdminDashboard from "./components/AdminDashboard";

import { AuthGuard } from "./components/AuthGuard";
import { BackendErrorMonitor } from "./components/BackendErrorMonitor";

import { MagicCard } from "./components/ui/magic-card";
import { DocsPage } from "./pages/Docs";

type View = "home" | "dashboard" | "artist" | "show" | "venue" | "search" | "artists" | "shows" | "festivals" | "festival" | "activity" | "signin" | "trending" | "profile" | "following" | "predictions" | "admin" | "docs" | "test";

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Note: User creation is now handled by AuthGuard component
  // This prevents duplicate creation attempts and race conditions

  // Extract slug from URL safely
  const getSlugFromPath = (path: string, prefix: string) => {
    // Accept slug or ID, ensure SEO-friendly slugs are decoded
    const segments = path.split('/').filter(Boolean);
    const normalizedPrefix = prefix.split('/').filter(Boolean).join('');
    if (segments[0] === normalizedPrefix) {
      return decodeURIComponent(segments[1] || "");
    }
    return null;
  };

  const artistSlug = location.pathname.startsWith('/artists/') ?
    getSlugFromPath(location.pathname, '/artists/') : null;
  const showSlug = location.pathname.startsWith('/shows/') ?
    getSlugFromPath(location.pathname, '/shows/') : null;
  const festivalSlug = location.pathname.startsWith('/festivals/') ?
    getSlugFromPath(location.pathname, '/festivals/') : null;
  const venueSlug = location.pathname.startsWith('/venues/') ?
    getSlugFromPath(location.pathname, '/venues/') : null;

  // Queries to resolve slugs/ids and canonicalize to Convex IDs
  const artistBySlug = useQuery(api.artists.getBySlugOrId,
    artistSlug ? { key: artistSlug } : 'skip'
  );

  // Be resilient: accept slug or fallback to id string
  const showBySlugOrId = useQuery(
    api.shows.getBySlugOrId,
    showSlug ? { key: showSlug } : 'skip'
  );
  const venueBySlugOrId = useQuery(
    api.venues.getBySlugOrId,
    venueSlug ? { key: venueSlug } : 'skip'
  );

  // The URL is the source of truth. Do not briefly render a prior selection while
  // an effect catches up, or remount the page when a slug resolves into an ID.
  const currentView: View = artistSlug ? "artist" : showSlug ? "show" : venueSlug ? "venue" : festivalSlug ? "festival"
    : ({ "/": "home", "/artists": "artists", "/shows": "shows", "/festivals": "festivals", "/trending": "trending", "/dashboard": "dashboard", "/activity": "activity", "/profile": "profile", "/admin": "admin", "/search": "search", "/test": "test", "/docs": "docs" } as Record<string, View>)[location.pathname] ?? "home";
  const selectedArtistId = artistBySlug?._id;
  const selectedShowId = showBySlugOrId?._id;
  const selectedVenueId = venueBySlugOrId?._id;
  useEffect(() => {
    const resolved = artistSlug ? artistBySlug : showSlug ? showBySlugOrId : venueSlug ? venueBySlugOrId : null;
    const prefix = artistSlug ? "artists" : showSlug ? "shows" : "venues";
    if (resolved?.slug && location.pathname !== `/${prefix}/${resolved.slug}`) {
      void navigate(`/${prefix}/${resolved.slug}${location.search}`, { replace: true });
    }
  }, [artistSlug, showSlug, venueSlug, artistBySlug, showBySlugOrId, venueBySlugOrId, location.pathname, location.search, navigate]);

  const handleViewChange = (
    view: View,
    id?: Id<"artists"> | Id<"shows"> | Id<"venues"> | null,
    slug?: string
  ) => {
    if (view === "artist") {



      const urlParam = slug ?? (typeof id === "string" ? id : undefined);
      if (urlParam) {
        void navigate(`/artists/${urlParam}`);
      }
      return;
    }

    if (view === "show") {



      const urlParam = slug ?? (typeof id === "string" ? id : undefined);
      if (urlParam) {
        void navigate(`/shows/${urlParam}`);
      }
      return;
    }

    if (view === "venue") {

      const urlParam = slug ?? (typeof id === "string" ? id : undefined);
      if (urlParam) void navigate(`/venues/${urlParam}`);
      return;
    }

    if (view === "signin") {
      void navigate('/signin');
      return;
    }



    void navigate(`/${view === 'home' ? '' : view}`);
  };

  const handleArtistClick = (artistKey: string | Id<"artists">, slug?: string) => {
    const artistId = typeof artistKey === 'string' && artistKey.startsWith('k')
      ? (artistKey as Id<"artists">)
      : typeof artistKey !== 'string'
        ? artistKey
        : undefined;
    const preferredSlug = slug ?? (typeof artistKey === 'string' && !artistKey.startsWith('k') ? artistKey : undefined);
    handleViewChange("artist", artistId ?? null, preferredSlug);
  };

  const handleShowClick = (showKey: string | Id<"shows">, slug?: string) => {
    const showId = typeof showKey === 'string' && showKey.startsWith('k') ? (showKey as Id<"shows">) : undefined;
    const preferredSlug = slug ?? (typeof showKey === 'string' && !showKey.startsWith('k') ? showKey : undefined);
    handleViewChange("show", showId ?? null, preferredSlug);
  };

  const handleFestivalClick = (slug: string) => {
    void navigate(`/festivals/${slug}`);
  };

  const handleSignInRequired = () => {
    void navigate('/signin');
    toast.info("Sign in to add more songs and create setlists");
  };

  const renderMainContent = () => {
    switch (currentView) {
      case "artist":
        // CRITICAL FIX: Proper artist loading states
        // artistBySlug === undefined → Query still pending (show loading skeleton)
        // artistBySlug === null → Artist not found in DB (show not found message)
        // artistBySlug === {...} → Artist found (show ArtistDetail)

        if (artistBySlug === undefined) return <DetailPageSkeleton kind="artist" />;
        if (artistBySlug === null) {
        // Artist not found - show helpful message
          const artistSlug = getSlugFromPath(location.pathname, '/artists/');
          const artistName = artistSlug ? artistSlug.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ') : 'Artist';

          return (
            <div className="container mx-auto px-4 sm:px-6 py-8">
              <MagicCard className="p-6 rounded-2xl border-0 bg-card">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
                    <Music className="h-10 w-10 text-red-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">Artist Not Found</h2>
                  <p className="text-muted-foreground">We couldn't find {artistName} in our database.</p>
                  <p className="text-sm text-muted-foreground">Try searching for the artist from the homepage.</p>
                  <div className="flex gap-3 justify-center mt-6">
                    <button
                      onClick={() => navigate('/')}
                      className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all"
                    >
                      Back to Home
                    </button>
                    <button
                      onClick={() => navigate('/artists')}
                      className="px-6 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl transition-all"
                    >
                      Browse Artists
                    </button>
                  </div>
                </div>
              </MagicCard>
            </div>
          );
        }

        // Artist found - render detail page
        return selectedArtistId ? (
          <ArtistDetail
            key={selectedArtistId}
            artistId={selectedArtistId}
            artistData={artistBySlug}
            onBack={() => handleViewChange("home")}
            onShowClick={handleShowClick}
            onSignInRequired={handleSignInRequired}
          />
        ) : null;
      case "show":
        // Show loading state while query is pending
        if (showBySlugOrId === undefined) return <DetailPageSkeleton />;
        // Show not found if query returned null
        if (location.pathname.startsWith('/shows/') && showBySlugOrId === null) {
          return (
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold mb-4">Show Not Found</h2>
              <p className="text-muted-foreground mb-4">The show you're looking for doesn't exist.</p>
              <button
                onClick={() => handleViewChange("home")}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Back to Home
              </button>
            </div>
          );
        }
        return selectedShowId ? (
          <ShowDetail
            key={selectedShowId}
            showId={selectedShowId}
            showData={showBySlugOrId}
            onBack={() => handleViewChange("home")}
            onArtistClick={handleArtistClick}
            onSignInRequired={handleSignInRequired}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No show selected</p>
          </div>
        );
      case "venue":
        if (venueBySlugOrId === undefined) {
          return <DetailPageSkeleton kind="venue" />;
        }
        if (!selectedVenueId || venueBySlugOrId === null) {
          return (
            <div className="py-16 text-center">
              <h2 className="text-2xl font-bold">Venue not found</h2>
              <button className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground" onClick={() => navigate('/')}>Back home</button>
            </div>
          );
        }
        return (
          <VenueDetail
            key={selectedVenueId}
            venueId={selectedVenueId}
            venueData={venueBySlugOrId}
            onBack={() => navigate('/')}
            onShowClick={handleShowClick}
          />
        );
      case "search":
        return (
          <div className="text-center text-zinc-400 py-12">
            <div className="mx-auto mb-4 opacity-50 w-16 h-16 flex items-center justify-center text-4xl">🔍</div>
            <p className="text-lg">Use the search bar above to find artists, shows, and venues</p>
          </div>
        );
      case "artists":
        return (
          <Artists onArtistClick={handleArtistClick} />
        );
      case "shows":
        return (
          <Shows onShowClick={handleShowClick} />
        );
      case "festivals":
        return (
          <Festivals onFestivalClick={handleFestivalClick} />
        );
      case "festival":
        return festivalSlug ? (
          <FestivalDetail
            festivalSlug={festivalSlug}
            onBack={() => navigate('/festivals')}
            onShowClick={handleShowClick}
            onArtistClick={handleArtistClick}
          />
        ) : null;
      case "trending":
        return (
          <Trending
            onArtistClick={handleArtistClick}
            onShowClick={handleShowClick}
          />
        );
      case "dashboard":
        return (
          <UserDashboard
            onArtistClick={handleArtistClick}
            onShowClick={handleShowClick}
          />
        );
      case "activity":
        return (
          <ActivityPage
            onArtistClick={handleArtistClick}
            onShowClick={handleShowClick}
          />
        );
      case "profile":
        // Profile now handled by separate route - redirect there
        void navigate('/profile');
        return null;
      case "admin":
        return (
          <>
            {/* SEOHead applies the robots "noindex" meta for /admin */}

            <AdminDashboard />
          </>
        );
      case "docs":
        return <DocsPage />;
      case "following":
      case "predictions":
        return (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">{currentView.charAt(0).toUpperCase() + currentView.slice(1)}</h2>
            <p className="text-muted-foreground">Coming soon...</p>
          </div>
        );
      case "home":
      default:
        return null; // DashboardGrid is rendered directly in AppLayout
    }
  };

  return (
    <div className="min-h-screen min-h-dvh bg-background text-foreground w-full max-w-[100vw]" style={{ overflowX: 'clip' }}>
      {/* Backend error monitoring - sends Convex errors to Sentry */}
      <BackendErrorMonitor />

      {/* Theme-aware gradient background */}
      <div className="fixed inset-0 bg-background pointer-events-none" />

      <div className="relative z-10 w-full max-w-[100vw]" style={{ overflowX: 'clip' }}>
        <ErrorBoundary
          fallback={
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
                <p className="text-muted-foreground mb-6">We encountered an unexpected error. Please try refreshing the page.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-xl font-medium transition-all duration-200 border border-border"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          }
        >
          <AuthGuard>
            <ScrollToTop />
            <AppLayout>
              <div className="min-w-0">{renderMainContent()}</div>
            </AppLayout>
          </AuthGuard>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export { App };
