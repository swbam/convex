import React, { useMemo } from 'react';
import { useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Users, MapPin, Music, Sparkles, ArrowRight, Ticket } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { Id } from "../../convex/_generated/dataModel";
import { ArtistCardSkeleton, ShowCardSkeleton, FestivalCardSkeleton } from "./LoadingSkeleton";
import { motion } from "framer-motion";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { FaSpotify } from "react-icons/fa";
import { EmblaCarousel, SLIDE_SIZES } from "./ui/embla-carousel";

interface PublicDashboardProps {
  onArtistClick: (artistKey: Id<"artists"> | string) => void;
  onShowClick: (showKey: Id<"shows"> | string, slug?: string) => void;
  onSignInRequired: () => void;
  navigate: (path: string) => void;
}

export function PublicDashboard({ onArtistClick, onShowClick }: PublicDashboardProps) {
  const navigateTo = useNavigate();
  const { user, isSignedIn, isLoaded: isClerkLoaded } = useUser();

  // Load trending data
  const dbTrendingShowsResult = useQuery(api.trending.getTrendingShows, { limit: 20 });
  const dbTrendingArtistsResult = useQuery(api.trending.getTrendingArtists, { limit: 20 });
  
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
      return user.externalAccounts.some((account) => account.provider === 'oauth_spotify');
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

  const isLoading = dbTrendingShows === undefined || dbTrendingArtists === undefined;

  // Animation variants - smooth opacity-only to prevent layout shift
  const heroVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0 },
    show: { 
      opacity: 1,
      transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0 },
    show: { 
      opacity: 1,
      transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <div className="w-full">
      {/* Hero Section with Search */}
      <motion.section 
        className="relative w-full pt-8 pb-10 md:pt-12 md:pb-14"
        initial="hidden"
        animate="show"
        variants={heroVariants}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <motion.h1 
              variants={itemVariants}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight gradient-text"
            >
              Crowdsourced Concert Setlists
            </motion.h1>
            
            <motion.p 
              variants={itemVariants}
              className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto"
            >
              See your favorite artists' upcoming shows. Vote on songs before the concert. See what actually got played after.
            </motion.p>
            
            <motion.a
              href="/about"
              variants={itemVariants}
              className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              How it works
              <span aria-hidden="true">→</span>
            </motion.a>
        
            {/* Search Bar */}
            <motion.div 
              variants={itemVariants}
              className="max-w-md mx-auto pt-2 relative z-[100]"
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

      {/* Personalization Layer - Conditional based on auth status */}
      <div className="container mx-auto px-4 mb-8">
        {/* State 1: Logged in WITH Spotify - Show their artists on tour */}
        {isClerkLoaded && isSignedIn && hasSpotify && sortedSpotifyArtists.length > 0 && (
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
                
                {/* Gametime-style horizontal carousel */}
                <EmblaCarousel
                  slideClassName="w-[120px] sm:w-[140px]"
                  autoScroll={false}
                  showArrows={true}
                  showDots={true}
                >
                  {sortedSpotifyArtists.slice(0, 15).map((item) => (
                    <SpotifyArtistCard
                      key={item.artist._id}
                      item={item}
                      onClick={() => onArtistClick(item.artist._id)}
                    />
                  ))}
                </EmblaCarousel>
              </div>
              <BorderBeam size={100} duration={12} className="opacity-20" />
            </MagicCard>
          </motion.section>
        )}
        
        {/* State 2: Logged in WITHOUT Spotify - Show connect CTA */}
        {isClerkLoaded && isSignedIn && !hasSpotify && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <MagicCard className="p-0 rounded-xl border-0 bg-gradient-to-br from-green-500/10 to-green-500/5 overflow-hidden">
              <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FaSpotify className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">See Your Artists on Tour</h3>
                    <p className="text-sm text-muted-foreground">Connect Spotify to instantly see which of your favorite artists have upcoming shows</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigateTo('/spotify-connect')}
                  className="w-full sm:w-auto px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <FaSpotify className="h-4 w-4" />
                  Connect Spotify
                </button>
              </div>
              <BorderBeam size={100} duration={10} className="opacity-20" />
            </MagicCard>
          </motion.section>
        )}
        
        {/* State 3: Logged OUT (or Clerk not loaded) - Show sign up with Spotify CTA */}
        {(!isClerkLoaded || !isSignedIn) && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <MagicCard className="p-0 rounded-xl border-0 bg-gradient-to-br from-green-500/10 via-card to-card overflow-hidden">
              <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Get Personalized Shows</h3>
                    <p className="text-sm text-muted-foreground">Sign up with Spotify to instantly see your top artists' upcoming concerts</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => navigateTo('/signup')}
                    className="w-full sm:w-auto px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <FaSpotify className="h-4 w-4" />
                    Sign up with Spotify
                  </button>
                  <button 
                    onClick={() => navigateTo('/signin')}
                    className="w-full sm:w-auto px-6 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground font-medium rounded-xl transition-colors"
                  >
                    Sign in
                  </button>
                </div>
              </div>
              <BorderBeam size={100} duration={10} className="opacity-20" />
            </MagicCard>
          </motion.section>
        )}
      </div>

      {/* Content Sections */}
      <div className="container mx-auto px-4 space-y-12 pb-16">
        
        {/* Trending Artists - Gametime-style carousel */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-secondary flex items-center justify-center border border-border">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-foreground/80" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Trending Artists</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">Popular artists with upcoming shows</p>
              </div>
            </div>
            <button
              onClick={() => navigateTo('/trending')}
              className="text-xs sm:text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          
          <div>
            {isLoading ? (
              <div className="flex gap-4 overflow-hidden">
                {[...Array(6)].map((_, i) => <ArtistCardSkeleton key={i} />)}
              </div>
            ) : (trendingArtists as any[])?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Music className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No trending artists yet</p>
              </div>
            ) : (
              <EmblaCarousel
                slideClassName={SLIDE_SIZES.artist}
                autoScroll={true}
                autoScrollSpeed={0.8}
                showDots={true}
              >
                {(trendingArtists as any[]).map((artist: any, index: number) => {
                  const artistId = artist?._id || artist?.artistId;
                  const slug = artist?.slug 
                    || artist?.cachedTrending?.slug 
                    || (typeof artist.name === 'string' && artist.name.length > 0 
                        ? artist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                        : undefined);
                  
                  return (
                    <ArtistCard 
                      key={`${artistId}-${index}`}
                      artist={artist} 
                      onClick={() => onArtistClick(artistId || slug || artist.ticketmasterId)} 
                    />
                  );
                })}
              </EmblaCarousel>
            )}
          </div>
        </motion.section>

        {/* Featured Festivals - Gametime-style carousel */}
        {featuredFestivals && featuredFestivals.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.12 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-border">
                  <Ticket className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">Upcoming Festivals</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">Major music festivals this year</p>
                </div>
              </div>
              <button
                onClick={() => navigateTo('/festivals')}
                className="text-xs sm:text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            
            <EmblaCarousel
              slideClassName={SLIDE_SIZES.festival}
              autoScroll={true}
              autoScrollSpeed={0.6}
              showDots={true}
            >
              {featuredFestivals.map((festival: any) => (
                <FestivalCard
                  key={festival._id}
                  festival={festival}
                  onClick={() => navigateTo(`/festivals/${festival.slug}`)}
                />
              ))}
            </EmblaCarousel>
          </motion.section>
        )}

        {/* Upcoming Shows - Gametime-style carousel */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-secondary flex items-center justify-center border border-border">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-foreground/80" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Upcoming Shows</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">Popular upcoming concerts</p>
              </div>
            </div>
            <button
              onClick={() => navigateTo('/shows')}
              className="text-xs sm:text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div>
            {isLoading ? (
              <div className="flex gap-4 overflow-hidden">
                {[...Array(6)].map((_, i) => <ShowCardSkeleton key={i} />)}
              </div>
            ) : (trendingShows as any[])?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Music className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No shows available</p>
              </div>
            ) : (
              <EmblaCarousel
                slideClassName={SLIDE_SIZES.show}
                autoScroll={true}
                autoScrollSpeed={1}
                showDots={true}
              >
                {(trendingShows as any[]).map((show: any, index: number) => (
                  <ShowCard
                    key={`${show._id || show.showId}-${index}`}
                    show={show}
                    onClick={() => {
                      const showId = show._id || show.showId;
                      const slug = show.slug || show.cachedTrending?.showSlug;
                      onShowClick(showId || slug || show.ticketmasterId, slug);
                    }}
                  />
                ))}
              </EmblaCarousel>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}

// Artist Card - Compact and consistent
function ArtistCard({ artist, onClick }: { artist: any; onClick: () => void }) {
  return (
    <motion.div 
      className="w-full cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-xl overflow-hidden shadow-elevated">
        <div className="relative w-full aspect-square overflow-hidden">
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
              {artist.upcomingShowsCount || 0} shows
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

// Show Card - Compact and consistent
function ShowCard({ show, onClick }: { show: any; onClick: () => void }) {
  const showDate = new Date(show.date);

  return (
    <motion.div 
      className="w-full cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-xl overflow-hidden shadow-elevated">
        <div className="relative w-full aspect-square overflow-hidden">
          {(() => {
            const imgSrc = show?.artist?.images?.[0] || show?.artistImage || show?.cachedTrending?.artistImage;
            return imgSrc ? (
              <img
                src={imgSrc}
                alt={show.artist?.name || show.artistName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
                <span className="text-foreground/60 font-bold text-xl">
                  {((show?.artist?.name || show?.artistName || '??') as string).slice(0, 2).toUpperCase()}
                </span>
              </div>
            );
          })()}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          
          {/* Date Badge */}
          <div className="absolute top-1.5 right-1.5">
            <div className="bg-background/90 backdrop-blur-sm rounded-md px-1.5 py-0.5 border border-border/50">
              <p className="text-foreground text-[10px] font-semibold">
                {showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        <div className="p-2.5 sm:p-3">
          <h3 className="text-foreground font-semibold text-xs sm:text-sm line-clamp-1">
            {show.artist?.name || show.artistName}
          </h3>
          {show.venue && (
            <div className="mt-1">
              <p className="text-muted-foreground text-[10px] sm:text-xs flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="truncate">{show.venue.city}{show.venue.state ? `, ${show.venue.state}` : ''}</span>
              </p>
            </div>
          )}
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
        <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-secondary">
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

// Festival Card - Vibrant and eye-catching
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
      <div className="glass-card glass-card-hover rounded-xl overflow-hidden shadow-elevated border-purple-500/20">
        <div className="relative w-full aspect-square overflow-hidden">
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
