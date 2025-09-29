import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { TrendingUp, Music, MapPin, Calendar, Clock, Users, Star } from 'lucide-react';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';

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

    if (typeof artist._id === 'string' && artist._id.startsWith('k')) {
      onArtistClick(artist._id as Id<'artists'>, fallbackSlug);
      return;
    }

    if (typeof artist.ticketmasterId === 'string' && artist.ticketmasterId.length > 0) {
      onArtistClick(artist.ticketmasterId, fallbackSlug);
      return;
    }

    if (fallbackSlug) {
      onArtistClick(fallbackSlug, fallbackSlug);
    }
  };

  const handleShowClick = (show: any) => {
    const localId = typeof show._id === 'string'
      ? show._id
      : typeof show.showId === 'string'
        ? show.showId
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
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 relative z-10">
      {/* Header */}
      <MagicCard className="relative overflow-hidden rounded-2xl p-0 border border-white/10 bg-black">
        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Trending</h1>
              <p className="text-gray-300 text-sm sm:text-base">Real-time popular artists and shows</p>
            </div>
          </div>
        </div>
        <BorderBeam size={150} duration={12} className="opacity-30" />
      </MagicCard>

      {/* Tab Navigation */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
        <button
          onClick={() => setActiveTab('artists')}
          className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'artists'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Artists
        </button>
        <button
          onClick={() => setActiveTab('shows')}
          className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'shows'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Shows
        </button>
        <button
          onClick={() => setActiveTab('setlists')}
          className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'setlists'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Setlists
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <MagicCard className="p-0 rounded-2xl border border-white/10 bg-black">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Top Trending {activeTab === 'artists' ? 'Artists' : activeTab === 'shows' ? 'Shows' : 'Setlists'}
                </h2>
              </div>

              {activeTab === 'artists' && (
                // Artists Tab
                <div className="space-y-3">
                  {!trendingArtists ? (
                    // Loading state
                    [...Array(10)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                          <div className="w-12 h-12 bg-white/10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <div className="h-5 bg-white/10 rounded w-1/3" />
                            <div className="h-4 bg-white/10 rounded w-1/2" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : trendingArtists.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No trending artists data available</p>
                    </div>
                  ) : (
                    trendingArtists.map((artist, index) => {
                      const artistKey = artist.ticketmasterId || artist._id || index;
                      const image = Array.isArray(artist.images) && artist.images.length > 0 ? artist.images[0] : undefined;
                      const genres = Array.isArray(artist.genres) ? artist.genres : [];
                      const upcomingCount = typeof artist.upcomingShowsCount === 'number'
                        ? artist.upcomingShowsCount
                        : typeof artist.upcomingEvents === 'number'
                          ? artist.upcomingEvents
                          : 0;

                      return (
                        <div
                          key={`${artistKey}`}
                          className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all duration-200"
                          onClick={() => handleArtistClick(artist)}
                        >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white font-bold">
                          {index + 1}
                        </div>

                        {image ? (
                          <img
                            src={image}
                            alt={artist.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                            <Music className="h-6 w-6 text-white/50" />
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{artist.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {artist.followers ? `${(artist.followers / 1000000).toFixed(1)}M followers` : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <Music className="h-3.5 w-3.5" />
                              {upcomingCount} upcoming shows
                            </span>
                          </div>
                          {genres.length > 0 && (
                            <div className="flex gap-2 mt-1">
                              {genres.slice(0, 2).map((genre: string, idx: number) => (
                                <span key={idx} className="text-xs px-2 py-0.5 bg-white/10 rounded-full">
                                  {genre}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-1 text-green-400">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm font-medium">0.0%</span>
                          </div>
                          <div className="text-xs text-gray-500">Score: {95 - index}</div>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'shows' && (
                // Shows Tab
                <div className="space-y-3">
                  {!trendingShows ? (
                    // Loading state
                    [...Array(10)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                          <div className="w-12 h-12 bg-white/10 rounded" />
                          <div className="flex-1 space-y-2">
                            <div className="h-5 bg-white/10 rounded w-2/3" />
                            <div className="h-4 bg-white/10 rounded w-1/2" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : trendingShows.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No trending shows data available</p>
                    </div>
                  ) : (
<<<<<<< HEAD
                    trendingShows.map((show, index) => {
                      const showKey = show.ticketmasterId || show._id || index;
                      const artistName = show.artist?.name || show.artistName || 'Unknown Artist';
                      const artistImage = show.artist?.images?.[0] || show.artistImage;
                      const venueName = show.venue?.name || show.venueName || 'Unknown Venue';
                      const venueCity = show.venue?.city || show.venueCity || '';
                      const venueCountry = show.venue?.country || show.venueCountry || '';
                      const eventDate = new Date(show.date);
                      const dateLabel = Number.isNaN(eventDate.getTime())
                        ? show.date
                        : eventDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          });
                      const locationLabel = [venueCity, venueCountry].filter(Boolean).join(', ');

                      return (
                        <div
                          key={`${showKey}`}
                          className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all duration-200"
                          onClick={() => handleShowClick(show)}
                        >
=======
                    trendingShows.map((show, index) => (
                      <div
                        key={`${show._id}-${index}`}
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all duration-200"
                        onClick={() => handleShowClick(show)}
                      >
>>>>>>> 0dab9c7 (edits)
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white font-bold">
                          {show.trendingRank || index + 1}
                        </div>
<<<<<<< HEAD

                        {artistImage ? (
                          <img
                            src={artistImage}
                            alt={artistName}
=======
                        
                        {(show.artist?.images?.[0]) ? (
                          <img
                            src={show.artist.images[0]}
                            alt={show.artist.name}
>>>>>>> 0dab9c7 (edits)
                            className="w-12 h-12 rounded object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-white/10 flex items-center justify-center">
                            <Music className="h-6 w-6 text-white/50" />
                          </div>
                        )}

                        <div className="flex-1">
<<<<<<< HEAD
                          <h3 className="font-semibold text-white">{artistName}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {venueName}
=======
                          <h3 className="font-semibold text-white">{show.artist?.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {show.venue?.name}
>>>>>>> 0dab9c7 (edits)
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {dateLabel}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
<<<<<<< HEAD
                            {locationLabel}
=======
                            {show.venue?.city}, {show.venue?.country}
>>>>>>> 0dab9c7 (edits)
                          </div>
                          {/* Dynamic engagement metrics */}
                          {((show.voteCount || 0) > 0 || (show.setlistCount || 0) > 0) && (
                            <div className="flex gap-4 mt-2 text-xs">
                              <span className="flex items-center gap-1 text-blue-400">
                                <Users className="h-3 w-3" />
                                {show.voteCount || 0} votes
                              </span>
                              <span className="flex items-center gap-1 text-purple-400">
                                <Music className="h-3 w-3" />
                                {show.setlistCount || 0} setlists
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-1 text-green-400">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {show.trendingScore ? show.trendingScore.toFixed(1) : 'N/A'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">Score</div>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              )}
              
              {activeTab === 'setlists' && (
                // Setlists Tab
                <div className="space-y-3">
                  {!trendingSetlists ? (
                    [...Array(10)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                          <div className="w-12 h-12 bg-white/10 rounded" />
                          <div className="flex-1 space-y-2">
                            <div className="h-5 bg-white/10 rounded w-2/3" />
                            <div className="h-4 bg-white/10 rounded w-1/2" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : trendingSetlists.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No trending setlists available</p>
                    </div>
                  ) : (
                    trendingSetlists.map((setlist, index) => (
                      <div
                        key={setlist._id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all duration-200"
                      >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white font-bold">
                          {index + 1}
                        </div>
                        
                        {setlist.artist?.images?.[0] ? (
                          <img
                            src={setlist.artist.images[0]}
                            alt={setlist.artist.name}
                            className="w-12 h-12 rounded object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-white/10 flex items-center justify-center">
                            <Music className="h-6 w-6 text-white/50" />
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{setlist.artist?.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {setlist.venue?.name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Music className="h-3.5 w-3.5" />
                              {setlist.songs.length} songs
                            </span>
                          </div>
                          {setlist.verified && (
                            <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full mt-1 inline-block">
                              ✓ Verified
                            </span>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-medium text-white">{setlist.voteCount}</div>
                          <div className="text-xs text-gray-500">votes</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <BorderBeam size={120} duration={10} className="opacity-20" />
          </MagicCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Trending Cities */}
          <MagicCard className="p-0 rounded-2xl border border-white/10 bg-black">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="h-5 w-5 text-white" />
                <h3 className="text-lg font-bold text-white">Trending Cities</h3>
              </div>
              <div className="text-center py-8 text-gray-400">
                <MapPin className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No trending locations found</p>
              </div>
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>

          {/* Recent Activity */}
          <MagicCard className="p-0 rounded-2xl border border-white/10 bg-black">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="h-5 w-5 text-white" />
                <h3 className="text-lg font-bold text-white">Recent Activity</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">Latest setlist votes and updates</p>
              
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
                <div className="space-y-3">
                  {recentActivity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-white">
                            Someone updated show details at{' '}
                            <span className="font-semibold">{activity.venue?.name || 'Unknown Venue'}</span>
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span>{activity.artist?.name || 'Unknown Artist'}</span>
                            <span>•</span>
                            <span>
                              {new Date(activity._creationTime).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>
        </div>
      </div>
    </div>
  );
}