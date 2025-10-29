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
  onShowClick: (showKey: Id<"shows"> | string) => void;
  onSignInRequired: () => void;
  navigate: (path: string) => void;
}

export function PublicDashboard({ onArtistClick, onShowClick, onSignInRequired, navigate }: PublicDashboardProps) {
  const navigateTo = useNavigate();

  // Load trending data directly from the optimized trending system
  const dbTrendingShowsResult = useQuery(api.trending.getTrendingShows, { limit: 20 });
  const dbTrendingArtistsResult = useQuery(api.trending.getTrendingArtists, { limit: 20 });
  
  // Extract page arrays from paginated results
  const dbTrendingShows = dbTrendingShowsResult?.page || [];
  const dbTrendingArtists = dbTrendingArtistsResult?.page || [];

  const isLoading = !dbTrendingShowsResult || !dbTrendingArtistsResult;

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
              className="max-w-2xl mx-auto pt-4"
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
                <Users className="h-6 w-6 text-white/80" />
            </div>
            <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">Trending Artists</h2>
                <p className="text-sm text-gray-500">Most popular artists with upcoming shows</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div variants={containerVariants} className="relative">
            {/* Horizontal Scroll Container */}
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory -mx-2 px-2 md:-mx-4 md:px-4">
              {isLoading ? (
                [...Array(6)].map((_, i) => <ArtistCardSkeleton key={i} />)
              ) : dbTrendingArtists.length === 0 ? (
                <div className="w-full flex flex-col items-center justify-center py-16 text-center min-h-[300px]">
                  <Music className="h-16 w-16 text-gray-800 mb-4" />
                  <p className="text-gray-500 text-lg">No trending artists yet</p>
                  <p className="text-gray-600 text-sm mt-2">Artists will appear here once data is synced</p>
                </div>
              ) : (
                dbTrendingArtists.map((artist: any, index: number) => {
                  const key = artist._id || artist.ticketmasterId || artist.slug || artist.name || index;
                  const targetSlug = artist.slug || artist._id || artist.ticketmasterId || (artist.name ? artist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '');
                  return (
                    <motion.div key={key} variants={cardVariants} custom={index}>
                      <ArtistCard 
                        artist={artist}
                        onClick={() => navigateTo(`/artists/${targetSlug}`)}
                      />
                    </motion.div>
                  );
                })
              )}
            </div>
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
                <TrendingUp className="h-6 w-6 text-white/80" />
              </div>
          <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">Top Shows</h2>
                <p className="text-sm text-gray-500">Most popular upcoming concerts</p>
              </div>
            </div>
          </motion.div>

          {/* Shows Grid with stagger animation */}
          <motion.div 
            variants={containerVariants}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {isLoading ? (
              [...Array(8)].map((_, i) => <ShowCardSkeleton key={i} />)
            ) : dbTrendingShows.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <Music className="h-16 w-16 text-gray-800 mb-4" />
                <p className="text-gray-500 text-lg">No shows available</p>
                <p className="text-gray-600 text-sm mt-2">Check back soon</p>
              </div>
            ) : (
              dbTrendingShows.slice(0, 12).map((show, index) => (
                <motion.div key={show._id} variants={cardVariants} custom={index}>
                  <ShowCard 
                    show={show} 
                    onClick={() => navigateTo(`/shows/${show.slug}`)}
                  />
                </motion.div>
              ))
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
      className="flex-shrink-0 w-48 sm:w-56 md:w-64 snap-start cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -6, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-2xl overflow-hidden card-lift shadow-elevated shadow-elevated-hover">
        {/* Artist Image */}
        <div className="relative w-full aspect-square overflow-hidden">
          {artist.images?.[0] ? (
            <motion.img 
              src={artist.images[0]} 
              alt={artist.name}
              className="w-full h-full object-cover"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
              <span className="text-white/80 font-bold text-2xl sm:text-3xl md:text-4xl">
                {(typeof artist?.name === 'string' && artist.name.length > 0 ? artist.name : '??').slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          {/* Monochrome gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 space-y-1 sm:space-y-2">
          <h3 className="text-white font-bold text-sm sm:text-base md:text-lg leading-tight line-clamp-1 group-hover:shimmer-text transition-all">
            {artist.name}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-xs sm:text-sm">
              {artist.upcomingShowsCount || 0} shows
            </p>
            {artist.genres?.[0] && (
              <span className="text-xs px-2 py-0.5 sm:py-1 rounded-full bg-white/5 text-white/70 border border-white/10">
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
  const isUpcoming = showDate >= new Date();

  return (
    <motion.div 
      className="cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -6, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-2xl overflow-hidden card-lift shadow-elevated shadow-elevated-hover">
        {/* Show Image */}
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          {(show.artist?.images?.[0] || show.artistImage) ? (
            <motion.img
              src={show.artist?.images?.[0] || show.artistImage}
              alt={show.artist?.name || show.artistName}
              className="w-full h-full object-cover"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
              <span className="text-white/80 font-bold text-xl sm:text-2xl md:text-3xl">
                {((show?.artist?.name || show?.artistName || '??') as string).slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          {/* Monochrome gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
          
          {/* Date Badge with glass effect */}
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
            <div className="glass-card rounded-lg px-2 py-1 sm:px-3 sm:py-2">
              <p className="text-white text-xs font-bold">
                {showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 space-y-1 sm:space-y-2">
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight line-clamp-1 group-hover:shimmer-text transition-all">
            {show.artist?.name || show.artistName}
          </h3>
          {show.venue && (
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-gray-400 text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                <span className="truncate">{show.venue.name}</span>
              </p>
              <p className="text-gray-500 text-xs pl-4 sm:pl-5">
                {show.venue.city}{show.venue.state ? `, ${show.venue.state}` : ''}
              </p>
            </div>
          )}
          {show.priceRange && (
            <p className="text-xs text-white/70 font-semibold">
              {show.priceRange}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
