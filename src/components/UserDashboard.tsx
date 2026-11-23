import React from 'react'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { MagicCard } from './ui/magic-card'
import { PageHeader } from './PageHeader'
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
  const activityStats = useQuery(api.activity.getUserActivityStats, {});
  const voteAccuracy = useQuery(api.activity.getVoteAccuracy, appUser?.appUser?._id ? { userId: appUser.appUser._id } : "skip");
  
  const hasSpotify = React.useMemo(() => {
    if (appUser?.appUser?.spotifyId) return true;
    if (user?.externalAccounts) {
      return user.externalAccounts.some((account) => ['spotify', 'oauth_spotify'].includes(account.provider));
    }
    return false;
  }, [appUser?.appUser?.spotifyId, user?.externalAccounts]);

  if (appUser === undefined) {
    // Loading skeleton that matches the final layout to prevent shift
    return (
      <div className="public-page account-page space-y-6">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-8 w-64 bg-secondary rounded-[5px] animate-pulse mb-2" />
          <div className="h-4 w-48 bg-secondary/50 rounded animate-pulse" />
        </div>
        
        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 rounded-[5px] bg-card/50 border border-border">
              <div className="h-8 w-12 bg-secondary rounded animate-pulse mx-auto mb-2" />
              <div className="h-3 w-16 bg-secondary/50 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>
        
        {/* Content skeleton */}
        <div className="p-6 rounded-[5px] bg-card/50 border border-border">
          <div className="h-6 w-48 bg-secondary rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-[5px] bg-secondary/30">
                <div className="w-10 h-10 bg-secondary rounded-full animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-secondary rounded animate-pulse mb-1" />
                  <div className="h-3 w-24 bg-secondary/50 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If Clerk user is not present, show sign-in prompt.
  // If Clerk user exists but Convex app user is missing, show a setup state instead
  // (AuthGuard is responsible for creating the Convex user record).
  if (!user) {
    return (
      <div className="public-page account-page text-center">
        <div className="w-16 h-16 bg-secondary rounded-[5px] flex items-center justify-center mx-auto mb-4">
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
      <div className="public-page account-page text-center">
        <div className="w-16 h-16 bg-secondary rounded-[5px] flex items-center justify-center mx-auto mb-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Finishing account setup…</h1>
        <p className="text-muted-foreground mb-4 max-w-md mx-auto">
          We’re preparing your account so you can save song requests and track your activity.
        </p>
        <p className="text-xs text-muted-foreground">
          If this message doesn’t go away after a few seconds, try refreshing the page.
        </p>
      </div>
    );
  }

  const showsVotedOn = userVotes ? new Set(userVotes.map(v => v.setlistId)).size : 0;
  const accuracy = voteAccuracy != null ? `${Math.round(voteAccuracy * 100)}%` : '—';
  const hasVotes = (userVotes || []).length > 0;

  return (
    <div className="public-page account-page space-y-6">
      {/* Compact Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <PageHeader title={user?.firstName ? `Welcome back, ${user.firstName}` : 'Your dashboard'} description="Your song requests, shows, and recent activity." actions={<Button variant="outline" onClick={() => void navigate('/profile')}>Account settings</Button>} />

        {/* Compact Stats */}
        <div className="grid grid-cols-3 gap-3">
          <MagicCard className="p-0 rounded-[5px] border-0 bg-card/50">
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{activityStats?.totalVotes ?? "—"}{activityStats?.historyLimited ? "+" : ""}</div>
              <div className="text-xs text-muted-foreground">Total Votes</div>
            </div>
          </MagicCard>
          
          <MagicCard className="p-0 rounded-[5px] border-0 bg-card/50">
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{userVotes === undefined ? "—" : showsVotedOn}</div>
              <div className="text-xs text-muted-foreground">Shows in recent votes</div>
            </div>
          </MagicCard>
          
          <MagicCard className="p-0 rounded-[5px] border-0 bg-card/50">
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{accuracy}</div>
              <div className="text-xs text-muted-foreground">Accuracy{activityStats?.historyLimited ? " · recent 500 votes" : ""}</div>
            </div>
          </MagicCard>
        </div>
      </motion.div>

      {/* Spotify Section - Only show if NOT connected */}
      {!hasSpotify && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <MagicCard className="p-0 rounded-[5px] border-0 bg-card">
            <div className="p-4 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-12 h-12 bg-secondary rounded-[5px] flex items-center justify-center">
                  <Music className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Connect Spotify</h3>
                  <p className="text-sm text-muted-foreground">Discover personalized shows based on your listening</p>
                </div>
              </div>
              <Button onClick={() => void navigate('/spotify-connect?returnTo=/dashboard')} className="brand-primary w-full shrink-0 sm:w-auto">
                Connect Now
              </Button>
            </div>
          </MagicCard>
        </motion.div>
      )}

      {/* My Spotify Artists - If connected */}
      {hasSpotify && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
        >
          <MySpotifyArtists onArtistClick={onArtistClick} />
        </motion.div>
      )}

      {/* Your Recent Votes - Compact Card Style */}
      {hasVotes && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
        >
          <MagicCard className="p-0 rounded-[5px] border-0 bg-card/50">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-secondary rounded-[5px] flex items-center justify-center">
                  <ChevronUp className="h-5 w-5 text-foreground" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Your Recent Votes</h2>
              </div>

              <div className="space-y-2">
                {userVotes?.slice(0, 10).map((vote) => (
                  <div
                    key={vote._id}
                    className="flex items-center justify-between p-3 rounded-[5px] bg-secondary hover:bg-secondary transition-colors border border-border"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 bg-secondary rounded-[5px] flex items-center justify-center flex-shrink-0">
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
                    View recent activity
                  </Button>
                </div>
              )}
            </div>
          </MagicCard>
        </motion.div>
      )}

      {userVotes === undefined && <div role="status" className="content-card p-4 text-sm text-muted-foreground">Loading your recent votes…</div>}
      {/* Empty State */}
      {userVotes !== undefined && !hasVotes && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
        >
          <MagicCard className="p-0 rounded-[5px] border-0 bg-card/50">
            <div className="p-4 sm:p-6 text-center">
              <div className="w-16 h-16 bg-secondary rounded-[5px] flex items-center justify-center mx-auto mb-4">
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
          </MagicCard>
        </motion.div>
      )}
      <section className="content-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><h2 className="text-lg font-semibold">For artists and teams</h2><p className="mt-1 text-sm text-muted-foreground">Claim your artist page to see fan requests for each show.</p></div>
        <Button variant="outline" onClick={() => void navigate('/for-artists')}>Open artist portal</Button>
      </section>
    </div>
  );
}
