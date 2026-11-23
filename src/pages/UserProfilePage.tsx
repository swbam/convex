import React, { useState } from 'react';
import { useClerk, UserProfile, SignedIn, SignedOut, RedirectToSignIn, useUser } from '@clerk/clerk-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { MagicCard } from '../components/ui/magic-card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, User, Settings, Activity, Vote, Shield, Star, Music, RefreshCw, Calendar, Loader2 } from 'lucide-react';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { ArtistCard } from '../components/ArtistCard';
import { useTheme } from 'next-themes';
import { PageHeader } from '../components/PageHeader';
import { AppLayout } from '../components/AppLayout';

export function UserProfilePage() {
  const { openUserProfile } = useClerk();
  const { resolvedTheme } = useTheme();
  const accountAppearance = {
    variables: { colorPrimary: resolvedTheme === 'dark' ? '#ffffff' : '#171a1f', colorTextOnPrimaryBackground: resolvedTheme === 'dark' ? '#000000' : '#ffffff', colorText: resolvedTheme === 'dark' ? '#fafafa' : '#111111', colorTextSecondary: resolvedTheme === 'dark' ? '#a1a1aa' : '#596474', colorBackground: resolvedTheme === 'dark' ? '#0a0a0a' : '#ffffff', colorInputBackground: resolvedTheme === 'dark' ? '#171717' : '#ffffff', colorInputText: resolvedTheme === 'dark' ? '#fafafa' : '#111111', borderRadius: '5px', fontFamily: 'Overpass, sans-serif' },
    elements: { rootBox: 'w-full max-w-full min-w-0', card: 'bg-card border border-border shadow-none max-w-full', formButtonPrimary: 'brand-primary rounded-[5px]', formFieldInput: 'border border-input bg-card text-foreground', footerActionLink: 'text-foreground underline', pageScrollBox: 'p-0' }
  };
  const navigate = useNavigate();
  const { user, isSignedIn, isLoaded } = useUser();
  const appUser = useQuery(api.auth.loggedInUser);
  const userVotes = useQuery(api.songVotes.getUserVotes, 
    appUser?.appUser?._id ? { limit: 10 } : 'skip'
  );
  const spotifyArtists = useQuery(api.spotifyAuthQueries.getUserSpotifyArtists, 
    appUser?.appUser?._id ? { limit: 50, onlyWithShows: true } : 'skip'
  );
  const { hasSpotify, isImporting, refreshSpotifyArtists } = useSpotifyAuth();
  const [activeTab, setActiveTab] = useState('general');
  
  // Update default tab when hasSpotify changes
  React.useEffect(() => {
    if (hasSpotify && activeTab === 'general') {
      setActiveTab('spotify');
    }
  }, [hasSpotify]);
  
  // Show loading while Clerk initializes
  if (!isLoaded) {
    return (
      <AppLayout>
        <div className="public-page account-page text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }
  
  // Redirect if not signed in
  if (!isSignedIn) {
    return (
      <AppLayout>
        <Navigate to="/signin?returnTo=%2Fprofile" replace />
      </AppLayout>
    );
  }
  
  const handleArtistClick = (artistId: Id<'artists'>, slug?: string) => {
    navigate(`/artists/${slug || artistId}`);
  };
  
  const renderActivityContent = () => {
    if (!userVotes) {
      return (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-secondary rounded-[5px] p-3 h-12" />
          ))}
        </div>
      );
    }
    
    if (userVotes.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          <Vote className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No votes yet</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-3">
        <div className="text-center mb-4">
          <div className="text-2xl font-bold text-foreground">{userVotes.length}</div>
          <div className="text-xs text-muted-foreground">Recent votes</div>
        </div>
        
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {userVotes.slice(0, 5).map((vote) => (
            <div key={vote._id} className="bg-secondary border border-border rounded-[5px] p-3">
              <div className="flex items-center gap-2">
                <Star className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="text-sm text-foreground truncate">{vote.songTitle}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(vote.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full mt-4"
          onClick={() => navigate('/activity')}
        >
          View recent activity
        </Button>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="public-page account-page space-y-6 relative z-10">
      <PageHeader title="Account settings" description="Manage your profile, connected artists, and recent activity." actions={<Button variant="outline" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Settings */}
        <div className="lg:col-span-2">
          <MagicCard className="p-0 rounded-[5px] border-0 bg-card">
            <div className="p-4 sm:p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList aria-label="Account settings sections" className="flex flex-wrap w-full bg-secondary rounded-[5px] p-1 gap-2 h-auto">
                  <TabsTrigger value="general" className="flex-1 min-w-[100px] justify-center py-2.5">
                    <User className="h-4 w-4 mr-2" />
                    <span className="text-sm">General</span>
                  </TabsTrigger>
                  {hasSpotify && (
                    <TabsTrigger value="spotify" className="flex-1 min-w-[100px] justify-center py-2.5">
                      <Music className="h-4 w-4 mr-2" />
                      <span className="text-sm">My Artists</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="security" className="flex-1 min-w-[100px] justify-center py-2.5">
                    <Shield className="h-4 w-4 mr-2" />
                    <span className="text-sm">Security</span>
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="flex-1 min-w-[100px] justify-center py-2.5 lg:hidden">
                    <Activity className="h-4 w-4 mr-2" />
                    <span className="text-sm">Activity</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">Profile Information</h3>
                    {/* Clerk UserProfile Component for general settings */}
                    <div className="clerk-profile-container">
                      <UserProfile 
                        appearance={{ ...accountAppearance, elements: { ...accountAppearance.elements, navbar: 'hidden', navbarMobileMenuRow: 'hidden' } }}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="security" className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">Security Settings</h3>
                    <div className="clerk-profile-container">
                      <Button variant="outline" onClick={() => { void openUserProfile({ appearance: accountAppearance }); }}>Open account security settings</Button>
                    </div>
                  </div>
                </TabsContent>
                
                {hasSpotify && (
                  <TabsContent value="spotify" className="mt-6 space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-foreground">Your Spotify Artists</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refreshSpotifyArtists()}
                          disabled={isImporting}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${isImporting ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>
                      
                      {isImporting ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                          <p className="text-muted-foreground">Importing your Spotify artists...</p>
                          <p className="text-xs text-muted-foreground mt-2">This may take 30-60 seconds</p>
                        </div>
                      ) : !spotifyArtists || spotifyArtists.length === 0 ? (
                        <div className="text-center py-8">
                          <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <div className="space-y-2">
                            <p className="text-muted-foreground mb-2">No artists with upcoming shows found</p>
                            <p className="text-sm text-muted-foreground">Your Spotify artists will appear here when they have concerts scheduled</p>
                            {!appUser?.appUser?.spotifyId && (
                              <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-4">Your Spotify connection needs refreshing.</p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => refreshSpotifyArtists()}
                            disabled={isImporting}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Import Spotify Artists Now
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-muted-foreground mb-4">
                            Showing {spotifyArtists.length} of your Spotify artists with upcoming concerts
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {spotifyArtists.map(({ artist, isFollowed, isTopArtist, topArtistRank, upcomingShowsCount }) => (
                              <div key={artist._id} className="relative">
                                {isTopArtist && topArtistRank && topArtistRank <= 10 && (
                                  <div className="absolute -top-2 -right-2 z-10 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-bold">
                                    Top {topArtistRank}
                                  </div>
                                )}
                                <ArtistCard
                                  artist={artist}
                                  onClick={handleArtistClick}
                                  showFollowButton={false}
                                />
                                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                  {isFollowed && (
                                    <span className="flex items-center gap-1">
                                      <Star className="h-3 w-3" />
                                      Followed
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {upcomingShowsCount} upcoming {upcomingShowsCount === 1 ? 'show' : 'shows'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                )}
                
                <TabsContent value="activity" className="mt-6 space-y-6 lg:hidden">
                  {/* Mobile activity view */}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">Your Activity</h3>
                    {renderActivityContent()}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </MagicCard>
        </div>

        {/* Activity Sidebar */}
        <div className="space-y-6">
          {/* Voting Activity */}
          <MagicCard className="p-0 rounded-[5px] border-0 bg-card">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-green-500/20 rounded-[5px] flex items-center justify-center">
                  <Activity className="h-4 w-4 text-green-700 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Your Activity</h3>
              </div>

              {renderActivityContent()}
            </div>
          </MagicCard>

          {/* Quick Stats */}
          {appUser?.appUser && (
            <MagicCard className="p-0 rounded-[5px] border-0 bg-card">
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-secondary rounded-[5px] flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Account Info</h3>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Member since</span>
                    <span className="text-foreground">
                      {new Date(appUser.appUser.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      appUser.appUser.role === 'admin' ? 'bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-green-500/20 text-green-700 dark:text-green-400'
                    }`}>
                      {appUser.appUser.role.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </MagicCard>
          )}
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
