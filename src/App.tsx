import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { Music } from "lucide-react";


import { ArtistDetail } from "./components/ArtistDetail";
import { ShowDetail } from "./components/ShowDetail";
import { Artists } from "./components/Artists";
import { Shows } from "./components/Shows";

import { Trending } from "./components/Trending";

import { AppLayout } from "./components/AppLayout";
import { ScrollToTop } from "./components/ScrollToTop";
import { UserDashboard } from "./components/UserDashboard";
import { ActivityPage } from "./components/ActivityPage";
import { toast } from "sonner";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { AdminDashboard } from "./components/AdminDashboard";
import { AuthGuard } from "./components/AuthGuard";
import { BackendErrorMonitor } from "./components/BackendErrorMonitor";

import { MagicCard } from "./components/ui/magic-card";
import { DocsPage } from "./pages/Docs";

type View = "home" | "artist" | "show" | "search" | "artists" | "shows" | "activity" | "signin" | "trending" | "profile" | "following" | "predictions" | "admin" | "docs";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const _params = useParams();
  
  const [currentView, setCurrentView] = useState<View>("home");
  const [selectedArtistId, setSelectedArtistId] = useState<Id<"artists"> | null>(null);
  const [selectedShowId, setSelectedShowId] = useState<Id<"shows"> | null>(null);



  const user = useQuery(api.auth.loggedInUser);

  // Log user auth state for debugging
  useEffect(() => {
    console.log('🔍 App.tsx: User auth state', {
      convexUser: user,
      hasIdentity: !!user?.identity,
      hasAppUser: !!user?.appUser,
      needsSetup: user?.needsSetup,
      currentPath: location.pathname,
      timestamp: new Date().toISOString()
    });
  }, [user, location.pathname]);

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

  // Queries to resolve slugs/ids and canonicalize to Convex IDs
  const artistBySlug = useQuery(api.artists.getBySlugOrId, 
    artistSlug ? { key: artistSlug } : 'skip'
  );
  
  // Be resilient: accept slug or fallback to id string
  const showBySlugOrId = useQuery(
    api.shows.getBySlugOrId,
    showSlug ? { key: showSlug } : 'skip'
  );

  // When artist not yet found after import, show loading state and rely on Convex reactivity, no forced reloads

  // Update view based on current route
  useEffect(() => {
    const path = location.pathname;
    // Basic SEO title updates per route
    if (path === '/') {
      document.title = 'setlists.live – Concert Setlists, Predictions, and Voting';
    }
    if (path === '/') {
      setCurrentView('home');
    } else if (path.startsWith('/artists/')) {
      setCurrentView('artist');
      if (artistBySlug && 'name' in artistBySlug) {
        setSelectedArtistId(artistBySlug._id as Id<"artists">);
        document.title = `${artistBySlug.name} – Artist | setlists.live`;
        // Canonicalize to slug (not ID) for better SEO and refresh resilience
        const currentKey = getSlugFromPath(path, '/artists/');
        if (currentKey && artistBySlug.slug && currentKey !== artistBySlug.slug) {
          void navigate(`/artists/${artistBySlug.slug}`, { replace: true });
        }
      } else if (artistBySlug === null) {
        // Artist not found - keep trying with reactive Convex updates
        // Don't reset to null, keep view to show loading/importing state
        document.title = 'Loading Artist – setlists.live';
      }
      // If artistBySlug is undefined, it's still loading from Convex
    } else if (path.startsWith('/shows/')) {
      setCurrentView('show');
      if (showBySlugOrId) {
        setSelectedShowId(showBySlugOrId._id);
        const dateObj = new Date(showBySlugOrId.date);
        const dateStr = isNaN(dateObj.getTime()) ? 'Date TBA' : dateObj.toLocaleDateString('en-US');
        const titleBits = [showBySlugOrId.artist?.name, showBySlugOrId.venue?.name, dateStr].filter(Boolean).join(' @ ');
        document.title = `${titleBits} – Show | setlists.live`;
        // Canonicalize to slug for better SEO and refresh resilience
        const currentKey = getSlugFromPath(path, '/shows/');
        if (currentKey && showBySlugOrId.slug && currentKey !== showBySlugOrId.slug) {
          void navigate(`/shows/${showBySlugOrId.slug}`, { replace: true });
        }
      } else if (showBySlugOrId === null) {
        // Show not found, reset
        setSelectedShowId(null);
        document.title = 'Show Not Found – setlists.live';
      }
    } else if (path === '/search') {
      setCurrentView('search');
      document.title = 'Search – setlists.live';
    } else if (path === '/artists') {
      setCurrentView('artists');
      document.title = 'Artists – setlists.live';
    } else if (path === '/shows') {
      setCurrentView('shows');
      document.title = 'Shows – setlists.live';
    } else if (path === '/trending') {
      setCurrentView('trending');
      document.title = 'Trending – setlists.live';
    } else if (path === '/activity') {
      setCurrentView('activity');
      document.title = 'Activity – setlists.live';
    } else if (path === '/profile') {
      setCurrentView('profile');
      document.title = 'Profile – setlists.live';
    } else if (path === '/admin') {
      setCurrentView('admin');
      document.title = 'Admin – setlists.live';
    } else if (path === '/test') {
      setCurrentView('test');
      document.title = 'Test Suite – setlists.live';
    } else if (path === '/docs') {
      setCurrentView('docs');
      document.title = 'API Docs – setlists.live';
    }
  }, [location.pathname, artistBySlug, showBySlugOrId]);

  const handleViewChange = (
    view: View,
    id?: Id<"artists"> | Id<"shows"> | null,
    slug?: string
  ) => {
    if (view === "artist") {
      setSelectedArtistId((id as Id<"artists">) ?? null);
      setSelectedShowId(null);
      const urlParam = slug ?? (typeof id === "string" ? id : undefined);
      if (urlParam) {
        void navigate(`/artists/${urlParam}`);
      }
      return;
    }

    if (view === "show") {
      setSelectedShowId((id as Id<"shows">) ?? null);
      setSelectedArtistId(null);
      const urlParam = slug ?? (typeof id === "string" ? id : undefined);
      if (urlParam) {
        void navigate(`/shows/${urlParam}`);
      }
      return;
    }

    if (view === "signin") {
      void navigate('/signin');
      return;
    }
    
    setSelectedArtistId(null);
    setSelectedShowId(null);
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

  const handleSignInRequired = () => {
    void navigate('/signin');
    toast.info("Sign in to add more songs and create setlists");
  };

  // Page transition variants
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1] as any
      }
    },
    exit: { 
      opacity: 0, 
      y: -20,
      transition: { duration: 0.3 }
    }
  };

  const renderMainContent = () => {
    switch (currentView) {
      case "artist":
        // CRITICAL FIX: Proper artist loading states
        // artistBySlug === undefined → Query still pending (show loading skeleton)
        // artistBySlug === null → Artist not found in DB (show not found message)
        // artistBySlug === {...} → Artist found (show ArtistDetail)
        
        if (location.pathname.startsWith('/artists/') && artistBySlug === undefined) {
          // Query is still loading
          const artistSlug = getSlugFromPath(location.pathname, '/artists/');
          const artistName = artistSlug ? artistSlug.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ') : 'Artist';
          
          return (
            <div className="container mx-auto px-4 sm:px-6 py-8">
              <MagicCard className="p-6 rounded-2xl border-0 bg-card">
                <div className="animate-pulse space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-32 bg-white/10 rounded-xl"></div>
                    <div className="flex-1 space-y-3">
                      <div className="h-8 bg-white/10 rounded w-2/3"></div>
                      <div className="h-4 bg-white/10 rounded w-1/2"></div>
                      <div className="h-4 bg-white/10 rounded w-1/3"></div>
                    </div>
                  </div>
                  <div className="text-center py-4">
                    <p className="text-lg text-white mb-2">Loading {artistName}...</p>
                    <p className="text-sm text-gray-400">Fetching artist details</p>
                  </div>
                </div>
              </MagicCard>
            </div>
          );
        }
        
        if (location.pathname.startsWith('/artists/') && artistBySlug === null) {
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
                  <h2 className="text-2xl font-bold text-white">Artist Not Found</h2>
                  <p className="text-gray-400">We couldn't find {artistName} in our database.</p>
                  <p className="text-sm text-gray-500">Try searching for the artist from the homepage.</p>
                  <div className="flex gap-3 justify-center mt-6">
                    <button
                      onClick={() => navigate('/')}
                      className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl transition-all"
                    >
                      Back to Home
                    </button>
                    <button
                      onClick={() => navigate('/artists')}
                      className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all"
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
            artistId={selectedArtistId}
            onBack={() => handleViewChange("home")}
            onShowClick={handleShowClick}
            onSignInRequired={handleSignInRequired}
          />
        ) : null;
      case "show":
        // Show loading state while query is pending
        if (location.pathname.startsWith('/shows/') && showBySlugOrId === undefined) {
          return (
            <div className="text-center py-8">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-muted rounded w-48 mx-auto"></div>
                <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
              </div>
            </div>
          );
        }
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
            showId={selectedShowId}
            onBack={() => handleViewChange("home")}
            onArtistClick={handleArtistClick}
            onSignInRequired={handleSignInRequired}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No show selected</p>
          </div>
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
      case "trending":
        return (
          <Trending 
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
          <AdminDashboard />
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
    <div className="min-h-screen bg-background text-white overflow-x-hidden">
      {/* Backend error monitoring - sends Convex errors to Sentry */}
      <BackendErrorMonitor />
      
      {/* Premium monochrome gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />
      
      <div className="relative z-10 overflow-x-hidden w-full">
        <ErrorBoundary
          fallback={
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
                <p className="text-gray-400 mb-6">We encountered an unexpected error. Please try refreshing the page.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all duration-200 border border-white/20"
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
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {renderMainContent()}
              </motion.div>
            </AnimatePresence>
          </AppLayout>
          </AuthGuard>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export { App };
