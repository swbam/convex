import React, { useState } from 'react';
import { UserProfile, SignedIn, SignedOut, RedirectToSignIn, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { MagicCard } from '../components/ui/magic-card';
import { BorderBeam } from '../components/ui/border-beam';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, User, Settings, Activity, Vote, Shield, Star, Music, RefreshCw, Calendar, Loader2 } from 'lucide-react';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { ArtistCard } from '../components/ArtistCard';
import { AppLayout } from '../components/AppLayout';

export function UserProfilePage() {
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
        <div className="container mx-auto px-4 py-8 text-center">
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
        <RedirectToSignIn signInUrl="/signin" />
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
            <div key={i} className="animate-pulse bg-secondary rounded-lg p-3 h-12" />
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
          <div className="text-xs text-muted-foreground">Total Votes</div>
        </div>
        
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {userVotes.slice(0, 5).map((vote) => (
            <div key={vote._id} className="bg-secondary border border-border rounded-lg p-3">
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
          View All Activity
        </Button>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 relative z-10">
      {/* Header */}
      <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0 bg-card">
        <div className="relative z-10 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-4">
            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Manage your account preferences and view activity</p>
            </div>
          </div>
        </div>
        <BorderBeam size={150} duration={12} className="opacity-30" />
      </MagicCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Settings */}
        <div className="lg:col-span-2">
          <MagicCard className="p-0 rounded-2xl border-0 bg-card">
            <div className="p-4 sm:p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex flex-wrap w-full bg-secondary rounded-lg p-1 gap-2 h-auto">
                  <TabsTrigger value="general" className="flex-1 min-w-[100px] justify-center data-[state=active]:bg-secondary py-2.5">
                    <User className="h-4 w-4 mr-2" />
                    <span className="text-sm">General</span>
                  </TabsTrigger>
                  {hasSpotify && (
                    <TabsTrigger value="spotify" className="flex-1 min-w-[100px] justify-center data-[state=active]:bg-secondary py-2.5">
                      <Music className="h-4 w-4 mr-2" />
                      <span className="text-sm">My Artists</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="security" className="flex-1 min-w-[100px] justify-center data-[state=active]:bg-secondary py-2.5">
                    <Shield className="h-4 w-4 mr-2" />
                    <span className="text-sm">Security</span>
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="flex-1 min-w-[100px] justify-center data-[state=active]:bg-secondary py-2.5 lg:hidden">
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
                        appearance={{
                          baseTheme: 'dark',
                          variables: {
                            colorPrimary: '#6366f1',
                            colorText: '#ffffff',
                            colorTextSecondary: '#a1a1aa',
                            colorBackground: '#000000',
                            colorInputBackground: 'rgba(255, 255, 255, 0.05)',
                            colorInputText: '#ffffff',
                          },
                          elements: {
                            rootBox: 'w-full',
                            card: 'bg-card border border-border shadow-none',
                            headerTitle: 'text-foreground',
                            headerSubtitle: 'text-muted-foreground',
                            socialButtonsBlockButton: 'border-border text-foreground hover:bg-secondary',
                            formButtonPrimary: 'bg-primary hover:bg-primary/90',
                            footerActionLink: 'text-primary hover:text-primary/80',
                            navbar: 'hidden',
                            navbarMobileMenuRow: 'hidden',
                            pageScrollBox: 'p-0',
                          }
                        }}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="security" className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">Security Settings</h3>
                    <div className="clerk-profile-container">
                      <UserProfile.Page path="security" />
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
                      
                      {/* Debug info */}
                      {console.log('Spotify Artists Data:', { 
                        hasSpotify, 
                        isImporting, 
                        spotifyArtistsCount: spotifyArtists?.length || 0,
                        appUserSpotifyId: appUser?.appUser?.spotifyId
                      })}
                      
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
                              <p className="text-xs text-yellow-500 mt-4">Note: Spotify ID not detected. Try refreshing.</p>
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
            <BorderBeam size={120} duration={8} className="opacity-20" />
          </MagicCard>
        </div>

        {/* Activity Sidebar */}
        <div className="space-y-6">
          {/* Voting Activity */}
          <MagicCard className="p-0 rounded-2xl border-0 bg-card">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Activity className="h-4 w-4 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Your Activity</h3>
              </div>

              {renderActivityContent()}
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>

          {/* Quick Stats */}
          {appUser?.appUser && (
            <MagicCard className="p-0 rounded-2xl border-0 bg-card">
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <User className="h-4 w-4 text-purple-400" />
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
                      appUser.appUser.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {appUser.appUser.role.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <BorderBeam size={80} duration={8} className="opacity-20" />
            </MagicCard>
          )}
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
