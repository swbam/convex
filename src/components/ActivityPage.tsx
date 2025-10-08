import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';
import { Button } from './ui/button';
import { Activity, Calendar, Clock, Music, Star, TrendingUp, Vote, ArrowLeft } from 'lucide-react';
import { FadeIn } from './animations/FadeIn';
import { Loader2 } from 'lucide-react';

interface ActivityPageProps {
  onArtistClick: (artistId: Id<"artists">, slug?: string) => void;
  onShowClick: (showId: Id<"shows">, slug?: string) => void;
}

export function ActivityPage({ onArtistClick, onShowClick }: ActivityPageProps) {
  const navigate = useNavigate();
  const user = useQuery(api.auth.loggedInUser);
  const userId = user?.appUser?._id;

  // Polling for updates
  const [usePolling, setUsePolling] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setUsePolling(true);
    }, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const activityFeed = useQuery(
    api.activity.getUserActivityFeed, 
    usePolling ? { limit: 50 } : "skip"
  ) || [];

  // Enhanced stats: accuracy and recent predictions - unconditional calls with skip
  const activityStats = useQuery(api.activity.getUserActivityStats);
  const voteAccuracy = useQuery(api.activity.getVoteAccuracy, userId ? { userId } : "skip");
  const recentPredictions = useQuery(api.activity.getRecentPredictions, userId ? { userId, limit: 5 } : "skip");

  const [filter, setFilter] = useState<'all' | 'recent'>('all');

  // Group by date with dividers
  const groupedActivity = useMemo(() => {
    if (!activityFeed.length) return {};
    const groups: Record<string, any[]> = {};
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    const filtered = filter === 'recent' 
      ? activityFeed.filter((a: any) => a.createdAt > oneWeekAgo) 
      : activityFeed;

    filtered.forEach((activity: any) => {
      const date = new Date(activity.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      if (!groups[date]) groups[date] = [];
      groups[date].push(activity);
    });

    return groups;
  }, [activityFeed, filter]);

  const totalVotes = activityFeed.filter((a: any) => a.type === 'song_vote').length || 0;
  
  // FIXED: Add null/undefined checks for voteAccuracy with fallback to activityStats
  const accuracy = voteAccuracy !== null && voteAccuracy !== undefined 
    ? `${Math.round(voteAccuracy * 100)}%` 
    : activityStats?.accuracy 
    ? `${activityStats.accuracy}%` 
    : 'N/A';

  // CRITICAL FIX: Proper user state detection
  // user === undefined means still loading from Convex
  // user === null means definitely not signed in
  // user === {identity: {...}, appUser?: {...}} means signed in
  
  if (user === undefined) {
    // Still loading user data from Convex
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-gray-400">Loading your activity...</p>
      </div>
    );
  }

  if (user === null || !userId) {
    // User is definitely not signed in (Convex returned null, not an object)
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-400">Please sign in to view your activity</p>
        <Button onClick={() => void navigate('/signin')} className="mt-4">
          Sign In
        </Button>
      </div>
    );
  }

  // At this point, user is an object with at least {identity: ...}
  // User IS signed in (even if appUser hasn't been created yet)

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 relative z-10">
      {/* Header */}
      <FadeIn delay={0} duration={0.5}>
      <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0 bg-black border-t border-b border-white/5">
      <div className="relative z-10 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => void navigate('/')}
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
        <MagicCard className="p-0 rounded-xl border-0 bg-black border-t border-b border-white/5">
          <div className="p-4 sm:p-6 text-center">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Vote className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{activityStats?.totalVotes || 0}</div>
            <div className="text-sm text-gray-400">Total Votes</div>
          </div>
          <BorderBeam size={80} duration={8} className="opacity-20" />
        </MagicCard>

        <MagicCard className="p-0 rounded-xl border-0 bg-black border-t border-b border-white/5">
          <div className="p-4 sm:p-6 text-center">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Music className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{activityStats?.totalSetlists || 0}</div>
            <div className="text-sm text-gray-400">Setlists Created</div>
          </div>
          <BorderBeam size={80} duration={8} className="opacity-20" />
        </MagicCard>

        <MagicCard className="p-0 rounded-xl border-0 bg-black border-t border-b border-white/5">
          <div className="p-4 sm:p-6 text-center">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="h-5 w-5 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{activityStats?.accuracy || 0}%</div>
            <div className="text-sm text-gray-400">Accuracy</div>
          </div>
          <BorderBeam size={80} duration={8} className="opacity-20" />
        </MagicCard>

        <MagicCard className="p-0 rounded-xl border-0 bg-black border-t border-b border-white/5">
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
      <MagicCard className="p-0 rounded-2xl border-0 bg-black border-t border-b border-white/5">
        <div className="p-4 sm:p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            Voting History
          </h2>

          {activityFeed.length === 0 ? (
            // Loading/Empty state
            <div className="space-y-0">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="animate-pulse py-4 border-b border-white/5">
                  <div className="h-12 bg-white/5 rounded" />
                </div>
              ))}
              {activityFeed.length === 0 && (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                  <p className="text-gray-400 mb-4">No activity yet</p>
                  <Button onClick={() => void navigate('/shows')}>
                    Start Voting on Shows
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // Activity list - Clean Apple Music style
            <div className="space-y-0">
              {Object.entries(groupedActivity).map(([date, items]) => (
                <div key={date}>
                  <div className="sticky top-0 bg-black/80 backdrop-blur-sm z-10 py-3 px-4 border-b border-white/5">
                    <h3 className="text-sm font-medium text-gray-300">{date}</h3>
                  </div>
                  {items.map((activity: any) => (
                    <div key={activity._id} className="py-4 px-4 border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          {activity.type === 'song_vote' && <Vote className="h-4 w-4 text-primary" />}
                          {activity.type === 'setlist_created' && <Music className="h-4 w-4 text-green-400" />}
                          {activity.type === 'prediction_made' && <TrendingUp className="h-4 w-4 text-blue-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm">{activity.description}</p>
                          <p className="text-gray-400 text-xs mt-1">
                            {new Date(activity.createdAt).toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: 'numeric', 
                              minute: '2-digit' 
                            })}
                          </p>
                          {activity.data?.show && (
                            <p className="text-xs text-gray-500 mt-1">
                              {activity.data.show.artist.name} • {activity.data.show.venue.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <BorderBeam size={120} duration={10} className="opacity-20" />
      </MagicCard>
      </FadeIn>

      {/* Recent Predictions */}
      <FadeIn delay={0.8} duration={0.5}>
        <MagicCard className="p-0 rounded-2xl border-0 bg-black border-t border-b border-white/5">
          <div className="p-4 sm:p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400" />
              Recent Predictions
            </h2>
            <div className="space-y-4">
              {recentPredictions === undefined ? (
                // Loading state
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-white/5 rounded-lg p-4 h-16" />
                  ))}
                </div>
              ) : recentPredictions && recentPredictions.length > 0 ? (
                // Has predictions
                recentPredictions.map((pred: any) => (
                  <div key={pred._id} className="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    <p className="text-white font-medium">
                      {pred.show?.artist?.name || 'Unknown Artist'} - {Array.isArray(pred.predictedSongs) ? pred.predictedSongs.join(', ') : 'No songs'}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(pred.createdAt).toLocaleDateString()} {new Date(pred.createdAt).toLocaleTimeString()}</p>
                  </div>
                ))
              ) : (
                // Empty state with better CTA
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Star className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-white font-medium mb-2">No Predictions Yet</p>
                  <p className="text-gray-400 text-sm mb-4">Start predicting setlists to see them here</p>
                  <Button onClick={() => void navigate('/shows')} className="bg-primary/20 hover:bg-primary/30">
                    Browse Upcoming Shows
                  </Button>
                </div>
              )}
            </div>
          </div>
          <BorderBeam size={120} duration={10} className="opacity-20" />
        </MagicCard>
      </FadeIn>
    </div>
  );
}
