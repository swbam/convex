import React from 'react';
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Users, MapPin, Music } from "lucide-react";
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

export function PublicDashboard({ onArtistClick, onShowClick }: PublicDashboardProps) {
  const navigateTo = useNavigate();

  // Load trending data
  const dbTrendingShowsResult = useQuery(api.trending.getTrendingShows, { limit: 20 });
  const dbTrendingArtistsResult = useQuery(api.trending.getTrendingArtists, { limit: 20 });
  
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

  // Animation variants
  const heroVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
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
              className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight gradient-text"
            >
              Crowdsourced Concert Setlists
            </motion.h1>
            
            <motion.p 
              variants={itemVariants}
              className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto"
            >
              Search artists, explore upcoming concerts, and vote on predicted setlists
            </motion.p>
        
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

      {/* Content Sections */}
      <div className="container mx-auto px-4 space-y-12 pb-16">
        
        {/* Trending Artists */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-secondary flex items-center justify-center border border-border">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-foreground/80" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Trending Artists</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">Popular artists with upcoming shows</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div variants={containerVariants}>
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {[...Array(5)].map((_, i) => <ArtistCardSkeleton key={i} />)}
              </div>
            ) : (trendingArtists as any[])?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Music className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No trending artists yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border pb-2">
                <div className="grid grid-rows-2 grid-flow-col gap-3 sm:gap-4 w-max">
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
                      >
                        <ArtistCard 
                          artist={artist} 
                          onClick={() => onArtistClick(artistId || slug || artist.ticketmasterId)} 
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </motion.section>

        {/* Upcoming Shows */}
        <motion.section
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-secondary flex items-center justify-center border border-border">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-foreground/80" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Upcoming Shows</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">Popular upcoming concerts</p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={containerVariants}>
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {[...Array(5)].map((_, i) => <ShowCardSkeleton key={i} />)}
              </div>
            ) : (trendingShows as any[])?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Music className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No shows available</p>
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border pb-2">
                <div className="grid grid-rows-2 grid-flow-col gap-3 sm:gap-4 w-max">
                  {(trendingShows as any[]).map((show: any, index: number) => (
                    <motion.div
                      key={`${show._id || show.showId}-${index}`}
                      variants={cardVariants}
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
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </motion.section>
      </div>
    </div>
  );
}

// Artist Card - Compact and consistent
function ArtistCard({ artist, onClick }: { artist: any; onClick: () => void }) {
  return (
    <motion.div 
      className="w-36 sm:w-40 md:w-44 flex-shrink-0 cursor-pointer"
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
      className="w-36 sm:w-40 md:w-44 flex-shrink-0 cursor-pointer"
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
