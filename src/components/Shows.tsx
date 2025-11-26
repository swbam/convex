import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Calendar, MapPin, Music, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';
import { motion } from 'framer-motion';

interface ShowsProps {
  onShowClick: (showId: Id<'shows'>, slug?: string) => void;
}

export function Shows({ onShowClick }: ShowsProps) {
  const [cityFilter, setCityFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch top shows from API-imported trending cache (not engagement-based)
  const trendingShowsResult = useQuery(api.trending.getTrendingShows, { limit: 200 });
  const allShowsRaw = React.useMemo(() => Array.isArray(trendingShowsResult?.page) ? trendingShowsResult!.page : [], [trendingShowsResult]);
  const isLoading = trendingShowsResult === undefined;
  
  const allShows = React.useMemo(() => {
    //Deduplicate shows by Convex document id (or slug fallback)
    const showsMap = new Map<string, any>();
    (allShowsRaw || []).forEach((show) => {
      if (!show?.artist?.name || show.artist.name.trim() === '' || show.artist.name === 'Unknown Artist') {
        return;
      }

      // Deduplicate using a stable composite key rather than document id/slug
      const key = [
        (show.artist?._id || (show as any).artistId || ''),
        (show.venue?._id || (show as any).venueId || ''),
        show.date || '',
        show.startTime || ''
      ].join('::');

      if (!showsMap.has(key)) {
        showsMap.set(key, show);
      }
    });
    
    // Sort by date (soonest first)
    return Array.from(showsMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [allShowsRaw]);

  // Simple city/zip filter with artist-level deduplication for browsing
  const displayShows = React.useMemo(() => {
    let filtered = allShows;
    
    if (cityFilter.trim()) {
      const q = cityFilter.toLowerCase();
      filtered = allShows.filter(show => 
        show.venue?.city?.toLowerCase().includes(q) ||
        show.venue?.state?.toLowerCase().includes(q) ||
        show.venue?.postalCode?.toLowerCase().includes(q)
      );
    }
    
    // Deduplicate to show ONE show per artist (earliest upcoming)
    const artistShowMap = new Map<string, any>();
    filtered.forEach(show => {
      const artistKey = show.artist?._id || show.artist?.name || '';
      if (!artistKey) return;
      
      // Keep the earliest show for each artist
      const existing = artistShowMap.get(artistKey);
      if (!existing || new Date(show.date).getTime() < new Date(existing.date).getTime()) {
        artistShowMap.set(artistKey, show);
      }
    });
    
    // Sort by soonest upcoming
    return Array.from(artistShowMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [allShows, cityFilter]);

  const totalPages = Math.max(1, Math.ceil(displayShows.length / pageSize));
  const paginatedShows = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return displayShows.slice(start, start + pageSize);
  }, [displayShows, page]);

  const handleShowClick = (showId: Id<'shows'>, slug?: string) => {
    onShowClick(showId, slug);
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
      {/* Premium Header - Mobile Optimized */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <MagicCard className="relative overflow-hidden rounded-xl sm:rounded-2xl p-0 border border-white/10 bg-card">
          <div className="relative z-10 p-4 sm:p-6 lg:p-8">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-white/10 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Upcoming Shows</h1>
                <p className="text-gray-400 text-xs sm:text-sm mt-0.5 sm:mt-1">{displayShows.length} concerts available</p>
              </div>
            </div>
          </div>
          <BorderBeam size={150} duration={12} className="opacity-30" />
        </MagicCard>
      </motion.div>

      {/* Search Bar - Mobile Optimized */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="glass-card rounded-xl sm:rounded-2xl p-1 max-w-lg">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 sm:h-5 sm:w-5" />
            <input
              type="text"
              placeholder="Search by city, state, or zip..."
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 sm:pl-12 pr-16 sm:pr-4 py-3 sm:py-3.5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-foreground placeholder-gray-400 text-sm sm:text-base"
            />
            {cityFilter && (
              <button
                onClick={() => setCityFilter('')}
                className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-foreground px-2 py-1 rounded text-xs sm:text-sm"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Content */}
      {isLoading ? (
        // Premium Loading State
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-white/5" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-white/10 rounded w-3/4" />
                <div className="h-4 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : displayShows.length === 0 ? (
        // Empty State
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10">
            <Music className="h-10 w-10 text-gray-500" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-3">No shows found</h3>
          <p className="text-gray-400 text-lg mb-6 max-w-md mx-auto">
            {cityFilter 
              ? 'No shows found in that area. Try a different location.'
              : 'No shows available yet. Check back soon!'
            }
          </p>
          {cityFilter && (
            <button
              onClick={() => setCityFilter('')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-foreground rounded-xl transition-colors font-medium border border-white/10"
            >
              Show All Shows
            </button>
          )}
        </motion.div>
      ) : (
        // Shows Grid - Premium Card Layout
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Shows count */}
          <div className="flex items-center justify-between">
            <p className="text-gray-400">
              Showing {paginatedShows.length} of {displayShows.length} shows
            </p>
          </div>
          
          {/* Premium Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
            {paginatedShows.map((show, index) => (
              <PremiumShowCard
                key={`${show._id}-${index}`}
                show={show}
                onClick={() => handleShowClick(show._id, show.slug)}
                variants={cardVariants}
              />
            ))}
          </div>

          {/* Premium Pagination */}
          {totalPages > 1 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-center gap-3 pt-6"
            >
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              
              <div className="flex items-center gap-2 px-4">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = page <= 3 ? i + 1 : page + i - 2;
                  if (pageNum < 1 || pageNum > totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        pageNum === page
                          ? 'bg-white/20 text-foreground border border-white/20'
                          : 'text-gray-400 hover:text-foreground hover:bg-white/5'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// Premium Show Card Component - Matching Homepage Style
function PremiumShowCard({
  show,
  onClick,
  variants,
}: {
  show: any;
  onClick: () => void;
  variants?: any;
}) {
  const showDate = new Date(show.date);
  const artistName = show.artist?.name || show.artistName || 'Unknown Artist';
  const artistImage = show.artist?.images?.[0] || show.artistImage;

  return (
    <motion.div 
      variants={variants}
      className="cursor-pointer transform-gpu will-change-transform"
      onClick={onClick}
      whileHover={{ y: -6, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-2xl overflow-hidden card-lift shadow-elevated shadow-elevated-hover">
        {/* Show Image */}
        <div className="relative w-full aspect-square overflow-hidden">
          {artistImage ? (
            <motion.img
              src={artistImage}
              alt={artistName}
              className="w-full h-full object-cover transform-gpu will-change-transform"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
              <span className="text-foreground/80 font-bold text-2xl md:text-3xl">
                {artistName.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
          
          {/* Date Badge with glass effect */}
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
            <div className="glass-card rounded-lg px-2 py-1 sm:px-3 sm:py-2">
              <p className="text-foreground text-xs font-bold">
                {showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 space-y-1 sm:space-y-2">
          <h3 className="text-foreground font-bold text-sm sm:text-base leading-tight line-clamp-1">
            {artistName}
          </h3>
          {show.venue && (
            <div className="space-y-0.5">
              <p className="text-gray-400 text-xs sm:text-sm flex items-center gap-1.5">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{show.venue.name}</span>
              </p>
              <p className="text-gray-500 text-xs pl-4">
                {show.venue.city}{show.venue.state ? `, ${show.venue.state}` : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
