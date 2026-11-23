import { PageHeader } from "./PageHeader";
import { ShowDiscoveryCard } from "./discovery/DiscoveryCard";
import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Calendar, MapPin, Music, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatLocation, formatTimeCompact, parseShowCalendarDate } from '../lib/utils';
import { useShowImport } from '../hooks/useArtistImport';
import { pageVariants, sectionVariants, gridContainerVariants, gridItemVariants, headerVariants } from './animations/FadeIn';
import { DiscoverySkeleton as GridSkeleton } from './discovery/DiscoveryCard';


interface ShowsProps {
  onShowClick: (showId: Id<'shows'> | string, slug?: string) => void;
}

export function Shows({ onShowClick }: ShowsProps) {
  const [locationFilter, setLocationFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  // Import hook for triggering full show sync
  const { handleShowClick: importShow, importingShow } = useShowImport();

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

  // Handler that triggers import if show not in DB
  const handleShowClick = async (show: any) => {
    await importShow(show, onShowClick);
  };

  return (
    <motion.div
      className="public-page space-y-6 relative z-10"
      initial="hidden"
      animate="show"
      variants={pageVariants}
    >

      <PageHeader title="Shows" description="Find a concert and request the songs you want to hear." />
      {/* Search */}
      <motion.div 
        className="flex flex-col sm:flex-row sm:items-center gap-4"
        variants={headerVariants}
      >
        {/* Search Bar - Full width on mobile, auto on desktop */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            placeholder="Filter by city, state, or venue..."
            value={locationFilter}
            onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}
            aria-label="Filter shows by city, state, or venue" className="filter-input pl-10 pr-10"
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
        <GridSkeleton count={12} />
      ) : displayShows.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-secondary flex items-center justify-center border border-border">
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
        </div>
      ) : (
        <motion.div className="space-y-6" variants={sectionVariants} initial="hidden" animate="show">
          {/* Shows Grid - More columns, smaller cards */}
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0 sm:gap-4"
            variants={gridContainerVariants}
            initial="hidden"
            animate="show"
            key={page} // Re-animate on page change
          >
            {paginatedShows.map((show, index) => (
              <motion.div key={show._id || index} variants={gridItemVariants}>
                <ShowDiscoveryCard
                  show={show}
                  onClick={() => handleShowClick(show)}
                  isImporting={importingShow === (show.ticketmasterId || show.artist?.ticketmasterId)}
                />
              </motion.div>
            ))}
          </motion.div>

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
    </motion.div>
  );
}

// Compact Show Card - Matching Homepage Style
