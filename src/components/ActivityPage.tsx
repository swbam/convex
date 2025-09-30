import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';
import { Button } from './ui/button';
import { Activity, Calendar, Clock, Music, Star, TrendingUp, Vote, ArrowLeft } from 'lucide-react';
import { FadeIn, StaggerChildren, StaggerItem } from './animations/FadeIn';

interface ActivityPageProps {
  onArtistClick: (artistId: Id<"artists">, slug?: string) => void;
  onShowClick: (showId: Id<"shows">, slug?: string) => void;
}

export function ActivityPage({ onArtistClick, onShowClick }: ActivityPageProps) {
  const navigate = useNavigate();
  const userVotes = useQuery(api.songVotes.getUserVotes, { limit: 100 });
  const user = useQuery(api.auth.loggedInUser);
  const activityFeed = useQuery(api.activity.getUserActivityFeed, { limit: 50 });
  const activityStats = useQuery(api.activity.getUserActivityStats);
  const [filter, setFilter] = useState<'all' | 'recent'>('all');

  // Group votes by date
  const groupedVotes = React.useMemo(() => {
    if (!userVotes) return {};
    
    const groups: Record<string, typeof userVotes> = {};
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const filteredVotes = filter === 'recent' 
      ? userVotes.filter(v => v.createdAt > oneWeekAgo)
      : userVotes;
    
    filteredVotes.forEach(vote => {
      const date = new Date(vote.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(vote);
    });
    
    return groups;
  }, [userVotes, filter]);

  const totalVotes = userVotes?.length || 0;
  const uniqueSetlists = userVotes ? new Set(userVotes.map(v => v.setlistId)).size : 0;
  const recentVotes = userVotes?.filter(v => 
    v.createdAt > Date.now() - (7 * 24 * 60 * 60 * 1000)
  ).length || 0;

  // CRITICAL FIX: Check if user is loading vs actually not signed in
  if (user === undefined) {
    // Still loading user data from Convex
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-gray-400">Loading your activity...</p>
      </div>
    );
  }

  if (user === null || !user.identity) {
    // User is definitely not signed in
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-400">Please sign in to view your activity</p>
        <Button onClick={() => navigate('/signin')} className="mt-4">
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 relative z-10">
      {/* Header */}
      <FadeIn delay={0} duration={0.5}>
        <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0 bg-black" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Your Activity</h1>
              <p className="text-gray-300 text-sm sm:text-base">Track your voting history and engagement</p>
            </div>
          </div>
        </div>
        <BorderBeam size={150} duration={12} className="opacity-30" />
      </MagicCard>
      </FadeIn>

      {/* Stats Cards - Consistent with Admin Page */}
      <FadeIn delay={0.2} duration={0.5}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MagicCard className="p-0 rounded-xl border-0 bg-black" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
          <div className="p-4 sm:p-6 text-center">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Vote className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{activityStats?.totalVotes || 0}</div>
            <div className="text-sm text-gray-400">Total Votes</div>
          </div>
          <BorderBeam size={80} duration={8} className="opacity-20" />
        </MagicCard>

        <MagicCard className="p-0 rounded-xl border-0 bg-black" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
          <div className="p-4 sm:p-6 text-center">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Music className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{activityStats?.totalSetlists || 0}</div>
            <div className="text-sm text-gray-400">Setlists Created</div>
          </div>
          <BorderBeam size={80} duration={8} className="opacity-20" />
        </MagicCard>

        <MagicCard className="p-0 rounded-xl border-0 bg-black" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
          <div className="p-4 sm:p-6 text-center">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="h-5 w-5 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{activityStats?.accuracy || 0}%</div>
            <div className="text-sm text-gray-400">Accuracy</div>
          </div>
          <BorderBeam size={80} duration={8} className="opacity-20" />
        </MagicCard>

        <MagicCard className="p-0 rounded-xl border-0 bg-black" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
          <div className="p-4 sm:p-6 text-center">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Star className="h-5 w-5 text-orange-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{activityStats?.streak || 0}</div>
            <div className="text-sm text-gray-400">Day Streak</div>
          </div>
          <BorderBeam size={80} duration={8} className="opacity-20" />
        </MagicCard>
        </div>
      </FadeIn>

      {/* Filter Tabs */}
      <FadeIn delay={0.4} duration={0.5}>
      <div className="flex gap-2 p-1 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${
            filter === 'all'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          All Activity
        </button>
        <button
          onClick={() => setFilter('recent')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${
            filter === 'recent'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Past Week
        </button>
      </div>
      </FadeIn>

      {/* Activity List - Apple Music Style */}
      <FadeIn delay={0.6} duration={0.5}>
      <MagicCard className="p-0 rounded-2xl border-0 bg-black" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
        <div className="p-4 sm:p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            Voting History
          </h2>

          {!activityFeed ? (
            // Loading state
            <div className="space-y-0">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="animate-pulse py-4" style={{borderBottom: '1px solid rgba(255, 255, 255, 0.05)'}}>
                  <div className="h-12 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : activityFeed.length === 0 ? (
            // Empty state
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400 mb-4">No activity yet</p>
              <Button onClick={() => navigate('/shows')}>
                Start Voting on Shows
              </Button>
            </div>
          ) : (
            // Activity list - Clean Apple Music style
            <div className="space-y-0">
              {activityFeed.map((activity, idx) => (
                <div 
                  key={activity._id} 
                  className="flex items-start gap-4 py-4 hover:bg-white/5 transition-all duration-200"
                  style={{borderBottom: idx < activityFeed.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none'}}
                >
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    {activity.type === 'song_vote' && <Star className="h-5 w-5 text-primary" />}
                    {activity.type === 'setlist_created' && <Music className="h-5 w-5 text-primary" />}
                    {activity.type === 'show_attended' && <Calendar className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm mb-1 truncate">
                      {activity.type === 'song_vote' && `Voted for "${activity.data.songTitle}"`}
                      {activity.type === 'setlist_created' && `Created setlist for ${activity.data.artistName}`}
                      {activity.type === 'show_attended' && `Attended ${activity.data.artistName} show`}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {activity.type === 'song_vote' && `${activity.data.artistName} at ${activity.data.venueName}`}
                      {activity.type === 'setlist_created' && `${activity.data.songsCount} songs • ${activity.data.venueName}`}
                      {activity.type === 'show_attended' && `${activity.data.venueName} • ${activity.data.showDate}`}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                    {new Date(activity.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <BorderBeam size={120} duration={10} className="opacity-20" />
      </MagicCard>
      </FadeIn>
    </div>
  );
}