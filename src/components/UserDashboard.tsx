import React from 'react'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { MagicCard } from './ui/magic-card'
import { BorderBeam } from './ui/border-beam'
import { Button } from './ui/button'
import { MySpotifyArtists } from './MySpotifyArtists'
import { User, Music, TrendingUp, ChevronUp } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface UserDashboardProps {
  onArtistClick: (artistId: Id<"artists">) => void;
  onShowClick: (showId: Id<"shows">, slug?: string) => void;
}

export function UserDashboard({ onArtistClick, onShowClick }: UserDashboardProps) {
  const navigate = useNavigate();
  const { user } = useUser();
  const appUser = useQuery(api.auth.loggedInUser);
  const userVotes = useQuery(api.songVotes.getUserVotes, appUser?.appUser?._id ? { limit: 20 } : "skip");
  const voteAccuracy = useQuery(api.activity.getVoteAccuracy, appUser?.appUser?._id ? { userId: appUser.appUser._id } : "skip");
  
  if (appUser === undefined) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  // If Clerk user is not present, show sign-in prompt.
  // If Clerk user exists but Convex app user is missing, show a setup state instead
  // (AuthGuard is responsible for creating the Convex user record).
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <User className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to setlists.live</h1>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">Sign in to track your votes, predictions, and setlist activity</p>
        <Button onClick={() => void navigate('/signin')} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          Get Started
        </Button>
      </div>
    );
  }

  if (appUser === null) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Finishing account setup…</h1>
        <p className="text-muted-foreground mb-4 max-w-md mx-auto">
          You’re signed in with Clerk. We’re linking your account to Convex so you can vote and track activity.
        </p>
        <p className="text-xs text-muted-foreground">
          If this message doesn’t go away after a few seconds, try refreshing the page.
        </p>
      </div>
    );
  }

  const showsVotedOn = userVotes ? new Set(userVotes.map(v => v.setlistId)).size : 0;
  const accuracy = voteAccuracy ? `${Math.round(voteAccuracy * 100)}%` : 'N/A';
  const hasSpotify = React.useMemo(() => {
    if (appUser?.appUser?.spotifyId) return true;
    if (user?.externalAccounts) {
      return user.externalAccounts.some((account) => account.provider === 'oauth_spotify');
    }
    return false;
  }, [appUser?.appUser?.spotifyId, user?.externalAccounts]);
  const hasVotes = (userVotes || []).length > 0;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6">
      {/* Compact Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back, {user?.firstName || 'User'}!
            </h1>
            <p className="text-muted-foreground">Your setlist predictions and activity</p>
          </div>
        </div>

        {/* Compact Stats */}
        <div className="grid grid-cols-3 gap-3">
          <MagicCard className="p-0 rounded-xl border-0 bg-card/50">
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{userVotes?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Total Votes</div>
            </div>
          </MagicCard>
          
          <MagicCard className="p-0 rounded-xl border-0 bg-card/50">
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{showsVotedOn}</div>
              <div className="text-xs text-muted-foreground">Shows Voted On</div>
            </div>
          </MagicCard>
          
          <MagicCard className="p-0 rounded-xl border-0 bg-card/50">
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{accuracy}</div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
          </MagicCard>
        </div>
      </motion.div>

      {/* Spotify Section - Only show if NOT connected */}
      {!hasSpotify && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <MagicCard className="p-0 rounded-xl border-0 bg-gradient-to-br from-green-500/10 to-green-500/5">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Music className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Connect Spotify</h3>
                  <p className="text-sm text-muted-foreground">Discover personalized shows based on your listening</p>
                </div>
              </div>
              <Button onClick={() => void navigate('/spotify-connect')} className="bg-green-500 hover:bg-green-600 text-foreground">
                Connect Now
              </Button>
            </div>
            <BorderBeam size={100} duration={10} className="opacity-20" />
          </MagicCard>
        </motion.div>
      )}

      {/* My Spotify Artists - If connected */}
      {hasSpotify && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <MySpotifyArtists onArtistClick={onArtistClick} />
        </motion.div>
      )}

      {/* Your Recent Votes - Compact Card Style */}
      {hasVotes && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <MagicCard className="p-0 rounded-xl border-0 bg-card/50">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                  <ChevronUp className="h-5 w-5 text-foreground" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Your Recent Votes</h2>
              </div>

              <div className="space-y-2">
                {userVotes?.slice(0, 10).map((vote) => (
                  <div
                    key={vote._id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-secondary transition-colors border border-border"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Music className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{vote.songTitle}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(vote.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-primary">
                      <ChevronUp className="h-4 w-4 fill-current" />
                      <span className="text-sm font-semibold">+1</span>
                    </div>
                  </div>
                ))}
              </div>

              {userVotes && userVotes.length > 10 && (
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={() => void navigate('/activity')}>
                    View All Votes
                  </Button>
                </div>
              )}
            </div>
            <BorderBeam size={120} duration={12} className="opacity-20" />
          </MagicCard>
        </motion.div>
      )}

      {/* Empty State */}
      {!hasVotes && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <MagicCard className="p-0 rounded-xl border-0 bg-card/50">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Start Voting!</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Vote on upcoming show setlists to see your predictions here
              </p>
              <Button onClick={() => void navigate('/shows')} className="bg-primary hover:bg-primary/90">
                Browse Upcoming Shows
              </Button>
            </div>
            <BorderBeam size={120} duration={12} className="opacity-20" />
          </MagicCard>
        </motion.div>
      )}
    </div>
  );
}
