import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";


import { ArtistDetail } from "./components/ArtistDetail";
import { ShowDetail } from "./components/ShowDetail";
import { Artists } from "./components/Artists";
import { Shows } from "./components/Shows";
import { Library } from "./components/Library";

import { AppLayout } from "./components/AppLayout";
import { ScrollToTop } from "./components/ScrollToTop";
import { UserDashboard } from "./components/UserDashboard";
import { toast } from "sonner";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { AdminDashboard } from "./components/AdminDashboard";
import { TestSuite } from "./components/TestSuite";
// Removed lucide-react imports due to TypeScript compatibility issues

type View = "home" | "artist" | "show" | "search" | "artists" | "shows" | "library" | "signin" | "trending" | "profile" | "following" | "predictions" | "admin" | "test";

export default function App() {
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

  // Queries to resolve slugs to IDs
  const artistBySlug = useQuery(api.artists.getBySlugOrId, 
    artistSlug ? { key: artistSlug } : 'skip'
  );
  
  // Be resilient: accept slug or fallback to id string
  const showBySlugOrId = useQuery(
    api.shows.getBySlugOrId,
    showSlug ? { key: showSlug } : 'skip'
  );

  // Update view based on current route
  useEffect(() => {
    const path = location.pathname;
    // Basic SEO title updates per route
    if (path === '/') {
      document.title = 'TheSet – Concert Setlists, Predictions, and Voting';
    }
    if (path === '/') {
      setCurrentView('home');
    } else if (path.startsWith('/artists/')) {
      setCurrentView('artist');
      if (artistBySlug && 'name' in artistBySlug) {
        setSelectedArtistId(artistBySlug._id as Id<"artists">);
        document.title = `${artistBySlug.name} – Artist | TheSet`;
      } else if (artistBySlug === null) {
        // Artist not found, reset to avoid showing "No artist selected"
        setSelectedArtistId(null);
        document.title = 'Artist Not Found – TheSet';
      }
    } else if (path.startsWith('/shows/')) {
      setCurrentView('show');
      if (showBySlugOrId) {
        setSelectedShowId(showBySlugOrId._id);
        const titleBits = [showBySlugOrId.artist?.name, showBySlugOrId.venue?.name, new Date(showBySlugOrId.date).toLocaleDateString('en-US')].filter(Boolean).join(' @ ');
        document.title = `${titleBits} – Show | TheSet`;
      } else if (showBySlugOrId === null) {
        // Show not found, reset to avoid showing "No show selected"
        setSelectedShowId(null);
        document.title = 'Show Not Found – TheSet';
      }
    } else if (path === '/search') {
      setCurrentView('search');
      document.title = 'Search – TheSet';
    } else if (path === '/artists') {
      setCurrentView('artists');
      document.title = 'Artists – TheSet';
    } else if (path === '/shows') {
      setCurrentView('shows');
      document.title = 'Shows – TheSet';

    } else if (path === '/library') {
      setCurrentView('library');
      document.title = 'Library – TheSet';

    } else if (path === '/profile') {
      setCurrentView('profile');
      document.title = 'Profile – TheSet';
    } else if (path === '/admin') {
      setCurrentView('admin');
      document.title = 'Admin – TheSet';
    } else if (path === '/test') {
      setCurrentView('test');
      document.title = 'Test Suite – TheSet';
    }
  }, [location.pathname, artistBySlug, showBySlugOrId]);

  const handleViewChange = (view: string, id?: Id<"artists"> | Id<"shows">, slug?: string) => {
    if (view === "artist" && id) {
      setSelectedArtistId(id as Id<"artists">);
      setSelectedShowId(null);
      // Use slug if provided, otherwise use ID as fallback
      const urlParam = slug || id;
      void navigate(`/artists/${urlParam}`);
    } else if (view === "show" && id) {
      setSelectedShowId(id as Id<"shows">);
      setSelectedArtistId(null);
      // Use slug if provided, otherwise use ID as fallback
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
        if (location.pathname.startsWith('/artists/') && artistBySlug === null) {
          return (
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold mb-4">Artist Not Found</h2>
              <p className="text-muted-foreground mb-4">The artist you're looking for doesn't exist.</p>
              <button 
                onClick={() => handleViewChange("home")}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Back to Home
              </button>
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

      case "library":
        return (
          <Library 
            onArtistClick={handleArtistClick}
            onShowClick={handleShowClick}
          />
        );
      case "profile":
        return (
          <UserDashboard 
            onArtistClick={handleArtistClick}
            onShowClick={handleShowClick}
          />
        );
      case "admin":
        return (
          <AdminDashboard />
        );
      case "test":
        return (
          <TestSuite />
        );
      case "trending":
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
