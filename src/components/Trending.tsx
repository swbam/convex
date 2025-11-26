import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { TrendingUp, Music, MapPin, Calendar, Clock, ChevronRight, Users } from 'lucide-react';
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

  const tabs = [
    { id: 'artists', label: 'Artists', icon: Music },
    { id: 'shows', label: 'Shows', icon: Calendar },
    { id: 'setlists', label: 'Setlists', icon: Music },
  ] as const;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 relative z-10">
      {/* Streamlined Header with Tabs */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-secondary rounded-xl border border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{trendingArtists?.page?.length || 0} artists</span>
          <span>•</span>
          <span>{trendingShows?.page?.length || 0} shows</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeTab === 'artists' && (
            <motion.div
              key="artists"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4"
            >
              {!trendingArtists ? (
                [...Array(10)].map((_, i) => (
                  <div key={i} className="glass-card rounded-xl overflow-hidden animate-pulse">
                    <div className="aspect-square bg-secondary" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-secondary rounded w-3/4" />
                      <div className="h-3 bg-secondary rounded w-1/2" />
                    </div>
                  </div>
                ))
              ) : (!Array.isArray(trendingArtists.page) || trendingArtists.page.length === 0) ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trending artists data available</p>
                </div>
              ) : (
                trendingArtists.page.map((artist: any, index: number) => (
                  <motion.div
                    key={artist._id || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                  >
                    <ArtistCard
                      artist={artist}
                      rank={index + 1}
                      onClick={() => handleArtistClick(artist)}
                    />
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'shows' && (
            <motion.div
              key="shows"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4"
            >
              {!trendingShows ? (
                [...Array(10)].map((_, i) => (
                  <div key={i} className="glass-card rounded-xl overflow-hidden animate-pulse">
                    <div className="aspect-square bg-secondary" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-secondary rounded w-3/4" />
                      <div className="h-3 bg-secondary rounded w-1/2" />
                    </div>
                  </div>
                ))
              ) : (!Array.isArray(trendingShows.page) || trendingShows.page.length === 0) ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trending shows data available</p>
                </div>
              ) : (
                trendingShows.page.map((show: any, index: number) => (
                  <motion.div
                    key={show._id || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                  >
                    <ShowCard
                      show={show}
                      rank={index + 1}
                      onClick={() => handleShowClick(show)}
                    />
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
          
          {activeTab === 'setlists' && (
            <motion.div
              key="setlists"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {!trendingSetlists ? (
                [...Array(8)].map((_, i) => (
                  <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-secondary rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-secondary rounded w-3/4" />
                        <div className="h-3 bg-secondary rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))
              ) : (!Array.isArray(trendingSetlists) || trendingSetlists.length === 0) ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trending setlists available</p>
                </div>
              ) : (
                trendingSetlists.map((setlist: any, index: number) => (
                  <motion.div
                    key={setlist._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    className="glass-card glass-card-hover rounded-xl p-3 cursor-pointer"
                    onClick={() => {
                      const showId = setlist.show?._id ?? setlist._id;
                      const showSlug = setlist.show?.slug as string | undefined;
                      onShowClick(showId, showSlug);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                        {setlist.artist?.images?.[0] ? (
                          <img
                            src={setlist.artist.images[0]}
                            alt={setlist.artist?.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-secondary flex items-center justify-center">
                            <Music className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm truncate">{setlist.artist?.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {setlist.venue?.name} • {setlist.songs?.length ?? 0} songs
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-secondary px-2 py-1 rounded-full text-muted-foreground">
                          #{index + 1}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </div>

        {/* Sidebar - Recent Activity */}
        <div className="lg:col-span-1">
          <div className="glass-card rounded-xl p-4 sticky top-20">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
            </div>
            
            {!recentActivity ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse p-2 rounded-lg bg-secondary">
                    <div className="h-3 bg-secondary rounded w-3/4 mb-1" />
                    <div className="h-2 bg-secondary rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.slice(0, 6).map((activity, index) => (
                  <motion.div 
                    key={index} 
                    className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleShowClick(activity)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate font-medium">
                          {activity.artist?.name || 'Unknown'}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {activity.venue?.name || 'Unknown Venue'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact Artist Card
function ArtistCard({ artist, rank, onClick }: { artist: any; rank: number; onClick: () => void }) {
  const image = Array.isArray(artist.images) && artist.images.length > 0 ? artist.images[0] : undefined;
  const upcomingCount = typeof artist.upcomingShowsCount === 'number'
    ? artist.upcomingShowsCount
    : typeof artist.upcomingEvents === 'number'
      ? artist.upcomingEvents
      : 0;

  return (
    <motion.div
      className="cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-xl overflow-hidden shadow-elevated">
        <div className="relative aspect-square overflow-hidden">
          {image ? (
            <img
              src={image}
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
          
          {/* Rank Badge */}
          <div className="absolute top-2 left-2">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${
              rank <= 3 
                ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white' 
                : 'bg-secondary/80 backdrop-blur-sm text-foreground'
            }`}>
              {rank}
            </div>
          </div>
        </div>
        <div className="p-2.5 sm:p-3">
          <h3 className="font-semibold text-foreground text-xs sm:text-sm line-clamp-1">{artist.name}</h3>
          <div className="flex items-center gap-1 mt-1 text-muted-foreground text-[10px] sm:text-xs">
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

// Compact Show Card
function ShowCard({ show, rank, onClick }: { show: any; rank: number; onClick: () => void }) {
  const artistName = show.artist?.name || show.artistName || 'Unknown Artist';
  const artistImage = show.artist?.images?.[0] || show.artistImage;
  const venueCity = show.venue?.city || show.venueCity || '';
  const eventDate = new Date(show.date);
  const dateLabel = Number.isNaN(eventDate.getTime())
    ? show.date
    : eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <motion.div
      className="cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card glass-card-hover rounded-xl overflow-hidden shadow-elevated">
        <div className="relative aspect-square overflow-hidden">
          {artistImage ? (
            <img
              src={artistImage}
              alt={artistName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-foreground/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Date Badge */}
          <div className="absolute top-2 right-2">
            <div className="glass-card rounded-md px-1.5 py-0.5">
              <p className="text-foreground text-[10px] font-medium">{dateLabel}</p>
            </div>
          </div>
          
          {/* Rank Badge */}
          <div className="absolute top-2 left-2">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${
              rank <= 3 
                ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white' 
                : 'bg-secondary/80 backdrop-blur-sm text-foreground'
            }`}>
              {rank}
            </div>
          </div>
        </div>
        <div className="p-2.5 sm:p-3">
          <h3 className="font-semibold text-foreground text-xs sm:text-sm line-clamp-1">{artistName}</h3>
          <div className="flex items-center gap-1 mt-1 text-muted-foreground text-[10px] sm:text-xs">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{venueCity}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
