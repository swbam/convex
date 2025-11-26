import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Calendar, MapPin, Music, Search, ChevronLeft, ChevronRight } from 'lucide-react';
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

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 relative z-10">
      {/* Streamlined Header with Search */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center gap-4"
      >
        {/* Search Bar - Full width on mobile, auto on desktop */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            placeholder="Filter by city, state, or venue..."
            value={locationFilter}
            onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-10 py-2.5 bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-foreground placeholder-muted-foreground text-sm"
          />
          {locationFilter && (
            <button
              onClick={() => { setLocationFilter(''); setPage(1); }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              Clear
            </button>
          )}
        </div>
        
        {/* Count - Right aligned on desktop */}
        <p className="text-muted-foreground text-sm">
          {displayShows.length} {displayShows.length === 1 ? 'show' : 'shows'}
        </p>
      </motion.div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {[...Array(12)].map((_, i) => (
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
              ? 'Try a different location.'
              : 'No shows available yet.'
            }
          </p>
          {locationFilter && (
            <button
              onClick={() => { setLocationFilter(''); setPage(1); }}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg transition-colors text-sm border border-border"
            >
              Clear Filter
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Shows Grid - More columns, smaller cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {paginatedShows.map((show, index) => (
              <motion.div
                key={show._id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
              >
                <ShowCard
                  show={show}
                  onClick={() => handleShowClick(show._id || show.showId, show.slug)}
                />
              </motion.div>
            ))}
          </div>

          {/* Compact Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary/80 transition-colors"
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-secondary/80 transition-colors"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// Compact Show Card - Matching Homepage Style
function ShowCard({ show, onClick }: { show: any; onClick: () => void }) {
  const artistImage = Array.isArray(show.artist?.images) && show.artist.images.length > 0 
    ? show.artist.images[0] 
    : undefined;
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <motion.div 
      className="cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-xl overflow-hidden shadow-elevated">
        {/* Show Image */}
        <div className="relative w-full aspect-square overflow-hidden">
          {artistImage ? (
            <img
              src={artistImage}
              alt={show.artist?.name || 'Show'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-foreground/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Date Badge */}
          <div className="absolute top-2 right-2">
            <div className="glass-card rounded-lg px-2 py-1">
              <p className="text-foreground text-xs font-medium">
                {formatDate(show.date)}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-2.5 sm:p-3">
          <h3 className="text-foreground font-semibold text-xs sm:text-sm line-clamp-1">
            {show.artist?.name || 'Unknown Artist'}
          </h3>
          <div className="flex items-center gap-1 mt-1 text-muted-foreground text-[10px] sm:text-xs">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {show.venue?.city || 'TBA'}
              {show.venue?.state ? `, ${show.venue.state}` : ''}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
