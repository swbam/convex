import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Search, Music, ChevronLeft, ChevronRight, Calendar, Users, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useArtistImport } from '../hooks/useArtistImport';

interface ArtistsProps {
  onArtistClick: (artistId: Id<'artists'>, slug?: string) => void;
}

export function Artists({ onArtistClick }: ArtistsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  // Import hook for triggering full artist sync
  const { handleArtistClick: importArtist, importingArtist } = useArtistImport();

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

  // Handler that triggers import if artist not in DB
  const handleArtistClick = async (artist: any) => {
    await importArtist(artist, onArtistClick);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page on search
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 relative z-10">
      {/* Streamlined Header with Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Search Bar - Full width on mobile, auto on desktop */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            placeholder="Search artists..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full pl-10 pr-10 py-2.5 bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-foreground placeholder-muted-foreground text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              Clear
            </button>
          )}
        </div>
        
        {/* Count - Right aligned on desktop */}
        <p className="text-muted-foreground text-sm">
          {filteredArtists.length} {filteredArtists.length === 1 ? 'artist' : 'artists'}
        </p>
      </div>

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
      ) : filteredArtists.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-secondary flex items-center justify-center border border-border">
            <Music className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No artists found</h3>
          <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
            {searchQuery 
              ? 'Try a different search term.'
              : 'No artists available yet.'
            }
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg transition-colors text-sm border border-border"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Artists Grid - More columns, smaller cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {paginatedArtists.map((artist, index) => (
              <ArtistCard
                key={artist._id || index}
                artist={artist}
                onClick={() => handleArtistClick(artist)}
                isImporting={importingArtist === artist.ticketmasterId}
              />
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
        </div>
      )}
    </div>
  );
}

// Compact Artist Card - Matching Homepage Style
function ArtistCard({ artist, onClick, isImporting }: { artist: any; onClick: () => void; isImporting?: boolean }) {
  const artistImage = Array.isArray(artist.images) && artist.images.length > 0 ? artist.images[0] : undefined;
  const upcomingCount = typeof artist.upcomingShowsCount === 'number'
    ? artist.upcomingShowsCount
    : typeof artist.upcomingEvents === 'number'
      ? artist.upcomingEvents
      : 0;

  return (
    <motion.div 
      className={`cursor-pointer ${isImporting ? 'pointer-events-none opacity-70' : ''}`}
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-xl overflow-hidden shadow-elevated relative">
        {isImporting && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {/* Artist Image */}
        <div className="relative w-full aspect-square overflow-hidden">
          {artistImage ? (
            <img
              src={artistImage}
              alt={artist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
              <span className="text-foreground/60 font-bold text-xl">
                {artist.name?.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="p-2.5 sm:p-3">
          <h3 className="text-foreground font-semibold text-xs sm:text-sm line-clamp-1">
            {artist.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground text-[10px] sm:text-xs">
            {upcomingCount > 0 && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {upcomingCount}
              </span>
            )}
            {artist.followers && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {artist.followers > 1000 
                  ? `${(artist.followers / 1000).toFixed(0)}k` 
                  : artist.followers
                }
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
