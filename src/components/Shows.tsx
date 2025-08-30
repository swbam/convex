import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { ShowCard } from './ShowCard';
import { Search, Calendar, MapPin, Filter, TrendingUp, Music, Sparkles } from 'lucide-react';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';
import { ShimmerButton } from './ui/shimmer-button';

interface ShowsProps {
  onShowClick: (showId: Id<'shows'>, slug?: string) => void;
}

export function Shows({ onShowClick }: ShowsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'artist' | 'popularity'>('date');
  const [page, setPage] = useState(1);
  const pageSize = 18;

  // Fetch shows based on filters
  const allShows = useQuery(
    api.shows.getAll, 
    { 
      limit: 500,
      status: statusFilter === 'all' ? undefined : statusFilter
    }
  ) || [];

  const searchResults = useQuery(
    searchQuery.length > 2 ? api.shows.searchShows : "skip",
    searchQuery.length > 2 ? { query: searchQuery, limit: 50 } : "skip"
  );

  const cityShows = useQuery(
    cityFilter ? api.shows.getByCity : "skip",
    cityFilter ? { city: cityFilter, limit: 50 } : "skip"
  );

  // Get unique cities for filter dropdown
  const cities = React.useMemo(() => {
    const citySet = new Set<string>();
    allShows.forEach(show => {
      if (show.venue?.city) citySet.add(show.venue.city);
    });
    return Array.from(citySet).sort();
  }, [allShows]);

  // Determine which shows to display
  const displayShows = React.useMemo(() => {
    let shows = allShows;
    
    if (searchQuery.length > 2 && searchResults) {
      shows = searchResults;
    } else if (cityFilter && cityShows) {
      shows = cityShows;
    }

    // Apply sorting
    shows.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'artist':
          return (a.artist?.name || '').localeCompare(b.artist?.name || '');
        case 'popularity':
          return (b.artist?.popularity || 0) - (a.artist?.popularity || 0);
        default:
          return 0;
      }
    });

    return shows;
  }, [allShows, searchResults, cityShows, searchQuery, cityFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(displayShows.length / pageSize));
  const paginatedShows = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return displayShows.slice(start, start + pageSize);
  }, [displayShows, page]);

  const handleShowClick = (showId: Id<'shows'>, slug?: string) => {
    onShowClick(showId, slug);
  };

  const upcomingCount = allShows.filter(s => s.status === 'upcoming').length;
  const completedCount = allShows.filter(s => s.status === 'completed').length;

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Enhanced Header with MagicCard */}
      <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0 hover:border-white/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="relative z-10 p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl lg:text-5xl font-bold text-white">Shows</h1>
                  <p className="text-gray-300 text-lg">
                    Discover {allShows.length} concerts • {upcomingCount} upcoming • {completedCount} completed
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-4 backdrop-blur-sm">
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Live Data</div>
                <div className="text-xs text-gray-400">Updated from Ticketmaster</div>
              </div>
            </div>
          </div>
        </div>
        <BorderBeam size={150} duration={12} className="opacity-30" />
      </MagicCard>

      {/* Enhanced Filters and Search */}
      <MagicCard className="p-0 rounded-2xl border-0 hover:border-white/20">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
              <Filter className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white">Filters & Search</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Enhanced Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search shows, artists, venues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white placeholder-gray-400 backdrop-blur-sm transition-all duration-300"
              />
            </div>

            {/* Enhanced Status Filter */}
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none z-10" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full pl-12 pr-8 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white backdrop-blur-sm appearance-none cursor-pointer transition-all duration-300"
              >
                <option value="all" className="bg-background text-foreground">All Shows</option>
                <option value="upcoming" className="bg-background text-foreground">Upcoming</option>
                <option value="completed" className="bg-background text-foreground">Completed</option>
              </select>
            </div>

            {/* Enhanced City Filter */}
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none z-10" />
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-3 bg-muted/20 border border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer"
            >
              <option value="">All Cities</option>
              {cities.map((city: string) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {/* Enhanced Sort */}
          <div className="relative">
            <TrendingUp className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none z-10" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full pl-12 pr-8 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white backdrop-blur-sm appearance-none cursor-pointer transition-all duration-300"
            >
              <option value="date" className="bg-background text-foreground">Latest First</option>
              <option value="artist" className="bg-background text-foreground">Artist Name</option>
              <option value="popularity" className="bg-background text-foreground">Most Popular</option>
            </select>
          </div>
          </div>
        </div>
        <BorderBeam size={120} duration={8} className="opacity-20" />
      </MagicCard>

      {/* Results */}
      <div className="dashboard-card">
        {!allShows.length ? (
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
            <Music className="h-16 w-16 mx-auto mb-6 opacity-50" />
            <h3 className="text-2xl font-semibold mb-4">No shows found</h3>
            <p className="text-muted-foreground text-lg mb-6">
              {searchQuery || cityFilter 
                ? 'Try adjusting your search or filters'
                : 'No shows available yet'
              }
            </p>
            {(searchQuery || cityFilter) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCityFilter('');
                }}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          // Shows grid
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">
                Showing page {page} of {totalPages} • {displayShows.length} results
              </p>
              {(searchQuery || cityFilter || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCityFilter('');
                    setStatusFilter('all');
                  }}
                  className="text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  Clear all filters
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
    </div>
  );
}
