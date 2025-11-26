import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Calendar, MapPin, Music, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface ShowsProps {
  onShowClick: (showId: Id<'shows'>, slug?: string) => void;
}

export function Shows({ onShowClick }: ShowsProps) {
  const [locationFilter, setLocationFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch shows from trending cache
  const trendingShowsResult = useQuery(api.trending.getTrendingShows, { limit: 200 });
  const allShowsRaw = React.useMemo(() => 
    Array.isArray(trendingShowsResult?.page) ? trendingShowsResult!.page : [], 
    [trendingShowsResult]
  );
  const isLoading = trendingShowsResult === undefined;
  
  // Deduplicate and filter shows
  const allShows = React.useMemo(() => {
    const showsMap = new Map<string, any>();
    (allShowsRaw || []).forEach((show) => {
      if (!show?.artist?.name || show.artist.name.trim() === '' || show.artist.name === 'Unknown Artist') {
        return;
      }

      // Dedupe by artist+venue+date
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

  // Filter by location (city, state, zip)
  const filteredShows = React.useMemo(() => {
    if (!locationFilter.trim()) return allShows;
    
    const query = locationFilter.toLowerCase().trim();
    
    return allShows.filter(show => {
      const city = (show.venue?.city || '').toLowerCase();
      const state = (show.venue?.state || '').toLowerCase();
      const zip = (show.venue?.postalCode || '').toLowerCase();
      const venueName = (show.venue?.name || '').toLowerCase();
      
      return city.includes(query) || 
             state.includes(query) || 
             zip.includes(query) ||
             venueName.includes(query);
    });
  }, [allShows, locationFilter]);

  // Dedupe to one show per artist for cleaner browsing
  const displayShows = React.useMemo(() => {
    const artistShowMap = new Map<string, any>();
    filteredShows.forEach(show => {
      const artistKey = show.artist?._id || show.artist?.name || '';
      if (!artistKey) return;
      
      const existing = artistShowMap.get(artistKey);
      if (!existing || new Date(show.date).getTime() < new Date(existing.date).getTime()) {
        artistShowMap.set(artistKey, show);
      }
    });
    
    return Array.from(artistShowMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [filteredShows]);

  const totalPages = Math.max(1, Math.ceil(displayShows.length / pageSize));
  const paginatedShows = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return displayShows.slice(start, start + pageSize);
  }, [displayShows, page]);

  const handleShowClick = (showId: Id<'shows'>, slug?: string) => {
    onShowClick(showId, slug);
  };

  const clearFilter = () => {
    setLocationFilter('');
    setPage(1);
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
    <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-3"
      >
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-secondary flex items-center justify-center border border-border">
          <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-foreground/80" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Upcoming Shows</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {displayShows.length} concerts available
          </p>
        </div>
      </motion.div>

      {/* Search Bar - Matching homepage style */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="max-w-md"
      >
        <div className="glass-card rounded-xl p-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              type="text"
              placeholder="Filter by city, state, or zip..."
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-10 py-2.5 bg-background/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-foreground placeholder-muted-foreground text-sm"
            />
            {locationFilter && (
              <button
                onClick={clearFilter}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="glass-card rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-secondary" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-secondary rounded w-3/4" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : displayShows.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-secondary flex items-center justify-center border border-border">
            <Music className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No shows found</h3>
          <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
            {locationFilter 
              ? `No shows found matching "${locationFilter}". Try a different location.`
              : 'No shows available yet. Check back soon!'
            }
          </p>
          {locationFilter && (
            <button
              onClick={clearFilter}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium border border-border transition-colors"
            >
              Clear Filter
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Shows Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {paginatedShows.map((show, index) => (
              <ShowCard
                key={`${show._id}-${index}`}
                show={show}
                onClick={() => handleShowClick(show._id, show.slug)}
                variants={cardVariants}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-center gap-2 pt-4"
            >
              <button
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary/80 transition-colors"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>
              
              <div className="flex items-center gap-1 px-2">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = page <= 3 ? i + 1 : page + i - 2;
                  if (pageNum < 1 || pageNum > totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        pageNum === page
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary/80 transition-colors"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// Show Card - Matching homepage style
function ShowCard({
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
      className="cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-xl overflow-hidden shadow-elevated">
        {/* Image */}
        <div className="relative w-full aspect-square overflow-hidden">
          {artistImage ? (
            <img
              src={artistImage}
              alt={artistName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
              <span className="text-foreground/60 font-bold text-xl">
                {artistName.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
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

        {/* Content */}
        <div className="p-2.5 sm:p-3">
          <h3 className="text-foreground font-semibold text-xs sm:text-sm line-clamp-1">
            {artistName}
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
