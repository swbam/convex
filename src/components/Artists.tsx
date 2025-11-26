import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Search, Music, Mic, ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';
import { motion } from 'framer-motion';

interface ArtistsProps {
  onArtistClick: (artistId: Id<'artists'>, slug?: string) => void;
}

export function Artists({ onArtistClick }: ArtistsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.04 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 relative z-10">
      {/* Premium Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <MagicCard className="relative overflow-hidden rounded-2xl p-0 border border-white/10 bg-card">
          <div className="relative z-10 p-6 lg:p-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-500/30 to-purple-500/30 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-violet-500/20">
                <Mic className="h-7 w-7 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl lg:text-4xl font-bold text-white">Artists</h1>
                <p className="text-gray-400 mt-1">{filteredArtists.length} artists to explore</p>
              </div>
            </div>
          </div>
          <BorderBeam size={150} duration={12} className="opacity-30" />
        </MagicCard>
      </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="glass-card rounded-2xl p-1 max-w-lg">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search artists by name or genre..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/30 text-white placeholder-gray-400 text-base"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white px-2 py-1 rounded text-sm"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Content */}
      {isLoading ? (
        // Premium Loading State
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-square bg-white/5" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-white/10 rounded w-3/4" />
                <div className="h-4 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredArtists.length === 0 ? (
        // Empty State
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10">
            <Music className="h-10 w-10 text-gray-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">No artists found</h3>
          <p className="text-gray-400 text-lg mb-6 max-w-md mx-auto">
            {searchQuery 
              ? 'Try a different search term or browse all artists.'
              : 'No artists available yet. Check back soon!'
            }
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-medium border border-white/10"
            >
              Show All Artists
            </button>
          )}
        </motion.div>
      ) : (
        // Artists Grid - Premium Card Layout
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Count */}
          <div className="flex items-center justify-between">
            <p className="text-gray-400">
              Showing {paginatedArtists.length} of {filteredArtists.length} artists
            </p>
          </div>
          
          {/* Premium Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
            {paginatedArtists.map((artist, index) => (
              <PremiumArtistCard
                key={artist._id || index}
                artist={artist}
                onClick={() => handleArtistClick(artist._id || artist.artistId, artist.slug)}
                variants={cardVariants}
              />
            ))}
          </div>

          {/* Premium Pagination */}
          {totalPages > 1 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-center gap-3 pt-6"
            >
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              
              <div className="flex items-center gap-2 px-4">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = page <= 3 ? i + 1 : page + i - 2;
                  if (pageNum < 1 || pageNum > totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        pageNum === page
                          ? 'bg-white/20 text-white border border-white/20'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// Premium Artist Card Component - Matching Homepage Style
function PremiumArtistCard({
  artist,
  onClick,
  variants,
}: {
  artist: any;
  onClick: () => void;
  variants?: any;
}) {
  const artistImage = Array.isArray(artist.images) && artist.images.length > 0 ? artist.images[0] : undefined;
  const genres = Array.isArray(artist.genres) ? artist.genres.slice(0, 2) : [];
  const upcomingCount = typeof artist.upcomingShowsCount === 'number'
    ? artist.upcomingShowsCount
    : typeof artist.upcomingEvents === 'number'
      ? artist.upcomingEvents
      : 0;

  return (
    <motion.div 
      variants={variants}
      className="cursor-pointer transform-gpu will-change-transform"
      onClick={onClick}
      whileHover={{ y: -6, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-2xl overflow-hidden card-lift shadow-elevated shadow-elevated-hover">
        {/* Artist Image */}
        <div className="relative w-full aspect-square overflow-hidden">
          {artistImage ? (
            <motion.img
              src={artistImage}
              alt={artist.name}
              className="w-full h-full object-cover transform-gpu will-change-transform"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <span className="text-white/80 font-bold text-2xl md:text-3xl">
                {artist.name?.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
          
          {/* Genre Badge */}
          {genres.length > 0 && (
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
              <div className="glass-card rounded-lg px-2 py-1 sm:px-3 sm:py-1.5">
                <p className="text-white text-xs font-medium truncate max-w-[80px]">
                  {genres[0]}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 space-y-1 sm:space-y-2">
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight line-clamp-1">
            {artist.name}
          </h3>
          <div className="flex items-center gap-3 text-gray-400 text-xs sm:text-sm">
            {upcomingCount > 0 && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                {upcomingCount} {upcomingCount === 1 ? 'show' : 'shows'}
              </span>
            )}
            {artist.followers && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3 flex-shrink-0" />
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
