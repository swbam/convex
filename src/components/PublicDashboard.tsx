import React, { useMemo, useState } from 'react';
import { useQuery, useAction } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { MapPin, Music, ArrowRight, Loader2, Radio, CalendarDays, Flame, Clock3 } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { Id } from "../../convex/_generated/dataModel";
import { GridSkeleton } from "./LoadingSkeleton";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { FaSpotify } from "react-icons/fa";
import { formatLocation } from "../lib/utils";
import { toast } from "sonner";
import { capture } from "../lib/analytics";
// Removed EmblaCarousel - using simple CSS-based horizontal scroll for reliability

interface PublicDashboardProps {
  onArtistClick: (artistKey: Id<"artists"> | string) => void;
  onShowClick: (showKey: Id<"shows"> | string, slug?: string) => void;
  onSignInRequired: () => void;
  navigate: (path: string) => void;
}

type ArtistCategory = "All" | "Pop" | "Hip-Hop & R&B" | "Rock & Indie" | "Country & Folk" | "Latin" | "Electronic";

const ARTIST_CATEGORIES: Array<{ label: ArtistCategory; terms: string[] }> = [
  { label: "All", terms: [] },
  { label: "Pop", terms: ["pop"] },
  { label: "Hip-Hop & R&B", terms: ["hip hop", "hip-hop", "rap", "r&b", "trap"] },
  { label: "Rock & Indie", terms: ["rock", "metal", "punk", "alternative", "indie", "grunge"] },
  { label: "Country & Folk", terms: ["country", "americana", "folk", "bluegrass", "red dirt"] },
  { label: "Latin", terms: ["latin", "banda", "norte", "regional mexican", "reggaeton", "salsa", "bachata"] },
  { label: "Electronic", terms: ["electronic", "dance", "edm", "house", "techno", "dj"] },
];

const getArtistCategory = (artist: any): ArtistCategory | "Other" => {
  const genreText = [
    ...(Array.isArray(artist?.genres) ? artist.genres : []),
    ...(Array.isArray(artist?.cachedTrending?.genres) ? artist.cachedTrending.genres : []),
  ].join(" ").toLowerCase();

  for (const category of ARTIST_CATEGORIES.slice(1)) {
    if (category.terms.some((term) => genreText.includes(term))) return category.label;
  }
  return "Other";
};

export function PublicDashboard({ onArtistClick, onShowClick }: PublicDashboardProps) {
  const navigateTo = useNavigate();
  const { user, isSignedIn, isLoaded: isClerkLoaded } = useUser();
  const shouldReduceMotion = useReducedMotion();
  const [artistCategory, setArtistCategory] = useState<ArtistCategory>("All");
  const [showOrder, setShowOrder] = useState<"soonest" | "popular">("soonest");
  
  // Import action for artists not yet in DB
  const triggerArtistSync = useAction(api.ticketmaster.triggerFullArtistSync);
  const [importingArtist, setImportingArtist] = useState<string | null>(null);

  // Load trending data
  const dbTrendingShowsResult = useQuery(api.trending.getTrendingShows, { limit: 48 });
  const dbTrendingArtistsResult = useQuery(api.trending.getTrendingArtists, { limit: 50 });
  
  // Load featured festivals
  const featuredFestivals = useQuery(api.festivals.getFeatured, { limit: 8 });
  
  // Load user data for personalization
  const appUser = useQuery(api.auth.loggedInUser);
  
  // Load Spotify artists only if logged in
  const mySpotifyArtists = useQuery(
    api.spotifyAuthQueries.getUserSpotifyArtists, 
    isSignedIn ? { limit: 20, onlyWithShows: true } : "skip"
  );
  
  // Determine Spotify connection status
  const hasSpotify = useMemo(() => {
    if (appUser?.appUser?.spotifyId) return true;
    if (user?.externalAccounts) {
      return user.externalAccounts.some((account) => ['spotify', 'oauth_spotify'].includes(account.provider));
    }
    return false;
  }, [appUser?.appUser?.spotifyId, user?.externalAccounts]);
  
  // Sort Spotify artists: top artists first, then by show count
  const sortedSpotifyArtists = useMemo(() => {
    if (!mySpotifyArtists) return [];
    return [...mySpotifyArtists].sort((a, b) => {
      if (a.isTopArtist && !b.isTopArtist) return -1;
      if (!a.isTopArtist && b.isTopArtist) return 1;
      if (a.isTopArtist && b.isTopArtist) {
        return (a.topArtistRank || 999) - (b.topArtistRank || 999);
      }
      return (b.upcomingShowsCount || 0) - (a.upcomingShowsCount || 0);
    });
  }, [mySpotifyArtists]);
  
  // Extract page arrays with robust guards
  const dbTrendingShows = React.useMemo(() => {
    if (dbTrendingShowsResult === undefined) return undefined;
    if (dbTrendingShowsResult === null) return [];
    return Array.isArray(dbTrendingShowsResult.page) ? dbTrendingShowsResult.page : [];
  }, [dbTrendingShowsResult]);
  
  const dbTrendingArtists = React.useMemo(() => {
    if (dbTrendingArtistsResult === undefined) return undefined;
    if (dbTrendingArtistsResult === null) return [];
    return Array.isArray(dbTrendingArtistsResult.page) ? dbTrendingArtistsResult.page : [];
  }, [dbTrendingArtistsResult]);

  // Dedupe utility
  const dedupe = (arr: any[], keyFn: (x: any) => string) => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const item of arr) {
      const k = keyFn(item);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
    return out;
  };

  const trendingArtists = React.useMemo(() => {
    if (!Array.isArray(dbTrendingArtists)) return dbTrendingArtists;
    return dedupe(dbTrendingArtists, (a) => (a.slug || a.ticketmasterId || a._id || a.name || '').toString().toLowerCase());
  }, [dbTrendingArtists]);

  const trendingShows = React.useMemo(() => {
    if (!Array.isArray(dbTrendingShows)) return dbTrendingShows;
    return dedupe(dbTrendingShows, (s) => (s.slug || s.cachedTrending?.showSlug || s.ticketmasterId || s._id || '').toString().toLowerCase());
  }, [dbTrendingShows]);

  const availableArtistCategories = useMemo(() => {
    if (!Array.isArray(trendingArtists)) return [{ label: "All" as ArtistCategory, count: 0 }];
    const counts = new Map<ArtistCategory, number>();
    for (const artist of trendingArtists) {
      const category = getArtistCategory(artist);
      if (category !== "Other") counts.set(category, (counts.get(category) || 0) + 1);
    }
    return ARTIST_CATEGORIES
      .map((category) => ({
        label: category.label,
        count: category.label === "All" ? trendingArtists.length : counts.get(category.label) || 0,
      }))
      .filter((category) => category.label === "All" || category.count > 0);
  }, [trendingArtists]);

  const visibleTrendingArtists = useMemo(() => {
    if (!Array.isArray(trendingArtists)) return trendingArtists;
    if (artistCategory === "All") return trendingArtists;
    return trendingArtists.filter((artist) => getArtistCategory(artist) === artistCategory);
  }, [artistCategory, trendingArtists]);

  // Keep the strongest touring artists prominent while using the wider cache
  // to surface a small rotating group of rising/discovery acts on every cache
  // cycle. Without this mix, Spotify popularity makes the first row look frozen
  // even when Ticketmaster has supplied new tour inventory.
  const surfacedTrendingArtists = useMemo(() => {
    if (!Array.isArray(visibleTrendingArtists)) return visibleTrendingArtists;
    if (artistCategory !== "All" || visibleTrendingArtists.length <= 12) {
      return visibleTrendingArtists.slice(0, 12);
    }

    const leaders = visibleTrendingArtists.slice(0, 8);
    const discoveryPool = visibleTrendingArtists.slice(8);
    const lastUpdated = Number((dbTrendingArtistsResult as any)?.lastUpdated || 0);
    const refreshCycle = Math.floor(lastUpdated / (60 * 60 * 1000));
    const offset = discoveryPool.length > 0 ? refreshCycle % discoveryPool.length : 0;
    const rotatedDiscoveries = [
      ...discoveryPool.slice(offset),
      ...discoveryPool.slice(0, offset),
    ].slice(0, 4);

    return [
      ...leaders.slice(0, 4),
      ...rotatedDiscoveries.slice(0, 2),
      ...leaders.slice(4, 8),
      ...rotatedDiscoveries.slice(2, 4),
    ];
  }, [artistCategory, dbTrendingArtistsResult, visibleTrendingArtists]);

  const visibleTrendingShows = useMemo(() => {
    if (!Array.isArray(trendingShows)) return trendingShows;
    return [...trendingShows].sort((a: any, b: any) => {
      if (showOrder === "popular") {
        // Ticketmaster relevance supplies broad market demand; live fan voting
        // and Convex engagement provide a setlists.live-specific boost.
        const aScore =
          (a?.voteCount || 0) * 100 +
          (a?.trendingScore || 0) * 25 +
          (1000 - (a?.cachedTrending?.rank || 999));
        const bScore =
          (b?.voteCount || 0) * 100 +
          (b?.trendingScore || 0) * 25 +
          (1000 - (b?.cachedTrending?.rank || 999));
        if (aScore !== bScore) return bScore - aScore;
      }
      return String(a?.date || "").localeCompare(String(b?.date || ""));
    });
  }, [showOrder, trendingShows]);

  const isLoading = dbTrendingShows === undefined || dbTrendingArtists === undefined;

  const formatUpdatedAt = (ts?: number) => {
    if (!ts || !Number.isFinite(ts)) return null;
    const diffMs = Date.now() - ts;
    if (diffMs < 0) return "just now";
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 48) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
  };

  const trendingArtistsMeta = useMemo(() => {
    if (dbTrendingArtistsResult === undefined) return undefined;
    if (!dbTrendingArtistsResult) return null;
    const lastUpdated = (dbTrendingArtistsResult as any).lastUpdated as number | undefined;
    const isFallback = Boolean((dbTrendingArtistsResult as any).isFallback);
    const source = (dbTrendingArtistsResult as any).source as string | undefined;
    return { lastUpdated, isFallback, source };
  }, [dbTrendingArtistsResult]);

  const trendingShowsMeta = useMemo(() => {
    if (dbTrendingShowsResult === undefined) return undefined;
    if (!dbTrendingShowsResult) return null;
    const lastUpdated = (dbTrendingShowsResult as any).lastUpdated as number | undefined;
    const isFallback = Boolean((dbTrendingShowsResult as any).isFallback);
    const source = (dbTrendingShowsResult as any).source as string | undefined;
    return { lastUpdated, isFallback, source };
  }, [dbTrendingShowsResult]);

  // Animation variants - smooth opacity-only to prevent layout shift
  const heroVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.1, delayChildren: shouldReduceMotion ? 0 : 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0 },
    show: { 
      opacity: 1,
      transition: { duration: shouldReduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] as const }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.05 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0 },
    show: { 
      opacity: 1,
      transition: { duration: shouldReduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] as const }
    }
  };

  // Handler for clicking on trending artists - navigates instantly if already in DB
  const handleTrendingArtistClick = async (artist: any) => {
    // If this is already a real `artists` document, navigate instantly.
    // (Cached `trendingArtists` rows can also be hydrated into full artist docs.)
    const slug = artist?.slug;
    const isArtistDoc = typeof artist?.lowerName === "string" || typeof artist?.ticketmasterId === "string" && typeof artist?.lastSynced === "number";
    if (isArtistDoc && slug) {
      navigateTo(`/artists/${slug}`);
      return;
    }

    // If the artist has a linked artists-table ID (from cachedTrending), navigate instantly.
    const linkedArtistId = artist?.artistId || artist?.cachedTrending?.artistId;
    
    // If artist is already linked to main artists table, navigate instantly (no import needed)
    // Real artist IDs from the artists table start with 'j' (e.g., j97...)
    if (linkedArtistId && typeof linkedArtistId === 'string' && linkedArtistId.startsWith('j')) {
      // Navigate instantly - no loading toast needed
      navigateTo(`/artists/${slug || linkedArtistId}`);
      return;
    }
    
    // Also check if the artist has sync status indicating it's fully imported
    if (artist?.syncStatus?.catalogImported && slug) {
      // Already imported, navigate instantly
      navigateTo(`/artists/${slug}`);
      return;
    }
    
    // Artist is in cache but not in main DB - trigger import
    if (artist?.ticketmasterId && artist?.name) {
      setImportingArtist(artist.ticketmasterId);
      try {
        toast.info(`Loading ${artist.name}...`, { duration: 2000 });
        const result = await triggerArtistSync({
          ticketmasterId: artist.ticketmasterId,
          artistName: artist.name,
          genres: artist.genres || [],
          images: artist.images || [],
          upcomingEvents: artist.upcomingEvents || 0,
        });
        
        if (result.type === 'artist' && result.slug) {
          navigateTo(`/artists/${result.slug}`);
        } else if (result.type === 'festival' && result.slug) {
          navigateTo(`/festivals/${result.slug}`);
        }
      } catch (error) {
        console.error('Failed to import artist:', error);
        toast.error(`Failed to load ${artist.name}`);
        // Still try to navigate using the slug as fallback
        if (slug) {
          navigateTo(`/artists/${slug}`);
        }
      } finally {
        setImportingArtist(null);
      }
      return;
    }
    
    // Fallback: just navigate to slug
    if (slug) {
      navigateTo(`/artists/${slug}`);
    }
  };

  return (
    <div className="w-full">
      {/* Hero Section — action-first: headline, one subline, search as the hero object */}
      <motion.section
        className="relative w-full pt-6 pb-6 md:pt-12 md:pb-10"
        initial="hidden"
        animate="show"
        variants={heroVariants}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h1
              variants={itemVariants}
              className="text-[1.75rem] leading-[1.15] sm:text-4xl md:text-5xl font-bold tracking-tight gradient-text"
            >
              See what fans want to hear — before doors open
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mt-2 text-sm md:text-base text-muted-foreground max-w-xl mx-auto"
            >
              Vote on the setlist for any upcoming show.{' '}
              <a
                href="/about"
                className="whitespace-nowrap text-muted-foreground/80 underline underline-offset-4 decoration-border hover:text-foreground transition-colors"
              >
                How it works <span aria-hidden="true">→</span>
              </a>
            </motion.p>

            {/* Search Bar — the primary hero action */}
            <motion.div
              variants={itemVariants}
              className="mt-4 md:mt-5 max-w-md mx-auto relative z-[100]"
            >
              <SearchBar
                onResultClick={(type, id, slug) => {
                  if (type === 'artist') {
                    navigateTo(`/artists/${slug || id}`);
                  } else if (type === 'show') {
                    navigateTo(`/shows/${slug || id}`);
                  } else if (type === 'venue') {
                    navigateTo(`/venues/${slug || id}`);
                  }
                }}
              />
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Live discovery pulse — makes freshness and catalog depth visible. */}
      <motion.section
        className="container mx-auto mb-6 px-4 sm:mb-8"
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.28, delay: shouldReduceMotion ? 0 : 0.12 }}
      >
        <div className="grid grid-cols-[1.2fr_1fr_1fr] overflow-hidden rounded-2xl border border-border/80 bg-card/55 shadow-sm backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2.5 border-r border-border/70 px-3 py-3 sm:px-4">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Radio className="h-4 w-4" />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground sm:text-sm">Live tour pulse</p>
              <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
                {trendingShowsMeta?.isFallback
                  ? "Refreshing discovery"
                  : `Updated ${formatUpdatedAt(trendingShowsMeta?.lastUpdated) || "recently"}`}
              </p>
            </div>
          </div>
          <div className="flex flex-col justify-center border-r border-border/70 px-3 py-3 text-center sm:px-4">
            <span className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {Array.isArray(trendingArtists) ? trendingArtists.length : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground sm:text-xs">artists touring</span>
          </div>
          <div className="flex flex-col justify-center px-3 py-3 text-center sm:px-4">
            <span className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {Array.isArray(trendingShows) ? trendingShows.length : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground sm:text-xs">show picks</span>
          </div>
        </div>
      </motion.section>

      {/* Personalization Layer - signed-in users only (signed-out CTA lives below the first trending section) */}
      {isClerkLoaded && isSignedIn && (hasSpotify ? sortedSpotifyArtists.length > 0 : true) && (
      <div className="container mx-auto px-4 mb-6 sm:mb-8">
        {/* State 1: Logged in WITH Spotify - Show their artists on tour */}
        {hasSpotify && sortedSpotifyArtists.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <MagicCard className="p-0 rounded-xl border-0 bg-card overflow-hidden">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <FaSpotify className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-foreground">Your Artists on Tour</h2>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {sortedSpotifyArtists.length} of your artists have upcoming shows
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigateTo('/activity')}
                    className="text-xs sm:text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                
                {/* Horizontal snap-scroll on mobile, grid on larger screens */}
                <div className="flex sm:grid sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 overflow-x-auto sm:overflow-x-visible snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {sortedSpotifyArtists.slice(0, 12).map((item) => (
                    <div
                      key={item.artist._id}
                      className="shrink-0 w-[30%] min-[420px]:w-[24%] sm:w-auto snap-start"
                    >
                      <SpotifyArtistCard
                        item={item}
                        onClick={() => onArtistClick(item.artist._id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <BorderBeam size={100} duration={12} className="opacity-20" />
            </MagicCard>
          </motion.section>
        )}
        
        {/* State 2: Logged in WITHOUT Spotify - compact connect banner */}
        {!hasSpotify && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 p-3 sm:p-4">
                <FaSpotify className="h-5 w-5 text-green-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">See your artists on tour</p>
                  <p className="text-xs text-muted-foreground truncate">Connect Spotify to find their upcoming shows</p>
                </div>
                <button
                  onClick={() => navigateTo('/spotify-connect')}
                  className="shrink-0 min-h-[44px] px-4 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-full transition-colors flex items-center justify-center gap-2"
                >
                  <FaSpotify className="h-4 w-4" />
                  Connect
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </div>
      )}

      {/* Content Sections */}
      <div className="container mx-auto px-4 space-y-8 md:space-y-12 pb-16">

        {/* Trending Artists */}
        <section className="relative">
          <div className="flex items-end justify-between gap-3 mb-3 sm:mb-4">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90 sm:text-[11px]">
                <Flame className="h-3.5 w-3.5" />
                Touring now
              </div>
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Trending Artists</h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Explore the artists moving tickets across every sound
                {trendingArtistsMeta && (
                  <span className="text-muted-foreground/60">
                    {" "}·{" "}
                    {trendingArtistsMeta.isFallback
                      ? "Refreshing…"
                      : `Updated ${formatUpdatedAt(trendingArtistsMeta.lastUpdated) ?? "recently"}`}
                  </span>
                )}
              </p>
            </div>
            <motion.button
              onClick={() => navigateTo('/trending')}
              className="shrink-0 text-xs sm:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors min-h-[44px]"
              whileHover={shouldReduceMotion ? undefined : { x: 2 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            >
              View all <ArrowRight className="h-3 w-3" />
            </motion.button>
          </div>

          {!isLoading && availableArtistCategories.length > 1 && (
            <div className="-mx-4 mb-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
              {availableArtistCategories.map((category) => {
                const active = artistCategory === category.label;
                return (
                  <motion.button
                    key={category.label}
                    type="button"
                    onClick={() => {
                      capture("discovery_filter_changed", {
                        context: "homepage",
                        filter_name: "artist_category",
                        previous_value: artistCategory,
                        filter_value: category.label,
                        result_count: category.count,
                      });
                      setArtistCategory(category.label);
                    }}
                    className={`relative flex h-9 shrink-0 snap-start items-center gap-1.5 overflow-hidden rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? "border-foreground/20 text-background"
                        : "border-border bg-card/55 text-muted-foreground hover:text-foreground"
                    }`}
                    whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                  >
                    {active && (
                      <motion.span
                        layoutId="homepage-artist-category"
                        className="absolute inset-0 bg-foreground"
                        transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <span className="relative z-10">{category.label}</span>
                    <span className={`relative z-10 text-[10px] ${active ? "text-background/65" : "text-muted-foreground/60"}`}>
                      {category.count}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}

          <div>
            {isLoading ? (
              <>
                <div className="sm:hidden">
                  <ArtistShelfSkeleton />
                </div>
                <div className="hidden sm:block">
                  <GridSkeleton count={12} />
                </div>
              </>
            ) : (visibleTrendingArtists as any[])?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Music className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No trending artists yet</p>
              </div>
            ) : (
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={artistCategory}
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0 }}
                >
                  {/* Mobile: editorial horizontal snap-scroll shelf */}
                  <div className="sm:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 scrollbar-hide">
                    {(surfacedTrendingArtists as any[]).map((artist: any, index: number) => {
                      const artistId = artist?._id || artist?.artistId;
                      const isImporting = importingArtist === artist.ticketmasterId;

                      return (
                        <motion.div key={`shelf-${artistId || artist.ticketmasterId}-${index}`} variants={cardVariants} className="shrink-0 snap-start">
                          <ArtistShelfCard
                            artist={artist}
                            onClick={() => handleTrendingArtistClick(artist)}
                            isLoading={isImporting}
                          />
                        </motion.div>
                      );
                    })}
                  </div>
                  {/* Desktop: grid */}
                  <div className="hidden sm:grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {(surfacedTrendingArtists as any[]).map((artist: any, index: number) => {
                      const artistId = artist?._id || artist?.artistId;
                      const isImporting = importingArtist === artist.ticketmasterId;

                      return (
                        <motion.div key={`${artistId || artist.ticketmasterId}-${index}`} variants={cardVariants}>
                          <ArtistCard
                            artist={artist}
                            onClick={() => handleTrendingArtistClick(artist)}
                            isLoading={isImporting}
                          />
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </section>

        {/* Signed-out CTA — compact banner, demoted below the first trending section */}
        {(!isClerkLoaded || !isSignedIn) && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 p-3 sm:p-4">
                <FaSpotify className="h-5 w-5 text-green-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">Get personalized shows</p>
                  <button
                    onClick={() => navigateTo('/signin')}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Already have an account? <span className="underline underline-offset-2">Sign in</span>
                  </button>
                </div>
                <button
                  onClick={() => navigateTo('/signup')}
                  className="shrink-0 min-h-[44px] px-4 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-full transition-colors flex items-center justify-center gap-2"
                >
                  <FaSpotify className="h-4 w-4" />
                  Sign up<span className="hidden sm:inline"> with Spotify</span>
                </button>
              </div>
            </div>
          </motion.section>
        )}

        {/* Featured Festivals */}
        {featuredFestivals && featuredFestivals.length > 0 && (
          <section className="relative">
            <div className="flex items-end justify-between gap-3 mb-3 sm:mb-4">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Upcoming Festivals</h2>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Major music festivals this year</p>
              </div>
              <button
                onClick={() => navigateTo('/festivals')}
                className="shrink-0 text-xs sm:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors min-h-[44px]"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {featuredFestivals.slice(0, 6).map((festival: any) => (
                <FestivalCard
                  key={festival._id}
                  festival={festival}
                  onClick={() => navigateTo(`/festivals/${festival.slug}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Shows */}
        <section className="relative">
          <div className="flex items-end justify-between gap-3 mb-3 sm:mb-4">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-400/90 sm:text-[11px]">
                <CalendarDays className="h-3.5 w-3.5" />
                Pick a night
              </div>
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">Upcoming Shows</h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                Artist-diverse concerts, refreshed automatically
                {trendingShowsMeta && (
                  <span className="text-muted-foreground/60">
                    {" "}·{" "}
                    {trendingShowsMeta.isFallback
                      ? "Refreshing…"
                      : `Updated ${formatUpdatedAt(trendingShowsMeta.lastUpdated) ?? "recently"}`}
                  </span>
                )}
              </p>
            </div>
            <motion.button
              onClick={() => navigateTo('/shows')}
              className="shrink-0 text-xs sm:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors min-h-[44px]"
              whileHover={shouldReduceMotion ? undefined : { x: 2 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            >
              View all <ArrowRight className="h-3 w-3" />
            </motion.button>
          </div>

          {!isLoading && Array.isArray(visibleTrendingShows) && visibleTrendingShows.length > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <div className="inline-flex rounded-xl border border-border bg-card/55 p-1">
                {([
                  { value: "soonest", label: "Soonest", icon: Clock3 },
                  { value: "popular", label: "Popular", icon: Flame },
                ] as const).map((option) => {
                  const Icon = option.icon;
                  const active = showOrder === option.value;
                  return (
                    <motion.button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        capture("discovery_filter_changed", {
                          context: "homepage",
                          filter_name: "show_order",
                          previous_value: showOrder,
                          filter_value: option.value,
                          result_count: Array.isArray(visibleTrendingShows)
                            ? visibleTrendingShows.length
                            : 0,
                        });
                        setShowOrder(option.value);
                      }}
                      className={`relative flex h-8 items-center gap-1.5 overflow-hidden rounded-lg px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                      whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                    >
                      {active && (
                        <motion.span
                          layoutId="homepage-show-order"
                          className="absolute inset-0 border border-border/80 bg-accent/80 shadow-sm"
                          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                        />
                      )}
                      <Icon className="relative z-10 h-3.5 w-3.5" />
                      <span className="relative z-10">{option.label}</span>
                    </motion.button>
                  );
                })}
              </div>
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  key={showOrder}
                  className="text-[11px] text-muted-foreground sm:text-xs"
                  initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -4 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.14 }}
                >
                  {showOrder === "soonest"
                    ? "Nearest tour dates first"
                    : "Ticketmaster demand + live fan activity"}
                </motion.span>
              </AnimatePresence>
            </div>
          )}

          <div>
            {isLoading ? (
              <GridSkeleton count={12} />
            ) : (visibleTrendingShows as any[])?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Music className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No shows available</p>
              </div>
            ) : (
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={showOrder}
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0 }}
                >
                  {(visibleTrendingShows as any[]).slice(0, 12).map((show: any, index: number) => (
                    <motion.div key={`${show._id || show.showId}-${index}`} variants={cardVariants}>
                      <ShowCard
                        show={show}
                        onClick={() => {
                          const showId = show._id || show.showId;
                          const slug = show.slug || show.cachedTrending?.showSlug;
                          onShowClick(showId || slug || show.ticketmasterId, slug);
                        }}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// Artist Card - Compact with silver glow
function ArtistCard({ artist, onClick, isLoading }: { artist: any; onClick: () => void; isLoading?: boolean }) {
  return (
    <motion.div 
      className={`w-full cursor-pointer ${isLoading ? 'pointer-events-none' : ''}`}
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glow-card glow-card-hover overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
        <div className="relative w-full aspect-square overflow-hidden rounded-t-[0.75rem]">
          {artist.images?.[0] ? (
            <img 
              src={artist.images[0]} 
              alt={artist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
              <span className="text-foreground/60 font-bold text-xl">
                {(typeof artist?.name === 'string' && artist.name.length > 0 ? artist.name : '??').slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        </div>
        <div className="p-2.5 sm:p-3">
          <h3 className="text-foreground font-semibold text-xs sm:text-sm line-clamp-1">
            {artist.name}
          </h3>
          <div className="flex items-center justify-between mt-1">
            <p className="text-muted-foreground text-[10px] sm:text-xs">
              {artist.upcomingEvents || artist.upcomingShowsCount || 0} shows
            </p>
            {artist.genres?.[0] && (
              <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground truncate max-w-[50px]">
                {artist.genres[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Artist Shelf Card - image-led card for the mobile horizontal snap-scroll shelf
function ArtistShelfCard({ artist, onClick, isLoading }: { artist: any; onClick: () => void; isLoading?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`relative shrink-0 snap-start w-[40vw] max-w-[170px] aspect-[4/5] rounded-xl overflow-hidden bg-secondary border border-border text-left ${isLoading ? 'pointer-events-none' : ''}`}
    >
      {artist.images?.[0] ? (
        <img
          src={artist.images[0]}
          alt={artist.name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary to-secondary/50">
          <span className="text-foreground/60 font-bold text-xl">
            {(typeof artist?.name === 'string' && artist.name.length > 0 ? artist.name : '??').slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}
      {/* Gradient scrim for legible overlaid text */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2">
          {artist.name}
        </h3>
        <p className="text-white/70 text-[11px] mt-0.5">
          {artist.upcomingEvents || artist.upcomingShowsCount || 0} shows
        </p>
      </div>
    </motion.button>
  );
}

// Skeleton matching the mobile shelf card dimensions (prevents layout jump)
function ArtistShelfSkeleton() {
  const shimmerClass = "bg-gradient-to-r from-muted via-muted/60 to-muted animate-shimmer bg-[length:200%_100%]";
  return (
    <div className="flex gap-3 overflow-x-hidden -mx-4 px-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className={`shrink-0 w-[40vw] max-w-[170px] aspect-[4/5] rounded-xl border border-border ${shimmerClass}`}
        />
      ))}
    </div>
  );
}

// Show Card - Compact with silver glow
function ShowCard({ show, onClick }: { show: any; onClick: () => void }) {
  const showDate = new Date(show.date);
  const shouldReduceMotion = useReducedMotion();
  const artistName = show.artist?.name || show.artistName || "Artist";
  const venueName = show.venue?.name || show.venueName || "Venue TBA";
  const location = formatLocation(show.venue?.city || show.venueCity, show.venue?.state || show.venueState);

  return (
    <motion.div 
      className="w-full cursor-pointer"
      onClick={onClick}
      whileHover={shouldReduceMotion ? undefined : { y: -4 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
    >
      <div className="glow-card glow-card-hover group overflow-hidden">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-[0.75rem] sm:aspect-square">
          {(() => {
            const imgSrc = show?.artist?.images?.[0] || show?.artistImage || show?.cachedTrending?.artistImage;
            return imgSrc ? (
              <img
                src={imgSrc}
                alt={artistName}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
                <span className="text-foreground/60 font-bold text-xl">
                  {((show?.artist?.name || show?.artistName || '??') as string).slice(0, 2).toUpperCase()}
                </span>
              </div>
            );
          })()}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
          
          {/* Date Badge */}
          <div className="absolute left-2 top-2">
            <div className="rounded-lg border border-white/15 bg-black/70 px-2 py-1 text-white backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide">
                {showDate.toLocaleDateString('en-US', { month: 'short' })}
              </p>
              <p className="text-base font-bold leading-none">{showDate.getDate()}</p>
            </div>
          </div>
        </div>

        <div className="p-2.5 sm:p-3">
          <h3 className="text-foreground font-semibold text-xs sm:text-sm line-clamp-1">
            {artistName}
          </h3>
          <p className="mt-1 truncate text-[10px] font-medium text-foreground/70 sm:text-xs">{venueName}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground sm:text-xs">
            <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{location || "Location TBA"}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// Spotify Artist Card - Compact card for Your Artists section
function SpotifyArtistCard({ item, onClick }: { item: any; onClick: () => void }) {
  return (
    <motion.div
      className="w-full cursor-pointer group"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative">
        <div className="relative w-full aspect-square glow-card-sm glow-card-hover overflow-hidden bg-secondary">
          {item.artist.images?.[0] ? (
            <img 
              src={item.artist.images[0]} 
              alt={item.artist.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-foreground/40 font-bold text-xl">
              {item.artist.name?.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Top artist badge */}
          {item.isTopArtist && item.topArtistRank && item.topArtistRank <= 5 && (
            <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
              #{item.topArtistRank}
            </div>
          )}
          
          {/* Show count badge */}
          <div className="absolute bottom-1.5 right-1.5 bg-background/90 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            {item.upcomingShowsCount} {item.upcomingShowsCount === 1 ? 'show' : 'shows'}
          </div>
        </div>
        <p className="mt-2 text-xs sm:text-sm font-medium text-foreground truncate text-center">
          {item.artist.name}
        </p>
      </div>
    </motion.div>
  );
}

// Festival Card - Vibrant with silver glow
function FestivalCard({ festival, onClick }: { festival: any; onClick: () => void }) {
  const startDate = new Date(festival.startDate);
  const endDate = new Date(festival.endDate);
  
  // Format date range
  const formatDateRange = () => {
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  };

  return (
    <motion.div 
      className="w-full cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glow-card glow-card-hover overflow-hidden">
        <div className="relative w-full aspect-square overflow-hidden rounded-t-[0.75rem]">
          {festival.imageUrl ? (
            <img
              src={festival.imageUrl}
              alt={festival.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600/40 to-pink-600/40 flex items-center justify-center">
              <span className="text-white/80 font-bold text-xl">
                {(festival.name || '??').slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Date Badge */}
          <div className="absolute top-1.5 right-1.5">
            <div className="bg-purple-500/90 backdrop-blur-sm rounded-md px-1.5 py-0.5">
              <p className="text-white text-[10px] font-semibold">
                {formatDateRange()}
              </p>
            </div>
          </div>
          
          {/* Artist Count Badge */}
          {festival.artistCount > 0 && (
            <div className="absolute bottom-1.5 left-1.5">
              <div className="bg-background/90 backdrop-blur-sm rounded-md px-1.5 py-0.5 border border-border/50">
                <p className="text-foreground text-[10px] font-medium">
                  {festival.artistCount} artists
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-2.5 sm:p-3">
          <h3 className="text-foreground font-semibold text-xs sm:text-sm line-clamp-1">
            {festival.name}
          </h3>
          <div className="mt-1">
            <p className="text-muted-foreground text-[10px] sm:text-xs flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">{festival.city}{festival.state ? `, ${festival.state}` : ''}</span>
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
