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
import { User, Settings, Activity, Calendar, Music, TrendingUp } from 'lucide-react'
import { FadeIn } from './animations/FadeIn'

interface UserDashboardProps {
  onArtistClick: (artistId: Id<"artists">) => void;
  onShowClick: (showId: Id<"shows">) => void;
}

export function UserDashboard({ onArtistClick, onShowClick }: UserDashboardProps) {
  const navigate = useNavigate();
  const { user } = useUser();
  const appUser = useQuery(api.auth.loggedInUser);
  const userVotes = useQuery(api.songVotes.getUserVotes, { limit: 5 });

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 relative z-10">
      {/* Header */}
      <FadeIn delay={0} duration={0.6}>
      <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0 bg-black">
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
            
            <Button variant="outline" onClick={() => navigate('/activity')}>
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
        <MagicCard className="p-0 rounded-xl border-0 bg-black">
          <div className="p-4 text-center">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Activity className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">{userVotes?.length || 0}</div>
            <div className="text-xs text-gray-400">Total Votes</div>
          </div>
          <BorderBeam size={60} duration={8} className="opacity-20" />
        </MagicCard>
        
        <MagicCard className="p-0 rounded-xl border-0 bg-black">
          <div className="p-4 text-center">
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Music className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {userVotes ? new Set(userVotes.map(v => v.setlistId)).size : 0}
            </div>
            <div className="text-xs text-gray-400">Shows Voted On</div>
          </div>
          <BorderBeam size={60} duration={8} className="opacity-20" />
        </MagicCard>
        
        <MagicCard className="p-0 rounded-xl border-0 bg-black">
          <div className="p-4 text-center">
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Calendar className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {appUser?.appUser ? Math.floor((Date.now() - appUser.appUser.createdAt) / (1000 * 60 * 60 * 24)) : 0}
            </div>
            <div className="text-xs text-gray-400">Days Active</div>
          </div>
          <BorderBeam size={60} duration={8} className="opacity-20" />
        </MagicCard>
      </div>
      </FadeIn>

      {/* ENHANCED: My Spotify Artists Section */}
      {appUser?.appUser?.spotifyId && (
        <FadeIn delay={0.2} duration={0.6}>
          <MySpotifyArtists onArtistClick={onArtistClick} />
        </FadeIn>
      )}

      {/* User Activity Dashboard */}
      <FadeIn delay={0.3} duration={0.6}>
        <UserPredictions />
      </FadeIn>
    </div>
  );
}