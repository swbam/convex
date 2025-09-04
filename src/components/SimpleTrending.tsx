import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { TrendingUp, Music, MapPin, Calendar, Clock, Users, Star } from 'lucide-react';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';

interface SimpleTrendingProps {
  onArtistClick: (artistId: Id<'artists'>, slug?: string) => void;
  onShowClick: (showId: Id<'shows'>, slug?: string) => void;
}

export function SimpleTrending({ onArtistClick, onShowClick }: SimpleTrendingProps) {
  const [activeTab, setActiveTab] = useState<'artists' | 'shows'>('artists');
  
  // Get trending data
  const trendingArtists = useQuery(api.trending.getTrendingArtists, { limit: 20 });
  const trendingShows = useQuery(api.trending.getTrendingShows, { limit: 20 });
  const recentActivity = useQuery(api.shows.getRecentlyUpdated, { limit: 10 });

  const handleArtistClick = (artist: any) => {
    onArtistClick(artist._id as Id<'artists'>, artist.slug);
  };

  const handleShowClick = (show: any) => {
    onShowClick(show._id as Id<'shows'>, show.slug);
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
              <p className="text-gray-300 text-sm sm:text-base">Popular artists and shows</p>
            </div>
          </div>
        </div>
        <BorderBeam size={150} duration={12} className="opacity-30" />
      </MagicCard>

      {/* Tab Navigation */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
        <button
          onClick={() => setActiveTab('artists')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'artists'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Artists
        </button>
        <button
          onClick={() => setActiveTab('shows')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'shows'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Shows
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
                  Top Trending {activeTab === 'artists' ? 'Artists' : 'Shows'}
                </h2>
              </div>

              {activeTab === 'artists' ? (
                // Artists Tab
                <div className="space-y-3">
                  {!trendingArtists ? (
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
                    trendingArtists.map((artist, index) => (
                      <div
                        key={`${artist._id}-${index}`}
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all duration-200"
                        onClick={() => handleArtistClick(artist)}
                      >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white font-bold">
                          {index + 1}
                        </div>
                        
                        {artist.images?.[0] ? (
                          <img
                            src={artist.images[0]}
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
                            {artist.followers && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {(artist.followers / 1000000).toFixed(1)}M followers
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Music className="h-3.5 w-3.5" />
                              {artist.upcomingShowsCount || 0} upcoming shows
                            </span>
                          </div>
                          {artist.genres?.length > 0 && (
                            <div className="flex gap-2 mt-1">
                              {artist.genres.slice(0, 2).map((genre: string, idx: number) => (
                                <span key={idx} className="text-xs px-2 py-0.5 bg-white/10 rounded-full">
                                  {genre}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-medium text-white">
                            {typeof artist.trendingScore === 'number' && Number.isFinite(artist.trendingScore) 
                              ? artist.trendingScore 
                              : 0}
                          </div>
                          <div className="text-xs text-gray-500">score</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                // Shows Tab
                <div className="space-y-3">
                  {!trendingShows ? (
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
                    trendingShows.map((show, index) => (
                      <div
                        key={`${show._id}-${index}`}
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all duration-200"
                        onClick={() => handleShowClick(show)}
                      >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white font-bold">
                          {index + 1}
                        </div>
                        
                        {(show.artist?.images?.[0] || show.artistImage) ? (
                          <img
                            src={show.artist?.images?.[0] || show.artistImage}
                            alt={show.artist?.name || show.artistName}
                            className="w-12 h-12 rounded object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-white/10 flex items-center justify-center">
                            <Music className="h-6 w-6 text-white/50" />
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{show.artist?.name || show.artistName}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {show.venue?.name || show.venueName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(show.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {(show.venue?.city || show.venueCity)}{(show.venue?.country || show.venueCountry) && `, ${show.venue?.country || show.venueCountry}`}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-medium text-white">Hot</div>
                          <div className="text-xs text-gray-500">trending</div>
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
          {/* Recent Activity */}
          <MagicCard className="p-0 rounded-2xl border border-white/10 bg-black">
            <div className="p-4 sm:p-6">
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
                <div className="space-y-3">
                  {recentActivity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-white">
                            New show: {activity.artist?.name || 'Unknown Artist'} at{' '}
                            <span className="font-semibold">{activity.venue?.name || 'Unknown Venue'}</span>
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span>{activity.venue?.city || 'Unknown City'}</span>
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