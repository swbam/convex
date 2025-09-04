import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  User, Activity, Star, Music, Calendar, TrendingUp, 
  Clock, ArrowLeft, Settings, Target, Award
} from 'lucide-react';

interface SimpleProfileProps {
  onArtistClick: (artistId: Id<"artists">, slug?: string) => void;
  onShowClick: (showId: Id<"shows">, slug?: string) => void;
}

export function SimpleProfile({ onArtistClick, onShowClick }: SimpleProfileProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Get user data
  const user = useQuery(api.auth.loggedInUser);
  const activityFeed = useQuery(api.activity.getUserActivityFeed, { limit: 20 });
  const activityStats = useQuery(api.activity.getUserActivityStats);
  const userVotes = useQuery(api.songVotes.getUserVotes, { limit: 50 });
  
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-400">Please sign in to view your profile</p>
        <Button onClick={() => navigate('/signin')} className="mt-4">
          Sign In
        </Button>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MagicCard className="p-0 rounded-xl border border-white/10 bg-black">
          <div className="p-4 text-center">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Star className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{activityStats?.totalVotes || 0}</div>
            <div className="text-xs text-gray-400">Total Votes</div>
          </div>
          <BorderBeam size={60} duration={6} className="opacity-20" />
        </MagicCard>

        <MagicCard className="p-0 rounded-xl border border-white/10 bg-black">
          <div className="p-4 text-center">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Music className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{activityStats?.totalSetlists || 0}</div>
            <div className="text-xs text-gray-400">Setlists Created</div>
          </div>
          <BorderBeam size={60} duration={6} className="opacity-20" />
        </MagicCard>

        <MagicCard className="p-0 rounded-xl border border-white/10 bg-black">
          <div className="p-4 text-center">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Target className="h-5 w-5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{activityStats?.accuracy || 0}%</div>
            <div className="text-xs text-gray-400">Accuracy</div>
          </div>
          <BorderBeam size={60} duration={6} className="opacity-20" />
        </MagicCard>

        <MagicCard className="p-0 rounded-xl border border-white/10 bg-black">
          <div className="p-4 text-center">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="h-5 w-5 text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{activityStats?.streak || 0}</div>
            <div className="text-xs text-gray-400">Day Streak</div>
          </div>
          <BorderBeam size={60} duration={6} className="opacity-20" />
        </MagicCard>
      </div>

      {/* Achievement Badges */}
      <MagicCard className="p-0 rounded-2xl border border-white/10 bg-black">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Award className="h-5 w-5 text-yellow-400" />
            <h3 className="text-lg font-bold text-white">Achievements</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {activityStats?.totalVotes && activityStats.totalVotes >= 10 && (
              <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="text-2xl mb-1">🎯</div>
                <div className="text-xs text-white font-medium">Voter</div>
                <div className="text-xs text-gray-400">10+ votes</div>
              </div>
            )}
            
            {activityStats?.totalVotes && activityStats.totalVotes >= 50 && (
              <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="text-2xl mb-1">⭐</div>
                <div className="text-xs text-white font-medium">Super Voter</div>
                <div className="text-xs text-gray-400">50+ votes</div>
              </div>
            )}
            
            {activityStats?.totalSetlists && activityStats.totalSetlists >= 5 && (
              <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="text-2xl mb-1">🎵</div>
                <div className="text-xs text-white font-medium">Curator</div>
                <div className="text-xs text-gray-400">5+ setlists</div>
              </div>
            )}
            
            {activityStats?.streak && activityStats.streak >= 7 && (
              <div className="text-center p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="text-2xl mb-1">🔥</div>
                <div className="text-xs text-white font-medium">On Fire</div>
                <div className="text-xs text-gray-400">7 day streak</div>
              </div>
            )}
          </div>
        </div>
        <BorderBeam size={100} duration={8} className="opacity-20" />
      </MagicCard>

      {/* Recent Activity Preview */}
      <MagicCard className="p-0 rounded-2xl border border-white/10 bg-black">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-bold text-white">Recent Activity</h3>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setActiveTab('activity')}
              className="text-gray-400 hover:text-white"
            >
              View All
            </Button>
          </div>
          
          {!activityFeed ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse bg-white/5 rounded-lg p-3 h-16" />
              ))}
            </div>
          ) : activityFeed.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activityFeed.slice(0, 5).map((activity) => (
                <div key={activity._id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    {activity.type === 'song_vote' && <Star className="h-4 w-4 text-primary" />}
                    {activity.type === 'setlist_created' && <Music className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white">
                      {activity.type === 'song_vote' && `Voted for "${activity.data.songTitle}"`}
                      {activity.type === 'setlist_created' && `Created setlist for ${activity.data.artistName}`}
                    </p>
                    <div className="text-xs text-gray-400">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <BorderBeam size={100} duration={8} className="opacity-20" />
      </MagicCard>
    </div>
  );

  const renderActivity = () => (
    <div className="space-y-6">
      {/* Full Activity Feed */}
      <MagicCard className="p-0 rounded-2xl border border-white/10 bg-black">
        <div className="p-6">
          <h3 className="text-lg font-bold text-white mb-6">All Activity</h3>
          
          {!activityFeed ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-white/5 rounded-lg" />
                </div>
              ))}
            </div>
          ) : activityFeed.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400 mb-4">No activity yet</p>
              <Button onClick={() => navigate('/shows')}>
                Start Voting on Shows
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {activityFeed.map((activity) => (
                <div key={activity._id} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200">
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    {activity.type === 'song_vote' && <Star className="h-5 w-5 text-primary" />}
                    {activity.type === 'setlist_created' && <Music className="h-5 w-5 text-primary" />}
                    {activity.type === 'show_attended' && <Calendar className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-white mb-1">
                          {activity.type === 'song_vote' && `Voted for "${activity.data.songTitle}"`}
                          {activity.type === 'setlist_created' && `Created setlist for ${activity.data.artistName}`}
                          {activity.type === 'show_attended' && `Attended ${activity.data.artistName} show`}
                        </p>
                        <p className="text-sm text-gray-400">
                          {activity.type === 'song_vote' && `${activity.data.artistName} at ${activity.data.venueName}`}
                          {activity.type === 'setlist_created' && `${activity.data.songsCount} songs • ${activity.data.venueName}`}
                          {activity.type === 'show_attended' && `${activity.data.venueName} • ${activity.data.showDate}`}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                        {new Date(activity.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <BorderBeam size={120} duration={10} className="opacity-20" />
      </MagicCard>
    </div>
  );

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 relative z-10">
      {/* Header */}
      <MagicCard className="relative overflow-hidden rounded-2xl p-0 border border-white/10 bg-black">
        <div className="relative z-10 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/profile')}
              className="text-gray-400 hover:text-white"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
          
          <div className="flex items-center gap-4 mt-4">
            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {user.appUser?.name || user.appUser?.username || 'Your Profile'}
              </h1>
              <p className="text-gray-300 text-sm sm:text-base">
                Member since {user.appUser ? new Date(user.appUser.createdAt).toLocaleDateString() : 'Recently'}
              </p>
            </div>
          </div>
        </div>
        <BorderBeam size={150} duration={12} className="opacity-30" />
      </MagicCard>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white/5 rounded-lg p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-white/10">
            <TrendingUp className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-white/10">
            <Activity className="h-4 w-4 mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6">
          {renderOverview()}
        </TabsContent>
        
        <TabsContent value="activity" className="mt-6">
          {renderActivity()}
        </TabsContent>
      </Tabs>
    </div>
  );
}