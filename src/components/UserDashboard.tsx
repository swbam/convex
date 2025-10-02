import React from 'react'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { MagicCard } from './ui/magic-card'
import { BorderBeam } from './ui/border-beam'
import { Button } from './ui/button'
import { UserPredictions } from './UserPredictions'
import { MySpotifyArtists } from './MySpotifyArtists'
import { User, Settings, Activity, Calendar, Music, TrendingUp, ArrowLeft } from 'lucide-react'
import { FadeIn } from './animations/FadeIn'
import { Loader2 } from 'lucide-react'

interface UserDashboardProps {
  onArtistClick: (artistId: Id<"artists">) => void;
  onShowClick: (showId: Id<"shows">) => void;
}

export function UserDashboard({ onArtistClick, onShowClick }: UserDashboardProps) {
  const navigate = useNavigate();
  const { user } = useUser();
  const appUser = useQuery(api.auth.loggedInUser);
  const userVotes = useQuery(api.songVotes.getUserVotes, { limit: 5 });
  const voteAccuracy = useQuery(api.activity.getVoteAccuracy, appUser?.appUser?._id ? { userId: appUser.appUser._id } : "skip");

  // CRITICAL FIX: Proper user state detection
  // appUser === undefined means still loading from Convex
  // appUser === null means definitely not signed in
  // appUser === {identity: {...}, appUser?: {...}} means signed in
  
  if (appUser === undefined) {
    // Still loading user data from Convex
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-gray-400">Loading your dashboard...</p>
      </div>
    );
  }

  if (appUser === null || !user) {
    // User is definitely not signed in (Convex returned null, not an object)
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <User className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Welcome to SetlistVote</h1>
        <p className="text-gray-400 mb-6 max-w-md mx-auto">Sign in to track your votes, predictions, and setlist activity</p>
        <Button onClick={() => void navigate('/signin')} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          Get Started
        </Button>
      </div>
    );
  }

  // At this point, user is an object with at least {identity: ...}
  // User IS signed in (even if appUser hasn't been created yet)

  const daysActive = appUser?.appUser ? Math.floor((Date.now() - appUser.appUser.createdAt) / (1000 * 60 * 60 * 24)) : 0;
  const showsVotedOn = userVotes ? new Set(userVotes.map(v => v.setlistId)).size : 0;
  const accuracy = voteAccuracy ? `${Math.round(voteAccuracy * 100)}%` : 'N/A';

  // Edge case: No votes or predictions
  const hasVotes = (userVotes || []).length > 0;
  const hasSpotify = appUser?.appUser?.spotifyId;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 relative z-10">
      {/* Header */}
      <FadeIn delay={0} duration={0.6}>
      <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0 bg-black border-t border-b border-white/5">
        <div className="relative z-10 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  Welcome back, {user?.firstName || 'User'}!
                </h1>
                <p className="text-gray-300 text-sm sm:text-base">
                  Track your votes and setlist activity
                </p>
              </div>
            </div>
            
            <Button variant="outline" onClick={() => void navigate('/activity')}>
              <Settings className="h-4 w-4 mr-2" />
              View Activity
            </Button>
          </div>
        </div>
        <BorderBeam size={150} duration={12} className="opacity-30" />
      </MagicCard>
      </FadeIn>

      {/* Quick Stats */}
      <FadeIn delay={0.1} duration={0.6}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MagicCard className="p-0 rounded-xl border-0 bg-black border-t border-b border-white/5">
          <div className="p-4 text-center">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Activity className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">{userVotes?.length || 0}</div>
            <div className="text-xs text-gray-400">Total Votes</div>
          </div>
          <BorderBeam size={60} duration={8} className="opacity-20" />
        </MagicCard>
        
        <MagicCard className="p-0 rounded-xl border-0 bg-black border-t border-b border-white/5">
          <div className="p-4 text-center">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Music className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {showsVotedOn}
            </div>
            <div className="text-xs text-gray-400">Shows Voted On</div>
          </div>
          <BorderBeam size={60} duration={8} className="opacity-20" />
        </MagicCard>
        
        <MagicCard className="p-0 rounded-xl border-0 bg-black border-t border-b border-white/5">
          <div className="p-4 text-center">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {accuracy}
            </div>
            <div className="text-xs text-gray-400">Prediction Accuracy</div>
          </div>
          <BorderBeam size={60} duration={8} className="opacity-20" />
        </MagicCard>
      </div>
      </FadeIn>

      {/* Days Active Card - Edge Case for New Users */}
      {!hasVotes && (
        <FadeIn delay={0.15} duration={0.6}>
          <MagicCard className="p-0 rounded-xl border-0 bg-black border-t border-b border-white/5">
            <div className="p-4 text-center">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Calendar className="h-4 w-4 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-white">{daysActive}</div>
              <div className="text-xs text-gray-400">Days Active</div>
              <p className="text-sm text-gray-300 mt-2">Get started by voting on upcoming shows!</p>
              <Button onClick={() => void navigate('/shows')} variant="outline" className="mt-3">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Browse Shows
              </Button>
            </div>
            <BorderBeam size={60} duration={8} className="opacity-20" />
          </MagicCard>
        </FadeIn>
      )}

      {/* ENHANCED: My Spotify Artists Section */}
      {hasSpotify ? (
        <FadeIn delay={0.2} duration={0.6}>
          <MySpotifyArtists onArtistClick={onArtistClick} />
        </FadeIn>
      ) : (
        <FadeIn delay={0.2} duration={0.6}>
          <MagicCard className="p-0 rounded-xl border-0 bg-black border-t border-b border-white/5">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Music className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Connect Spotify</h3>
              <p className="text-gray-300 mb-4">Link your Spotify to discover personalized shows and artists</p>
              <Button onClick={() => void navigate('/spotify-connect')} variant="outline">
                Connect Spotify
              </Button>
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>
        </FadeIn>
      )}

      {/* User Activity Dashboard */}
      <FadeIn delay={0.3} duration={0.6}>
        {hasVotes ? (
          <UserPredictions />
        ) : (
          <MagicCard className="p-0 rounded-xl border-0 bg-black border-t border-b border-white/5">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No Predictions Yet</h3>
              <p className="text-gray-300 mb-4">Start voting on shows to see your prediction history and accuracy</p>
              <Button onClick={() => void navigate('/shows')} className="bg-primary hover:bg-primary/90">
                Start Predicting
              </Button>
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>
        )}
      </FadeIn>
    </div>
  );
}