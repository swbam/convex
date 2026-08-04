import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Search, Music, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCompactNumber } from '../lib/format';
import { useArtistImport } from '../hooks/useArtistImport';
import { pageVariants, sectionVariants, gridContainerVariants, gridItemVariants, headerVariants } from './animations/FadeIn';
import { GridSkeleton } from './LoadingSkeleton';
import { SEOHead } from './SEOHead';

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
    <motion.div
      className="container mx-auto px-4 py-6 space-y-6 relative z-10"
      initial="hidden"
      animate="show"
      variants={pageVariants}
    >
      <SEOHead
        title="Browse Touring Artists – Setlists & Upcoming Shows"
        description="Browse hundreds of touring artists, see who's trending, and vote on the setlists for their upcoming shows. Find your favorite artist's next concert."
      />
      {/* Streamlined Header with Search */}
      <motion.div 
        className="flex flex-col sm:flex-row sm:items-center gap-4"
        variants={headerVariants}
      >
        {/* Search Bar - Full width on mobile, auto on desktop */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            placeholder="Filter artists…"
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
        <p className="text-muted-foreground/70 text-xs sm:text-right">
          {filteredArtists.length} {filteredArtists.length === 1 ? 'artist' : 'artists'}
        </p>
      </motion.div>

      {/* Content */}
      {isLoading ? (
        <GridSkeleton count={12} />
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
        <motion.div className="space-y-6" variants={sectionVariants}>
          {/* Artists Grid - More columns, smaller cards */}
          <motion.div 
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
            variants={gridContainerVariants}
            initial="hidden"
            animate="show"
            key={page} // Re-animate on page change
          >
            {paginatedArtists.map((artist, index) => (
              <motion.div key={artist._id || index} variants={gridItemVariants}>
                <ArtistCard
                  artist={artist}
                  onClick={() => handleArtistClick(artist)}
                  isImporting={importingArtist === artist.ticketmasterId}
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

// Compact Artist Card - image-forward grid tile
function ArtistCard({ artist, onClick, isImporting }: { artist: any; onClick: () => void; isImporting?: boolean }) {
  const artistImage = Array.isArray(artist.images) && artist.images.length > 0 ? artist.images[0] : undefined;
  const upcomingCount = typeof artist.upcomingShowsCount === 'number'
    ? artist.upcomingShowsCount
    : typeof artist.upcomingEvents === 'number'
      ? artist.upcomingEvents
      : 0;

  const metaParts: string[] = [];
  if (upcomingCount > 0) {
    metaParts.push(`${upcomingCount} ${upcomingCount === 1 ? 'show' : 'shows'}`);
  }
  if (typeof artist.followers === 'number' && artist.followers > 0) {
    metaParts.push(`${formatCompactNumber(artist.followers)} fans`);
  }
  if (metaParts.length === 0 && artist.genres?.[0]) {
    metaParts.push(artist.genres[0]);
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={isImporting}
      whileTap={{ scale: 0.98 }}
      className="group relative block w-full text-left rounded-xl overflow-hidden bg-card ring-1 ring-border transition-all duration-200 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-70 disabled:pointer-events-none cursor-pointer touch-manipulation"
    >
      {isImporting && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Artist Image */}
      <div className="relative w-full aspect-square overflow-hidden bg-secondary">
        {artistImage ? (
          <img
            src={artistImage}
            alt={artist.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
            <span className="text-foreground/60 font-bold text-2xl">
              {artist.name?.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        {/* Bottom scrim so the name band reads against the artwork */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* Name + metadata */}
      <div className="px-3 pb-3 pt-2.5">
        <h3 className="text-foreground font-semibold text-base leading-tight line-clamp-1">
          {artist.name}
        </h3>
        {metaParts.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
            {metaParts.join(' · ')}
          </p>
        )}
      </div>
    </motion.button>
  );
}
