import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { ShowCard } from './ShowCard';
import { Search, Calendar, MapPin, Filter, TrendingUp, Music } from 'lucide-react';

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
    <div className="container mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">Shows</h1>
          <p className="text-muted-foreground text-lg">
            Discover {allShows.length} concerts • {upcomingCount} upcoming • {completedCount} completed
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span>Updated live from Ticketmaster</span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="dashboard-card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              type="text"
              placeholder="Search shows, artists, venues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-muted/20 border border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full pl-10 pr-8 py-3 bg-muted/20 border border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer"
            >
              <option value="all">All Shows</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* City Filter */}
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
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

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-4 py-3 bg-muted/20 border border-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer"
          >
            <option value="date">Latest First</option>
            <option value="artist">Artist Name</option>
            <option value="popularity">Most Popular</option>
          </select>
        </div>
      </div>

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
