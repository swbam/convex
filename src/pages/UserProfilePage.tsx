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
import { ArrowLeft, User, Settings, Activity, Vote, Shield, Bell, Star, Music, RefreshCw, Calendar } from 'lucide-react';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import { ArtistCard } from '../components/ArtistCard';

export function UserProfilePage() {
  const navigate = useNavigate();
  const { user, isSignedIn } = useUser();
  const appUser = useQuery(api.auth.loggedInUser);
  const userVotes = useQuery(api.songVotes.getUserVotes, 
    appUser?.appUser ? { limit: 10 } : 'skip'
  );
  const spotifyArtists = useQuery(api.spotifyAuth.getUserSpotifyArtists, 
    appUser?.appUser ? { limit: 50, onlyWithShows: true } : 'skip'
  );
  const { hasSpotify, isImporting, refreshSpotifyArtists } = useSpotifyAuth();
  // CRITICAL: Default to 'spotify' tab if user has Spotify, otherwise 'general'
  const defaultTab = hasSpotify ? 'spotify' : 'general';
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  // Update activeTab when hasSpotify changes
  React.useEffect(() => {
    if (hasSpotify && activeTab === 'general') {
      setActiveTab('spotify');
    }
  }, [hasSpotify, activeTab]);
  
  // Redirect if not signed in
  if (!isSignedIn) {
    navigate('/signin');
    return null;
  }
  
  const handleArtistClick = (artistId: Id<'artists'>, slug?: string) => {
    navigate(`/artists/${slug || artistId}`);
  };
  
  const renderActivityContent = () => {
    if (!userVotes) {
      return (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-lg p-3 h-12" />
          ))}
        </div>
      );
    }
    
    if (userVotes.length === 0) {
      return (
        <div className="text-center py-6 text-gray-400">
          <Vote className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No votes yet</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-3">
        <div className="text-center mb-4">
          <div className="text-2xl font-bold text-white">{userVotes.length}</div>
          <div className="text-xs text-gray-400">Total Votes</div>
        </div>
        
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {userVotes.slice(0, 5).map((vote) => (
            <div key={vote._id} className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Star className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="text-sm text-white truncate">{vote.songTitle}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
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
    <>
      <SignedOut>
        <RedirectToSignIn signInUrl="/signin" />
      </SignedOut>
      <SignedIn>
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 relative z-10">
      {/* Header */}
      <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0 bg-black">
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
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Settings</h1>
              <p className="text-gray-300 text-sm sm:text-base">Manage your account preferences and view activity</p>
            </div>
          </div>
        </div>
        <BorderBeam size={150} duration={12} className="opacity-30" />
      </MagicCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Settings */}
        <div className="lg:col-span-2">
          <MagicCard className="p-0 rounded-2xl border-0 bg-black">
            <div className="p-4 sm:p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className={`grid w-full ${hasSpotify ? 'grid-cols-5' : 'grid-cols-4'} bg-white/5 rounded-lg p-1 gap-2`}>
                  <TabsTrigger value="general" className="w-full justify-center data-[state=active]:bg-white/10">
                    <User className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">General</span>
                  </TabsTrigger>
                  {hasSpotify && (
                    <TabsTrigger value="spotify" className="w-full justify-center data-[state=active]:bg-white/10">
                      <Music className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">My Artists</span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="security" className="w-full justify-center data-[state=active]:bg-white/10">
                    <Shield className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Security</span>
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="w-full justify-center data-[state=active]:bg-white/10">
                    <Bell className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Alerts</span>
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="w-full justify-center data-[state=active]:bg-white/10 lg:hidden">
                    <Activity className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Activity</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Profile Information</h3>
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
                            card: 'bg-black border border-white/10 shadow-none',
                            headerTitle: 'text-white',
                            headerSubtitle: 'text-gray-400',
                            socialButtonsBlockButton: 'border-white/10 text-white hover:bg-white/5',
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
                    <h3 className="text-lg font-semibold text-white mb-4">Security Settings</h3>
                    <div className="clerk-profile-container">
                      <UserProfile.Page path="security" />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="notifications" className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Notification Preferences</h3>
                    <div className="space-y-4">
                      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <p className="text-gray-400">Notification settings coming soon...</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {hasSpotify && (
                  <TabsContent value="spotify" className="mt-6 space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Your Spotify Artists</h3>
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
                          <p className="text-gray-400">Importing your Spotify artists...</p>
                          <p className="text-xs text-gray-500 mt-2">This may take 30-60 seconds</p>
                        </div>
                      ) : !spotifyArtists || spotifyArtists.length === 0 ? (
                        <div className="text-center py-8">
                          <Music className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                          <div className="space-y-2">
                            <p className="text-gray-400 mb-2">No artists with upcoming shows found</p>
                            <p className="text-sm text-gray-500">Your Spotify artists will appear here when they have concerts scheduled</p>
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
                          <p className="text-sm text-gray-400 mb-4">
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
                                <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
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
                    <h3 className="text-lg font-semibold text-white mb-4">Your Activity</h3>
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
          <MagicCard className="p-0 rounded-2xl border-0 bg-black">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <Activity className="h-4 w-4 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Your Activity</h3>
              </div>

              {renderActivityContent()}
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>

          {/* Quick Stats */}
          {appUser?.appUser && (
            <MagicCard className="p-0 rounded-2xl border-0 bg-black">
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <User className="h-4 w-4 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Account Info</h3>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Member since</span>
                    <span className="text-white">
                      {new Date(appUser.appUser.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Role</span>
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
      </SignedIn>
    </>
  );
}
