import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { ArtistCard } from './ArtistCard';
import { Search, Music, TrendingUp, Users, Filter, Star, Mic } from 'lucide-react';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';

interface ArtistsProps {
  onArtistClick: (artistId: Id<'artists'>, slug?: string) => void;
}

export function Artists({ onArtistClick }: ArtistsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'trending' | 'followers' | 'name'>('trending');
  const [filterGenre, setFilterGenre] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 18;

  // Use canonical artists collection; trending is reflected via trendingScore
  const allArtists = useQuery(api.artists.getAll, { limit: 200 }) || [];

  // Get unique genres for filter
  const genres = React.useMemo(() => {
    const genreSet = new Set<string>();
    (allArtists || []).forEach(artist => {
      artist.genres?.forEach((genre: string) => genreSet.add(genre));
    });
    return Array.from(genreSet).sort();
  }, [allArtists]);

  // Filter and sort artists
  const filteredArtists = React.useMemo(() => {
    let filtered = allArtists;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(artist => 
        artist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        artist.genres?.some((genre: string) => 
          genre.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Apply genre filter
    if (filterGenre) {
      filtered = filtered.filter(artist => 
        artist.genres?.includes(filterGenre)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'trending':
          return (b.trendingScore || 0) - (a.trendingScore || 0);
        case 'followers':
          return (b.followers || 0) - (a.followers || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [allArtists, searchQuery, filterGenre, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredArtists.length / pageSize));
  const paginatedArtists = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredArtists.slice(start, start + pageSize);
  }, [filteredArtists, page]);

  const handleArtistClick = (artistId: Id<'artists'>, slug?: string) => {
    onArtistClick(artistId, slug);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterGenre(e.target.value);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as 'trending' | 'followers' | 'name');
  };

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Enhanced Header with MagicCard */}
      <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0 hover:border-white/20">
        <div className="absolute inset-0 bg-gradient-to-br from-purple/5 via-background to-blue/5" />
        <div className="relative z-10 p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Mic className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl lg:text-5xl font-bold text-white">Artists</h1>
                  <p className="text-gray-300 text-lg">
                    Discover {filteredArtists.length} artists across all genres
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-4 backdrop-blur-sm">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Star className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Trending</div>
                <div className="text-xs text-gray-400">Updated daily</div>
              </div>
            </div>
          </div>
        </div>
        <BorderBeam size={150} duration={12} className="opacity-30" />
      </MagicCard>

      {/* Enhanced Search and Filters */}
      <MagicCard className="p-0 rounded-2xl border-0 hover:border-white/20">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
              <Filter className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-white">Search & Filter</h2>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              type="text"
              placeholder="Search artists or genres..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 bg-muted/20 border border-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Genre Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <select
              value={filterGenre}
              onChange={handleFilterChange}
              className="pl-10 pr-8 py-2 bg-muted/20 border border-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer"
            >
              <option value="">All Genres</option>
              {genres.map((genre: string) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={handleSortChange}
            className="px-4 py-2 bg-muted/20 border border-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer"
          >
            <option value="trending">Trending</option>
            <option value="followers">Most Followers</option>
            <option value="name">Alphabetical</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="dashboard-card">
        {!filteredArtists.length ? (
          // Loading state
          <div className="space-y-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-lg">
                <div className="w-16 h-16 bg-muted rounded-lg animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse"></div>
                  <div className="h-3 bg-muted rounded w-2/3 animate-pulse"></div>
                  <div className="h-3 bg-muted rounded w-1/2 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredArtists.length === 0 ? (
          // No results
          <div className="text-center py-12">
            <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No artists found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterGenre 
                ? 'Try adjusting your search or filters'
                : 'No artists available yet'
              }
            </p>
            {(searchQuery || filterGenre) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterGenre('');
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          // Artists grid
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Showing page {page} of {totalPages} • {filteredArtists.length} results
              </p>
              {(searchQuery || filterGenre) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterGenre('');
                  }}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedArtists.map((artist) => (
                <ArtistCard
                  key={artist._id}
                  artist={artist}
                  onClick={handleArtistClick}
                  showFollowButton={false}
                />
              ))}
            </div>

            {/* Pagination */}
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