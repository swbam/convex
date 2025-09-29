import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";


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
import { TestSuite } from "./components/TestSuite";

import { MagicCard } from "./components/ui/magic-card";

type View = "home" | "artist" | "show" | "search" | "artists" | "shows" | "activity" | "signin" | "trending" | "profile" | "following" | "predictions" | "admin" | "test";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const _params = useParams();
  
  const [currentView, setCurrentView] = useState<View>("home");
  const [selectedArtistId, setSelectedArtistId] = useState<Id<"artists"> | null>(null);
  const [selectedShowId, setSelectedShowId] = useState<Id<"shows"> | null>(null);



  const createAppUser = useMutation(api.auth.createAppUser);
  const user = useQuery(api.auth.loggedInUser);

  // Auto-create app user when authenticated
  useEffect(() => {
    if (user && !user.appUser) {
      createAppUser().catch(console.error);
    }
  }, [user, createAppUser]);

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
    }
  }, [location.pathname, artistBySlug, showBySlugOrId]);

  const handleViewChange = (view: string, id?: Id<"artists"> | Id<"shows">, slug?: string) => {
    if (view === "artist" && id) {
      setSelectedArtistId(id as Id<"artists">);
      setSelectedShowId(null);
      // CRITICAL: Prefer slug for SEO and refresh resilience - fall back to ID if slug not available
      const urlParam = slug || id;
      void navigate(`/artists/${urlParam}`);
    } else if (view === "show" && id) {
      setSelectedShowId(id as Id<"shows">);
      setSelectedArtistId(null);
      // CRITICAL: Prefer slug for SEO and refresh resilience - fall back to ID
      const urlParam = slug || id;
      void navigate(`/shows/${urlParam}`);
    } else if (view === "signin") {
      void navigate('/signin');
    } else {
      setSelectedArtistId(null);
      setSelectedShowId(null);
      void navigate(`/${view === 'home' ? '' : view}`);
    }
  };

  const handleArtistClick = (artistId: Id<"artists">, slug?: string) => {
    handleViewChange("artist", artistId, slug);
  };

  const handleShowClick = (showId: Id<"shows">, slug?: string) => {
    handleViewChange("show", showId, slug);
  };

  const handleSignInRequired = () => {
    void navigate('/signin');
    toast.info("Sign in to add more songs and create setlists");
  };

  const renderMainContent = () => {
    switch (currentView) {
      case "artist":
        // Show loading state while query is pending
        if (location.pathname.startsWith('/artists/') && artistBySlug === undefined) {
          const artistSlug = getSlugFromPath(location.pathname, '/artists/');
          const artistName = artistSlug ? artistSlug.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ') : 'Artist';
          
          return (
            <div className="container mx-auto px-4 sm:px-6 py-8">
              <MagicCard className="p-6 rounded-2xl border border-white/10">
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
                    <p className="text-sm text-gray-400">Importing artist data and shows</p>
                  </div>
                </div>
              </MagicCard>
            </div>
          );
        }
        // Show special loading state if artist doesn't exist yet but might be creating
        if (location.pathname.startsWith('/artists/') && artistBySlug === null && !selectedArtistId) {
          const artistSlug = getSlugFromPath(location.pathname, '/artists/');
          const artistName = artistSlug ? artistSlug.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ') : 'Artist';
          
          return (
            <div className="container mx-auto px-4 sm:px-6 py-8">
              <MagicCard className="p-6 rounded-2xl border border-white/10">
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 mx-auto bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                    <span className="text-3xl font-bold text-primary">T</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">Setting up {artistName}</h2>
                  <p className="text-gray-400">Importing shows, venues, and song catalog...</p>
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span>This may take a few moments</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-4">The page will refresh automatically when ready</p>
                </div>
              </MagicCard>
            </div>
          );
        }
        return selectedArtistId ? (
          <ArtistDetail
            artistId={selectedArtistId}
            onBack={() => handleViewChange("home")}
            onShowClick={handleShowClick}
            onSignInRequired={handleSignInRequired}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No artist selected</p>
          </div>
        );
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
      case "test":
        return (
          <TestSuite />
        );
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
    <div className="min-h-screen bg-black text-white">
      {/* Cohesive dark blue gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />
      
      <div className="relative z-10">
        <ErrorBoundary>
          <ScrollToTop />
          <AppLayout>
            {renderMainContent()}
          </AppLayout>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export { App };
