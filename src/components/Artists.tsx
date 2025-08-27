import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { ArtistCard } from './ArtistCard';
import { Search, Music, TrendingUp, Users, Filter } from 'lucide-react';

interface ArtistsProps {
  onArtistClick: (artistId: Id<'artists'>, slug?: string) => void;
}

export function Artists({ onArtistClick }: ArtistsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'trending' | 'followers' | 'name'>('trending');
  const [filterGenre, setFilterGenre] = useState<string>('');

  // Fetch all artists
  const artists = useQuery(api.artists.getTrending, { limit: 100 }) || [];

  // Get unique genres for filter
  const genres = React.useMemo(() => {
    const genreSet = new Set<string>();
    artists.forEach(artist => {
      artist.genres?.forEach((genre: string) => genreSet.add(genre));
    });
    return Array.from(genreSet).sort();
  }, [artists]);

  // Filter and sort artists
  const filteredArtists = React.useMemo(() => {
    let filtered = artists;

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
  }, [artists, searchQuery, filterGenre, sortBy]);

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
    <div className="container mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Artists</h1>
          <p className="text-muted-foreground">
            Discover {artists.length} artists across all genres
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span>Updated daily</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="dashboard-card">
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
        {!artists.length ? (
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
                Showing {filteredArtists.length} of {artists.length} artists
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredArtists.map((artist) => (
                <ArtistCard
                  key={artist._id}
                  artist={artist}
                  onClick={handleArtistClick}
                  showFollowButton={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}