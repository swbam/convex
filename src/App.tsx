import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { SignInForm } from "./SignInForm";
import { ArtistDetail } from "./components/ArtistDetail";
import { ShowDetail } from "./components/ShowDetail";
import { Artists } from "./components/Artists";
import { PublicDashboard } from "./components/PublicDashboard";
import { AppLayout } from "./components/AppLayout";
import { toast, Toaster } from "sonner";
import { Search, Calendar, MapPin, Heart } from "lucide-react";

type View = "home" | "artist" | "show" | "search" | "artists" | "shows" | "venues" | "library" | "signin" | "trending" | "profile" | "following" | "predictions";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  
  const [currentView, setCurrentView] = useState<View>("home");
  const [selectedArtistId, setSelectedArtistId] = useState<Id<"artists"> | null>(null);
  const [selectedShowId, setSelectedShowId] = useState<Id<"shows"> | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);

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
    const segments = path.split('/');
    if (segments.length >= 3 && segments[1] === prefix.slice(1)) {
      return decodeURIComponent(segments[2]);
    }
    return null;
  };

  const artistSlug = location.pathname.startsWith('/artists/') ? 
    getSlugFromPath(location.pathname, '/artists/') : null;
  const showSlug = location.pathname.startsWith('/shows/') ? 
    getSlugFromPath(location.pathname, '/shows/') : null;

  // Queries to resolve slugs to IDs
  const artistBySlug = useQuery(api.artists.getBySlug, 
    artistSlug ? { slug: artistSlug } : 'skip'
  );
  
  const showBySlug = useQuery(api.shows.getBySlug,
    showSlug ? { slug: showSlug } : 'skip'
  );

  // Update view based on current route
  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      setCurrentView('home');
    } else if (path.startsWith('/artists/')) {
      setCurrentView('artist');
      if (artistBySlug) {
        setSelectedArtistId(artistBySlug._id);
      } else if (artistBySlug === null) {
        // Artist not found, reset to avoid showing "No artist selected"
        setSelectedArtistId(null);
      }
    } else if (path.startsWith('/shows/')) {
      setCurrentView('show');
      if (showBySlug) {
        setSelectedShowId(showBySlug._id);
      } else if (showBySlug === null) {
        // Show not found, reset to avoid showing "No show selected"
        setSelectedShowId(null);
      }
    } else if (path === '/search') {
      setCurrentView('search');
    } else if (path === '/artists') {
      setCurrentView('artists');
    } else if (path === '/shows') {
      setCurrentView('shows');
    } else if (path === '/venues') {
      setCurrentView('venues');
    } else if (path === '/library') {
      setCurrentView('library');
    } else if (path === '/profile') {
      setCurrentView('profile');
    }
  }, [location.pathname, artistBySlug, showBySlug]);

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
      setShowSignIn(true);
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
    setShowSignIn(true);
    toast.info("Sign in to add more songs and create setlists");
  };

  const handleSignInClose = () => {
    setShowSignIn(false);
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
        if (location.pathname.startsWith('/shows/') && showBySlug === undefined) {
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
        if (location.pathname.startsWith('/shows/') && showBySlug === null) {
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
            <Search className="mx-auto mb-4 opacity-50 w-16 h-16" />
            <p className="text-lg">Use the search bar above to find artists, shows, and venues</p>
          </div>
        );
      case "artists":
        return (
          <Artists onArtistClick={handleArtistClick} />
        );
      case "shows":
        return (
          <div className="text-center text-zinc-400 py-12">
            <Calendar className="mx-auto mb-4 opacity-50 w-16 h-16" />
            <p className="text-lg">Shows page coming soon...</p>
          </div>
        );
      case "venues":
        return (
          <div className="text-center text-zinc-400 py-12">
            <MapPin className="mx-auto mb-4 opacity-50 w-16 h-16" />
            <p className="text-lg">Venues page coming soon...</p>
          </div>
        );
      case "library":
        return (
          <div className="text-center text-zinc-400 py-12">
            <Heart className="mx-auto mb-4 opacity-50 w-16 h-16" />
            <p className="text-lg">Your library coming soon...</p>
          </div>
        );
      case "trending":
      case "profile":
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
      <Toaster 
        position="top-right" 
        theme="dark"
        toastOptions={{
          style: {
            background: '#18181b',
            border: '1px solid #27272a',
            color: '#ffffff',
          },
        }}
      />
      
      <AppLayout>
        {renderMainContent()}
      </AppLayout>

      {/* Sign In Modal */}
      {showSignIn && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Sign In to TheSet</h2>
                <button
                  onClick={handleSignInClose}
                  className="text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <SignInForm />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
