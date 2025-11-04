import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { ArtistCard } from './ArtistCard';
import { Search, Music, TrendingUp, Filter, Star, Mic } from 'lucide-react';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';
import { Card } from "./ui/card"; // Shared

interface ArtistsProps {
  onArtistClick: (artistId: Id<'artists'>, slug?: string) => void;
}

export function Artists({ onArtistClick }: ArtistsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 18;

  // Use API-imported trending artists (from Ticketmaster cache)
  const trendingArtistsResult = useQuery(api.trending.getTrendingArtists, { limit: 200 });
  const allArtistsRaw = React.useMemo(() => Array.isArray(trendingArtistsResult?.page) ? trendingArtistsResult!.page : [], [trendingArtistsResult]);
  const isLoading = trendingArtistsResult === undefined;
  
  const allArtists = React.useMemo(() => {
    // Filter out invalid artists and deduplicate
    const artistsMap = new Map<string, any>();
    (allArtistsRaw || []).forEach(artist => {
      if (artist.name && artist.name.trim() !== '' && artist.name !== 'Unknown Artist') {
        if (!artistsMap.has(artist.name)) {
          artistsMap.set(artist.name, artist);
        }
      }
    });
    
    // Sort by trending score, then name
    return Array.from(artistsMap.values()).sort((a, b) => {
      const aScore = typeof a.trendingScore === 'number' && Number.isFinite(a.trendingScore) ? a.trendingScore : 0;
      const bScore = typeof b.trendingScore === 'number' && Number.isFinite(b.trendingScore) ? b.trendingScore : 0;
      if (bScore !== aScore) {
        return bScore - aScore;
      }
      return a.name.localeCompare(b.name);
    });
  }, [allArtistsRaw]);

  // Simple search filter
  const filteredArtists = React.useMemo(() => {
    if (!searchQuery.trim()) return allArtists;
    
    return allArtists.filter(artist =>
      artist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artist.genres?.some((genre: string) => genre.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [allArtists, searchQuery]);

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
    setPage(1); // Reset to first page on search
  };

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 relative z-10">
      {/* Clean Apple-Style Artists Header */}
      <MagicCard className="relative overflow-hidden rounded-xl p-0 border-0 bg-black">
        <div className="relative z-10 p-3 sm:p-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Mic className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate">Artists</h1>
              <p className="text-sm text-gray-400 mt-1">{filteredArtists.length} artists</p>
            </div>
          </div>
        </div>
      </MagicCard>

      {/* Simple Artist Search */}
      <MagicCard className="p-0 rounded-xl border-0 bg-black">
        <div className="p-3 sm:p-4">
          <div className="max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search artists..."
                value={searchQuery}
                onChange={handleSearch}
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
            <Music className="h-12 w-12 mx-auto mb-4 opacity-50 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2 text-white">No artists found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery 
                ? 'Try a different search term'
                : 'No artists available yet'
              }
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Show All Artists
              </button>
            )}
          </div>
        ) : (
          // Artists grid
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">
                {filteredArtists.length} artists
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Clear search
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
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
        <BorderBeam size={120} duration={8} className="opacity-20" />
      </MagicCard>
    </div>
  );
}