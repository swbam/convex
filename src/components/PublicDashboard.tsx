import React from 'react';
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Users, MapPin, Music, Sparkles } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { Id } from "../../convex/_generated/dataModel";
import { ArtistCardSkeleton, ShowCardSkeleton } from "./LoadingSkeleton";
import { motion } from "framer-motion";

interface PublicDashboardProps {
  onArtistClick: (artistKey: Id<"artists"> | string) => void;
  onShowClick: (showKey: Id<"shows"> | string, slug?: string) => void;
  onSignInRequired: () => void;
  navigate: (path: string) => void;
}

export function PublicDashboard({ onArtistClick, onShowClick, onSignInRequired, navigate }: PublicDashboardProps) {
  const navigateTo = useNavigate();

  // Load trending data directly from the optimized trending system
  const dbTrendingShowsResult = useQuery(api.trending.getTrendingShows, { limit: 20 });
  const dbTrendingArtistsResult = useQuery(api.trending.getTrendingArtists, { limit: 20 });
  
  // Extract page arrays from paginated results with robust guards
  const dbTrendingShows = React.useMemo(() => {
    if (dbTrendingShowsResult === undefined) return undefined; // loading
    if (dbTrendingShowsResult === null) return [];
    return Array.isArray(dbTrendingShowsResult.page) ? dbTrendingShowsResult.page : [];
  }, [dbTrendingShowsResult]);
  const dbTrendingArtists = React.useMemo(() => {
    if (dbTrendingArtistsResult === undefined) return undefined; // loading
    if (dbTrendingArtistsResult === null) return [];
    return Array.isArray(dbTrendingArtistsResult.page) ? dbTrendingArtistsResult.page : [];
  }, [dbTrendingArtistsResult]);

  // Extra safety: lightweight dedupe on the client
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

  // Animation variants for stagger effect
  const heroVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  return (
    <div className="w-full">
      {/* Hero Section with Search - Premium Dark Landing Page */}
      <motion.section 
        className="relative w-full py-16 md:py-24 overflow-hidden"
        initial="hidden"
        animate="show"
        variants={heroVariants}
      >
        {/* Subtle monochrome gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] via-transparent to-transparent pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            {/* Headline with stagger animation */}
            <div className="space-y-4">
           
              
              <motion.h1 
                variants={itemVariants}
                className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight gradient-text"
              >
                Crowdsourced Concert Setlists
          
              </motion.h1>
              
              <motion.p 
                variants={itemVariants}
                className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto"
              >
                Search trending artists, explore upcoming concerts, and vote on predicted setlists
              </motion.p>
          </div>
          
            {/* Search Bar - Centered with glass effect */}
            <motion.div 
              variants={itemVariants}
              className="max-w-2xl mx-auto pt-4 relative z-[100]"
            >
              <div className="glass-card rounded-2xl p-1 shadow-elevated">
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
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Content Sections */}
      <div className="container mx-auto px-4 space-y-16 pb-16">
        
        {/* Trending Artists Section */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <Users className="h-6 w-6 text-foreground/80" />
            </div>
            <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">Trending Artists</h2>
                <p className="text-sm text-gray-500">Most popular artists with upcoming shows</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div variants={containerVariants} className="relative">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(6)].map((_, i) => <ArtistCardSkeleton key={i} />)}
              </div>
            ) : (trendingArtists as any[])?.length === 0 ? (
              <div className="col-span-2 w-full flex flex-col items-center justify-center py-16 text-center min-h-[300px]">
                <Music className="h-16 w-16 text-gray-800 mb-4" />
                <p className="text-gray-500 text-lg">No trending artists yet</p>
                <p className="text-gray-600 text-sm mt-2">Artists will appear here once data is synced</p>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20 pb-4">
                <div className="grid grid-rows-2 grid-flow-col gap-4 w-max">
                  {(trendingArtists as any[]).map((artist: any, index: number) => {
                    const artistId = artist?._id || artist?.artistId;
                    const slug = artist?.slug 
                      || artist?.cachedTrending?.slug 
                      || (typeof artist.name === 'string' && artist.name.length > 0 
                          ? artist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                          : undefined);
                    
                    return (
                      <motion.div
                        key={`${artistId}-${index}`}
                        variants={cardVariants}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, margin: "-50px" }}
                      >
                        <ArtistCard 
                          artist={artist} 
                          onClick={() => {
                            onArtistClick(artistId || slug || artist.ticketmasterId);
                          }} 
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </motion.section>

        {/* Trending Shows Section */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <TrendingUp className="h-6 w-6 text-foreground/80" />
              </div>
          <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">Top Shows</h2>
                <p className="text-sm text-gray-500">Most popular upcoming concerts</p>
              </div>
            </div>
          </motion.div>

          {/* Shows Grid with stagger animation */}
          <motion.div variants={containerVariants}>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => <ShowCardSkeleton key={i} />)}
              </div>
            ) : (trendingShows as any[])?.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <Music className="h-16 w-16 text-gray-800 mb-4" />
                <p className="text-gray-500 text-lg">No shows available</p>
                <p className="text-gray-600 text-sm mt-2">Check back soon</p>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20 pb-4">
                <div className="grid grid-rows-2 grid-flow-col gap-4 w-max">
                  {(trendingShows as any[]).map((show: any, index: number) => {
                    return (
                      <motion.div
                        key={`${show._id || show.showId}-${index}`}
                        variants={cardVariants}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, margin: "-50px" }}
                      >
                        <ShowCard
                          show={show}
                          onClick={() => {
                            const showId = show._id || show.showId;
                            const slug = show.slug || show.cachedTrending?.showSlug;
                            onShowClick(showId || slug || show.ticketmasterId, slug);
                          }}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </motion.section>
      </div>
    </div>
  );
}

// Premium Artist Card - Fully Clickable with Glass Morphism (Mobile Optimized)
function ArtistCard({ artist, onClick }: {
  artist: any;
  onClick: () => void;
}) {
  return (
    <motion.div 
      className="w-40 sm:w-44 md:w-48 lg:w-56 xl:w-64 flex-shrink-0 snap-start cursor-pointer transform-gpu will-change-transform"
      onClick={onClick}
      whileHover={{ y: -6, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-xl sm:rounded-2xl overflow-hidden card-lift shadow-elevated shadow-elevated-hover">
        {/* Artist Image - Square aspect ratio */}
        <div className="relative w-full aspect-square overflow-hidden">
          {artist.images?.[0] ? (
            <motion.img 
              src={artist.images[0]} 
              alt={artist.name}
              className="w-full h-full object-cover transform-gpu will-change-transform"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-white/10 dark:to-white/5 flex items-center justify-center">
              <span className="text-gray-600 dark:text-white/80 font-bold text-xl sm:text-2xl md:text-3xl">
                {(typeof artist?.name === 'string' && artist.name.length > 0 ? artist.name : '??').slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-2.5 sm:p-3 md:p-4 space-y-0.5 sm:space-y-1">
          <h3 className="text-foreground font-bold text-xs sm:text-sm md:text-base leading-tight line-clamp-1 group-hover:shimmer-text transition-all">
            {artist.name}
          </h3>
          <div className="flex items-center justify-between gap-1">
            <p className="text-muted-foreground text-[10px] sm:text-xs">
              {artist.upcomingShowsCount || 0} shows
            </p>
            {artist.genres?.[0] && (
              <span className="text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border truncate max-w-[60px] sm:max-w-none">
                {artist.genres[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Premium Show Card - Fully Clickable with Glass Morphism (Mobile Optimized)
function ShowCard({
  show,
  onClick,
}: {
  show: any;
  onClick: () => void;
}) {
  const showDate = new Date(show.date);

  return (
    <motion.div 
      className="w-40 sm:w-44 md:w-48 lg:w-56 xl:w-64 flex-shrink-0 snap-start cursor-pointer transform-gpu will-change-transform"
      onClick={onClick}
      whileHover={{ y: -6, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-xl sm:rounded-2xl overflow-hidden card-lift shadow-elevated shadow-elevated-hover">
        {/* Show Image - Square aspect ratio */}
        <div className="relative w-full aspect-square overflow-hidden">
          {(() => {
            const imgSrc = show?.artist?.images?.[0] || show?.artistImage || show?.cachedTrending?.artistImage;
            return imgSrc ? (
            <motion.img
              src={imgSrc}
              alt={show.artist?.name || show.artistName}
              className="w-full h-full object-cover transform-gpu will-change-transform"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-white/10 dark:to-white/5 flex items-center justify-center">
              <span className="text-gray-600 dark:text-white/80 font-bold text-xl sm:text-2xl md:text-3xl">
                {((show?.artist?.name || show?.artistName || '??') as string).slice(0, 2).toUpperCase()}
              </span>
            </div>
          );})()}
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Date Badge with glass effect */}
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
            <div className="glass-card rounded-md sm:rounded-lg px-1.5 py-0.5 sm:px-2 sm:py-1">
              <p className="text-foreground text-[10px] sm:text-xs font-bold">
                {showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-2.5 sm:p-3 md:p-4 space-y-0.5 sm:space-y-1">
          <h3 className="text-foreground font-bold text-xs sm:text-sm md:text-base leading-tight line-clamp-1 group-hover:shimmer-text transition-all">
            {show.artist?.name || show.artistName}
          </h3>
          {show.venue && (
            <div className="space-y-0">
              <p className="text-muted-foreground text-[10px] sm:text-xs flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                <span className="truncate">{show.venue.name}</span>
              </p>
              <p className="text-muted-foreground/70 text-[9px] sm:text-xs pl-3.5 sm:pl-4 truncate">
                {show.venue.city}{show.venue.state ? `, ${show.venue.state}` : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
