import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { TrendingUp, Music, MapPin, Calendar, Clock, Flame, ChevronRight } from 'lucide-react';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';
import { motion } from 'framer-motion';

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

interface TrendingProps {
  onArtistClick: (artistKey: Id<'artists'> | string, slug?: string) => void;
  onShowClick: (showKey: Id<'shows'> | string, slug?: string) => void;
}

export function Trending({ onArtistClick, onShowClick }: TrendingProps) {
  const [activeTab, setActiveTab] = useState<'artists' | 'shows' | 'setlists'>('artists');
  
  // Get trending data directly from main tables with trending ranks!
  const trendingArtists = useQuery(api.trending.getTrendingArtists, { limit: 20 });
  const trendingShows = useQuery(api.trending.getTrendingShows, { limit: 20 });
  const trendingSetlists = useQuery(api.activity.getTrendingSetlists, { limit: 20 });
  
  // Get recent activity/updates
  const recentActivity = useQuery(api.shows.getRecentlyUpdated, { limit: 10 });

  const handleArtistClick = (artist: any) => {
    const fallbackSlug = typeof artist.slug === 'string' && artist.slug.trim().length > 0
      ? artist.slug
      : typeof artist.name === 'string'
        ? toSlug(artist.name)
        : undefined;

    if (typeof artist.artistId === 'string' && artist.artistId.startsWith('k')) {
      onArtistClick(artist.artistId as Id<'artists'>, fallbackSlug);
      return;
    }

    if (typeof artist._id === 'string' && artist._id.startsWith('k')) {
      onArtistClick(artist._id as Id<'artists'>, fallbackSlug);
      return;
    }

    if (fallbackSlug) {
      onArtistClick(fallbackSlug, fallbackSlug);
      return;
    }

    if (typeof artist.ticketmasterId === 'string' && artist.ticketmasterId.length > 0) {
      onArtistClick(artist.ticketmasterId, fallbackSlug);
      return;
    }

    console.error('Unable to navigate to artist - no valid identifier found:', artist);
  };

  const handleShowClick = (show: any) => {
    const localId = typeof show.showId === 'string'
      ? show.showId
      : typeof show._id === 'string'
      ? show._id
        : undefined;

    const inferredSlug = typeof show.slug === 'string' && show.slug.trim().length > 0
      ? show.slug
      : typeof show.showSlug === 'string' && show.showSlug.trim().length > 0
        ? show.showSlug
        : toSlug([
            show.artist?.name || show.artistName,
            show.venue?.name || show.venueName,
            show.venue?.city || show.venueCity,
            show.date,
          ]
            .filter((part) => typeof part === 'string' && part.length > 0)
            .join(' '));

    if (localId && localId.startsWith('k')) {
      onShowClick(localId as Id<'shows'>, inferredSlug);
      return;
    }

    if (inferredSlug) {
      onShowClick(inferredSlug, inferredSlug);
      return;
    }

    if (typeof show.ticketmasterId === 'string' && show.ticketmasterId.length > 0) {
      onShowClick(show.ticketmasterId, inferredSlug);
      return;
    }

    console.error('Unable to navigate to show - no valid identifier found:', show);
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
    hidden: { opacity: 0, y: 16 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
    }
  };

  const tabs = [
    { id: 'artists', label: 'Artists', icon: Music },
    { id: 'shows', label: 'Shows', icon: Calendar },
    { id: 'setlists', label: 'Setlists', icon: Music },
  ] as const;

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
      {/* Premium Header - Mobile Optimized */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <MagicCard className="relative overflow-hidden rounded-xl sm:rounded-2xl p-0 border border-white/10 bg-card">
          <div className="relative z-10 p-4 sm:p-6 lg:p-8">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-orange-500/30 to-red-500/30 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-sm border border-orange-500/20">
                <Flame className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Trending</h1>
                <p className="text-gray-400 text-xs sm:text-sm mt-0.5 sm:mt-1">Discover what's hot right now</p>
              </div>
            </div>
          </div>
          <BorderBeam size={150} duration={12} className="opacity-30" />
        </MagicCard>
      </motion.div>

      {/* Tab Navigation - Mobile Optimized */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex justify-center"
      >
        <div className="inline-flex gap-1 sm:gap-2 p-1 sm:p-1.5 bg-white/5 rounded-xl sm:rounded-2xl backdrop-blur-sm border border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 py-2 px-3 sm:py-2.5 sm:px-5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white/15 text-white shadow-lg border border-white/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <MagicCard className="p-0 rounded-2xl border border-white/10 bg-card overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Top {activeTab === 'artists' ? 'Artists' : activeTab === 'shows' ? 'Shows' : 'Setlists'}
                </h2>
              </div>

              {activeTab === 'artists' && (
                <motion.div
                  key="artists"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-2 sm:grid-cols-3 gap-4"
                >
                  {!trendingArtists ? (
                    [...Array(9)].map((_, i) => (
                      <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
                        <div className="aspect-square bg-white/5" />
                        <div className="p-3 space-y-2">
                          <div className="h-4 bg-white/10 rounded w-3/4" />
                          <div className="h-3 bg-white/10 rounded w-1/2" />
                        </div>
                      </div>
                    ))
                  ) : (!Array.isArray(trendingArtists.page) || trendingArtists.page.length === 0) ? (
                    <div className="col-span-full text-center py-12 text-gray-400">
                      <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No trending artists data available</p>
                    </div>
                  ) : (
                    (trendingArtists.page ?? []).map((artist: any, index: number) => (
                      <TrendingArtistCard
                        key={artist._id || index}
                        artist={artist}
                        rank={index + 1}
                        onClick={() => handleArtistClick(artist)}
                        variants={cardVariants}
                      />
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'shows' && (
                <motion.div
                  key="shows"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-2 sm:grid-cols-3 gap-4"
                >
                  {!trendingShows ? (
                    [...Array(9)].map((_, i) => (
                      <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
                        <div className="aspect-square bg-white/5" />
                        <div className="p-3 space-y-2">
                          <div className="h-4 bg-white/10 rounded w-3/4" />
                          <div className="h-3 bg-white/10 rounded w-1/2" />
                        </div>
                      </div>
                    ))
                  ) : (!Array.isArray(trendingShows.page) || trendingShows.page.length === 0) ? (
                    <div className="col-span-full text-center py-12 text-gray-400">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No trending shows data available</p>
                    </div>
                  ) : (
                    (trendingShows.page ?? []).map((show: any, index: number) => (
                      <TrendingShowCard
                        key={show._id || index}
                        show={show}
                        rank={index + 1}
                        onClick={() => handleShowClick(show)}
                        variants={cardVariants}
                      />
                    ))
                  )}
                </motion.div>
              )}
              
              {activeTab === 'setlists' && (
                <motion.div
                  key="setlists"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-3"
                >
                  {!trendingSetlists ? (
                    [...Array(8)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                          <div className="w-12 h-12 bg-white/10 rounded-lg" />
                          <div className="flex-1 space-y-2">
                            <div className="h-5 bg-white/10 rounded w-2/3" />
                            <div className="h-4 bg-white/10 rounded w-1/2" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (!Array.isArray(trendingSetlists) || trendingSetlists.length === 0) ? (
                    <div className="text-center py-12 text-gray-400">
                      <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No trending setlists available</p>
                    </div>
                  ) : (
                    (trendingSetlists ?? []).map((setlist: any, index: number) => (
                      <motion.div
                        key={setlist._id}
                        variants={cardVariants}
                        className="glass-card glass-card-hover rounded-xl p-4 cursor-pointer"
                        onClick={() => {
                          const showId = setlist.show?._id ?? setlist._id;
                          const showSlug = setlist.show?.slug as string | undefined;
                          onShowClick(showId, showSlug);
                        }}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                            {setlist.artist?.images?.[0] ? (
                              <img
                                src={setlist.artist.images[0]}
                                alt={setlist.artist?.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                                <Music className="h-5 w-5 text-gray-500" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-white truncate">{setlist.artist?.name}</h3>
                            <p className="text-sm text-gray-400 truncate">
                              {setlist.venue?.name} • {setlist.songs?.length ?? 0} songs
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-gray-400">
                            <span className="text-xs bg-white/10 px-2 py-1 rounded-full">
                              #{index + 1}
                            </span>
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}
            </div>
            <BorderBeam size={120} duration={10} className="opacity-20" />
          </MagicCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <MagicCard className="p-0 rounded-2xl border border-white/10 bg-card">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="h-5 w-5 text-orange-400" />
                  <h3 className="text-lg font-bold text-white">Quick Stats</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-card rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-white">
                      {trendingArtists?.page?.length || 0}
                    </div>
                    <div className="text-xs text-gray-400">Artists</div>
                  </div>
                  <div className="glass-card rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-white">
                      {trendingShows?.page?.length || 0}
                    </div>
                    <div className="text-xs text-gray-400">Shows</div>
                  </div>
                </div>
              </div>
              <BorderBeam size={80} duration={8} className="opacity-20" />
            </MagicCard>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <MagicCard className="p-0 rounded-2xl border border-white/10 bg-card">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="h-5 w-5 text-white" />
                  <h3 className="text-lg font-bold text-white">Recent Activity</h3>
                </div>
                
                {!recentActivity ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="p-3 rounded-lg bg-white/5">
                          <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-white/10 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentActivity.length === 0 ? (
                  <p className="text-sm text-gray-500">No recent activity</p>
                ) : (
                  <div className="space-y-2">
                    {recentActivity.slice(0, 5).map((activity, index) => (
                      <motion.div 
                        key={index} 
                        className="p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">
                              <span className="font-semibold">{activity.artist?.name || 'Unknown'}</span>
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {activity.venue?.name || 'Unknown Venue'}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              <BorderBeam size={80} duration={8} className="opacity-20" />
            </MagicCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Premium Artist Card for Trending
function TrendingArtistCard({
  artist,
  rank,
  onClick,
  variants,
}: {
  artist: any;
  rank: number;
  onClick: () => void;
  variants?: any;
}) {
  const image = Array.isArray(artist.images) && artist.images.length > 0 ? artist.images[0] : undefined;
  const upcomingCount = typeof artist.upcomingShowsCount === 'number'
    ? artist.upcomingShowsCount
    : typeof artist.upcomingEvents === 'number'
      ? artist.upcomingEvents
      : 0;

  return (
    <motion.div
      variants={variants}
      className="cursor-pointer transform-gpu"
      onClick={onClick}
      whileHover={{ y: -6, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-2xl overflow-hidden card-lift">
        <div className="relative aspect-square overflow-hidden">
          {image ? (
            <motion.img
              src={image}
              alt={artist.name}
              className="w-full h-full object-cover"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4 }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
              <span className="text-white/80 font-bold text-2xl">
                {artist.name?.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          
          {/* Rank Badge */}
          <div className="absolute top-2 left-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm ${
              rank <= 3 
                ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white' 
                : 'bg-white/20 backdrop-blur-sm text-white'
            }`}>
              {rank}
            </div>
          </div>
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-white text-sm truncate">{artist.name}</h3>
          <p className="text-xs text-gray-400">
            {upcomingCount} {upcomingCount === 1 ? 'show' : 'shows'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// Premium Show Card for Trending
function TrendingShowCard({
  show,
  rank,
  onClick,
  variants,
}: {
  show: any;
  rank: number;
  onClick: () => void;
  variants?: any;
}) {
  const artistName = show.artist?.name || show.artistName || 'Unknown Artist';
  const artistImage = show.artist?.images?.[0] || show.artistImage;
  const venueCity = show.venue?.city || show.venueCity || '';
  const eventDate = new Date(show.date);
  const dateLabel = Number.isNaN(eventDate.getTime())
    ? show.date
    : eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <motion.div
      variants={variants}
      className="cursor-pointer transform-gpu"
      onClick={onClick}
      whileHover={{ y: -6, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-2xl overflow-hidden card-lift">
        <div className="relative aspect-square overflow-hidden">
          {artistImage ? (
            <motion.img
              src={artistImage}
              alt={artistName}
              className="w-full h-full object-cover"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4 }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
              <span className="text-white/80 font-bold text-2xl">
                {artistName.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          
          {/* Date Badge */}
          <div className="absolute top-2 right-2">
            <div className="glass-card rounded-lg px-2 py-1">
              <p className="text-white text-xs font-bold">{dateLabel}</p>
            </div>
          </div>
          
          {/* Rank Badge */}
          <div className="absolute top-2 left-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm ${
              rank <= 3 
                ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white' 
                : 'bg-white/20 backdrop-blur-sm text-white'
            }`}>
              {rank}
            </div>
          </div>
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-white text-sm truncate">{artistName}</h3>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{venueCity}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
