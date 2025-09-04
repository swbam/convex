import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { TrendingUp, Music, MapPin, Calendar, Clock, Users, Star, Trophy, Activity, Fire, Zap } from 'lucide-react';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface EnhancedTrendingProps {
  onArtistClick: (artistId: Id<'artists'>, slug?: string) => void;
  onShowClick: (showId: Id<'shows'>, slug?: string) => void;
}

export function EnhancedTrending({ onArtistClick, onShowClick }: EnhancedTrendingProps) {
  const [activeTab, setActiveTab] = useState<'artists' | 'shows' | 'setlists' | 'activity'>('artists');
  
  // Get trending data
  const trendingArtists = useQuery(api.trending.getTrendingArtists, { limit: 20 });
  const trendingShows = useQuery(api.trending.getTrendingShows, { limit: 20 });
  const trendingSetlists = useQuery(api.activity.getTrendingSetlists, { limit: 20 });
  const globalActivity = useQuery(api.activity.getGlobalActivityFeed, { limit: 20 });
  const leaderboard = useQuery(api.social.getCommunityLeaderboard, { type: 'votes', limit: 10 });

  const handleArtistClick = (artist: any) => {
    onArtistClick(artist._id as Id<'artists'>, artist.slug);
  };

  const handleShowClick = (show: any) => {
    onShowClick(show._id as Id<'shows'>, show.slug);
  };

  const renderTrendingArtists = () => (
    <div className="space-y-4">
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
          <MagicCard
            key={`${artist._id}-${index}`}
            className="p-0 rounded-xl border border-white/10 bg-black/50 hover:bg-white/5 cursor-pointer transition-all duration-200"
            onClick={() => handleArtistClick(artist)}
          >
            <div className="flex items-center gap-4 p-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 text-white font-bold">
                {index + 1}
              </div>
              
              {artist.images?.[0] ? (
                <img
                  src={artist.images[0]}
                  alt={artist.name}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center">
                  <Music className="h-8 w-8 text-white/50" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white text-lg truncate">{artist.name}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                  {artist.followers && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {(artist.followers / 1000000).toFixed(1)}M followers
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {artist.upcomingShowsCount || 0} shows
                  </span>
                </div>
                {artist.genres?.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {artist.genres.slice(0, 2).map((genre: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-1 text-green-400 mb-1">
                  <Fire className="h-4 w-4" />
                  <span className="text-sm font-medium">Hot</span>
                </div>
                <div className="text-xs text-gray-500">
                  Score: {typeof artist.trendingScore === 'number' && Number.isFinite(artist.trendingScore) ? artist.trendingScore : 0}
                </div>
              </div>
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>
        ))
      )}
    </div>
  );

  const renderTrendingShows = () => (
    <div className="space-y-4">
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
          <MagicCard
            key={`${show._id}-${index}`}
            className="p-0 rounded-xl border border-white/10 bg-black/50 hover:bg-white/5 cursor-pointer transition-all duration-200"
            onClick={() => handleShowClick(show)}
          >
            <div className="flex items-center gap-4 p-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-white font-bold">
                {index + 1}
              </div>
              
              {(show.artist?.images?.[0] || show.artistImage) ? (
                <img
                  src={show.artist?.images?.[0] || show.artistImage}
                  alt={show.artist?.name || show.artistName}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center">
                  <Music className="h-8 w-8 text-white/50" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white text-lg truncate">
                  {show.artist?.name || show.artistName}
                </h3>
                <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {show.venue?.name || show.venueName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(show.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {(show.venue?.city || show.venueCity)}{(show.venue?.country || show.venueCountry) && `, ${show.venue?.country || show.venueCountry}`}
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-1 text-orange-400 mb-1">
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-medium">Buzz</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {show.status === 'upcoming' ? 'Upcoming' : 'Past'}
                </Badge>
              </div>
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>
        ))
      )}
    </div>
  );

  const renderTrendingSetlists = () => (
    <div className="space-y-4">
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
          <MagicCard
            key={setlist._id}
            className="p-0 rounded-xl border border-white/10 bg-black/50 hover:bg-white/5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center gap-4 p-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-white font-bold">
                {index + 1}
              </div>
              
              {setlist.artist?.images?.[0] ? (
                <img
                  src={setlist.artist.images[0]}
                  alt={setlist.artist.name}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center">
                  <Music className="h-8 w-8 text-white/50" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white text-lg truncate">
                  {setlist.artist?.name}
                </h3>
                <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {setlist.venue?.name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Music className="h-3.5 w-3.5" />
                    {setlist.songs.length} songs
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {setlist.verified && (
                    <Badge variant="default" className="text-xs">
                      ✓ Verified
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {setlist.voteCount} votes
                  </Badge>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-1 text-purple-400 mb-1">
                  <Star className="h-4 w-4" />
                  <span className="text-sm font-medium">Popular</span>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(setlist.lastUpdated).toLocaleDateString()}
                </div>
              </div>
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>
        ))
      )}
    </div>
  );

  const renderGlobalActivity = () => (
    <div className="space-y-4">
      {!globalActivity ? (
        [...Array(10)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="p-4 rounded-xl bg-white/5">
              <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          </div>
        ))
      ) : globalActivity.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No recent activity</p>
        </div>
      ) : (
        globalActivity.map((activity) => (
          <div key={activity._id} className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                {activity.type === 'song_vote' && <Star className="h-4 w-4 text-primary" />}
                {activity.type === 'setlist_created' && <Music className="h-4 w-4 text-primary" />}
                {activity.type === 'show_imported' && <Calendar className="h-4 w-4 text-primary" />}
              </div>
              <div className="flex-1">
                <p className="text-sm text-white mb-1">
                  {activity.username && (
                    <span className="font-semibold text-primary">{activity.username} </span>
                  )}
                  {activity.type === 'song_vote' && `voted for "${activity.data.songTitle}" by ${activity.data.artistName}`}
                  {activity.type === 'setlist_created' && `created a setlist for ${activity.data.artistName} (${activity.data.songsCount} songs)`}
                  {activity.type === 'show_imported' && `imported ${activity.data.artistName} show at ${activity.data.venueName}`}
                </p>
                <div className="text-xs text-gray-400">
                  {new Date(activity.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 relative z-10">
      {/* Header */}
      <MagicCard className="relative overflow-hidden rounded-2xl p-0 border border-white/10 bg-black">
        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Trending Now</h1>
              <p className="text-gray-300 text-sm sm:text-base">Discover what's hot in the music community</p>
            </div>
          </div>
        </div>
        <BorderBeam size={150} duration={12} className="opacity-30" />
      </MagicCard>

      {/* Tab Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
        {[
          { key: 'artists', label: 'Artists', icon: Users },
          { key: 'shows', label: 'Shows', icon: Calendar },
          { key: 'setlists', label: 'Setlists', icon: Music },
          { key: 'activity', label: 'Activity', icon: Activity },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              activeTab === key
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
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
                  {activeTab === 'artists' && 'Top Trending Artists'}
                  {activeTab === 'shows' && 'Hot Shows'}
                  {activeTab === 'setlists' && 'Popular Setlists'}
                  {activeTab === 'activity' && 'Community Activity'}
                </h2>
              </div>

              {activeTab === 'artists' && renderTrendingArtists()}
              {activeTab === 'shows' && renderTrendingShows()}
              {activeTab === 'setlists' && renderTrendingSetlists()}
              {activeTab === 'activity' && renderGlobalActivity()}
            </div>
            <BorderBeam size={120} duration={10} className="opacity-20" />
          </MagicCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Community Leaderboard */}
          <MagicCard className="p-0 rounded-2xl border border-white/10 bg-black">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <Trophy className="h-5 w-5 text-yellow-400" />
                <h3 className="text-lg font-bold text-white">Top Contributors</h3>
              </div>
              
              {!leaderboard ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-12 bg-white/5 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.slice(0, 5).map((user) => (
                    <div key={user._id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-sm font-bold text-white">
                        {user.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">{user.username}</div>
                        <div className="text-xs text-gray-400">{user.score} votes</div>
                      </div>
                      {user.badge && (
                        <div className="text-xs">{user.badge.split(' ')[0]}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>

          {/* Quick Stats */}
          <MagicCard className="p-0 rounded-2xl border border-white/10 bg-black">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-bold text-white">Platform Stats</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Active Artists</span>
                  <span className="text-white font-semibold">{trendingArtists?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Trending Shows</span>
                  <span className="text-white font-semibold">{trendingShows?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Hot Setlists</span>
                  <span className="text-white font-semibold">{trendingSetlists?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Community Activity</span>
                  <span className="text-white font-semibold">{globalActivity?.length || 0}</span>
                </div>
              </div>
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>
        </div>
      </div>
    </div>
  );
}