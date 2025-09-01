import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { ShowCard } from './ShowCard';
import { Search, Calendar, MapPin, Filter, TrendingUp, Music } from 'lucide-react';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';
// import { ShimmerButton } from './ui/shimmer-button';

interface ShowsProps {
  onShowClick: (showId: Id<'shows'>, slug?: string) => void;
}

export function Shows({ onShowClick }: ShowsProps) {
  const [cityFilter, setCityFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 18;

  // Fetch all shows - simplified
  const allShowsRaw = useQuery(api.shows.getAll, { limit: 500 });
  const isLoading = allShowsRaw === undefined;
  
  const allShows = React.useMemo(() => {
    // Deduplicate shows by unique key and filter out invalid data
    const showsMap = new Map<string, any>();
    (allShowsRaw || []).forEach(show => {
      // Only include shows with proper artist names
      if (show.artist?.name && show.artist.name.trim() !== '' && show.artist.name !== 'Unknown Artist') {
        const key = `${show.artist.name}-${show.venue?.name}-${show.date}`;
        if (!showsMap.has(key)) {
          showsMap.set(key, show);
        }
      }
    });
    
    // Sort by date (newest first)
    return Array.from(showsMap.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [allShowsRaw]);

  // Simple city/zip filter
  const displayShows = React.useMemo(() => {
    if (!cityFilter.trim()) return allShows;
    
    return allShows.filter(show => 
      show.venue?.city?.toLowerCase().includes(cityFilter.toLowerCase()) ||
      show.venue?.state?.toLowerCase().includes(cityFilter.toLowerCase())
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

  return (
    <div className="space-y-4 sm:space-y-8 relative z-10">
      {/* Clean Apple-Style Shows Header */}
      <MagicCard className="relative overflow-hidden rounded-xl p-0 border-0 bg-black">
        <div className="relative z-10 p-3 sm:p-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate">Shows</h1>
              <p className="text-sm text-gray-400 mt-1">{allShows.length} concerts</p>
            </div>
          </div>
        </div>
      </MagicCard>

      {/* Simple Zip Code Search */}
      <MagicCard className="p-0 rounded-xl border-0 bg-black">
        <div className="p-3 sm:p-4">
          <div className="max-w-md">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Enter zip code..."
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white placeholder-gray-400 text-sm"
              />
            </div>
          </div>
        </div>
      </MagicCard>

      {/* Results */}
      <MagicCard className="p-0 rounded-2xl border-0 bg-black">
        <div className="p-4 sm:p-6">
        {isLoading ? (
          // Loading state
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-6 rounded-lg">
                <div className="w-20 h-20 bg-muted rounded-xl animate-pulse"></div>
                <div className="flex-1 space-y-3">
                  <div className="h-6 bg-muted rounded animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
                </div>
                <div className="w-24 h-10 bg-muted rounded-lg animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : displayShows.length === 0 ? (
          // No results
          <div className="text-center py-16">
            <Music className="h-16 w-16 mx-auto mb-6 opacity-50 text-gray-400" />
            <h3 className="text-2xl font-semibold mb-4 text-white">No shows found</h3>
            <p className="text-gray-400 text-lg mb-6">
              {cityFilter 
                ? 'No shows found in that area'
                : 'No shows available yet'
              }
            </p>
            {cityFilter && (
              <button
                onClick={() => setCityFilter('')}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold"
              >
                Show All Shows
              </button>
            )}
          </div>
        ) : (
          // Shows grid
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">
                {displayShows.length} shows
              </p>
              {cityFilter && (
                <button
                  onClick={() => setCityFilter('')}
                  className="text-primary hover:text-primary/80 transition-colors text-sm font-medium"
                >
                  Clear search
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              {paginatedShows.map((show) => (
                <ShowCard
                  key={show._id}
                  show={show as any}
                  onClick={handleShowClick}
                  compact={false}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  className="px-3 py-2 rounded border text-sm disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <div className="text-sm text-muted-foreground">{page} / {totalPages}</div>
                <button
                  className="px-3 py-2 rounded border text-sm disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
        </div>
        <BorderBeam size={120} duration={8} className="opacity-20" />
      </MagicCard>
    </div>
  );
}
