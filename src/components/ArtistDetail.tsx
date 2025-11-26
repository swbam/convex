import React, { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ArrowLeft, Calendar, MapPin, Users, Music, Plus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { AddToSetlistModal } from "./AddToSetlistModal";
import { SEOHead } from "./SEOHead";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { FadeIn } from "./animations/FadeIn";
import { motion } from "framer-motion";
import { useAction } from "convex/react";

interface ArtistDetailProps {
  artistId: Id<"artists">;
  onBack: () => void;
  onShowClick: (showId: Id<"shows">, slug?: string) => void;
  onSignInRequired: () => void;
}

export function ArtistDetail({ artistId, onBack, onShowClick, onSignInRequired }: ArtistDetailProps) {
  const artist = useQuery(api.artists.getById, { id: artistId });
  const shows = useQuery(api.shows.getByArtist, { artistId, limit: 20 });
  const songs = useQuery(api.songs.getByArtist, { artistId, limit: 20 });
  const isFollowing = useQuery(api.artists.isFollowing, { artistId });
  const user = useQuery(api.auth.loggedInUser);
  // Media selection via backend (Ticketmaster hero, Spotify avatar)
  const getArtistImages = useAction(api.media.getArtistImages);
  const [heroImage, setHeroImage] = React.useState<string | undefined>(undefined);
  const [avatarImage, setAvatarImage] = React.useState<string | undefined>(undefined);
  const [spotifyLink, setSpotifyLink] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (!artistId) return;
    void (async () => {
      try {
        const res = await getArtistImages({ artistId });
        if (res) {
          setHeroImage(res.heroUrl || undefined);
          setAvatarImage(res.avatarUrl || undefined);
          setSpotifyLink(res.spotifyUrl || undefined);
        }
      } catch {
        // ignore
      }
    })();
  }, [artistId, getArtistImages]);

  const [anonymousActions, setAnonymousActions] = useState(0);
  const [addToSetlistModal, setAddToSetlistModal] = useState<{ isOpen: boolean; songTitle: string }>({ isOpen: false, songTitle: "" });
  const followArtist = useMutation(api.artists.followArtist);

  // Loading state
  const isLoading = !artist;

  const handleAnonymousAction = () => {
    if (anonymousActions >= 1) {
      onSignInRequired();
      return false;
    }
    setAnonymousActions(prev => prev + 1);
    return true;
  };

  const handleFollow = async () => {
    if (!user && !handleAnonymousAction()) return;
    
    try {
      if (user) {
        const following = await followArtist({ artistId });
        toast.success(following ? `Following ${artist?.name}` : `Unfollowed ${artist?.name}`);
      } else {
        toast.success(`Added ${artist?.name} to your interests`);
      }
    } catch (error) {
      toast.error("Failed to follow artist");
    }
  };

  const handleAddToSetlist = (songTitle: string) => {
    setAddToSetlistModal({ isOpen: true, songTitle });
  };

  // NEW: Handle null artist (404 or not found)
  if (artist === null) {
    return (
      <div className="container mx-auto px-4 py-8 text-center min-h-screen flex flex-col items-center justify-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-white">Artist Not Found</h1>
          <p className="text-gray-400">The artist could not be found in our database. Try searching for them.</p>
          <Link to="/search">
            <Button className="w-full">
              Search Artists
            </Button>
          </Link>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    // Premium loading skeleton
    return (
      <motion.div 
        className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="glass-card rounded-2xl p-8 space-y-6 relative overflow-hidden">
          <div className="animate-pulse space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center gap-6">
              <div className="w-40 h-40 bg-white/5 rounded-2xl" />
              <div className="flex-1 space-y-4">
                <div className="h-10 bg-white/5 rounded w-2/3" />
                <div className="h-5 bg-white/5 rounded w-1/2" />
                <div className="h-5 bg-white/5 rounded w-1/3" />
              </div>
            </div>
            {/* Shows skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-white/5 rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer-sweep" />
        </div>
      </motion.div>
    );
  }

  const upcomingShows = shows?.filter(show => show.status === "upcoming") || [];
  const recentShows = shows?.filter(show => show.status === "completed") || [];

  // Progressive loading states
  const isImportingShows = artist && !artist.syncStatus?.showsImported && artist.syncStatus?.phase === "shows";
  const isImportingCatalog = artist?.syncStatus?.phase === "catalog";
  const hasImportError = artist?.syncStatus?.error;

  return (
    <>
      <SEOHead />
      <motion.div
        className="space-y-4 sm:space-y-8 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Hero Header - Consistent with ShowHeader */}
        <div className="relative w-full overflow-hidden bg-card rounded-none sm:rounded-2xl">
          {/* Background Image with Overlay */}
          {heroImage && (
            <div className="absolute inset-0 z-0">
              <img src={heroImage} alt="" className="w-full h-full object-cover opacity-30 dark:opacity-30 blur-sm scale-105" />
              <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/70 to-background/90 dark:from-black/50 dark:via-black/70 dark:to-black/90" />
            </div>
          )}

          {/* Content */}
          <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10">
            {/* Always side-by-side layout - image left, text right */}
            <div className="flex flex-row items-center gap-3 sm:gap-5 lg:gap-6 max-w-6xl mx-auto">
              {/* Artist Image - smaller on mobile */}
              {(avatarImage || heroImage) && (
                <div className="flex-shrink-0">
                  <a
                    href={spotifyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={spotifyLink ? "View artist on Spotify" : undefined}
                    className="relative block"
                  >
                    <img
                      src={(avatarImage || heroImage)!}
                      alt={artist.name}
                      className="w-16 h-16 sm:w-24 sm:h-24 lg:w-32 lg:h-32 rounded-lg sm:rounded-xl lg:rounded-2xl object-cover shadow-xl ring-2 ring-border"
                    />
                  </a>
                </div>
              )}

              {/* Info - always left-aligned */}
              <div className="flex-1 min-w-0">
                {/* Label */}
                <p className="text-[9px] sm:text-xs font-semibold text-muted-foreground mb-0.5 sm:mb-1 uppercase tracking-widest">
                  Artist
                </p>
                
                {/* Artist Name */}
                <h1 className="text-lg sm:text-2xl lg:text-4xl font-bold text-foreground leading-tight tracking-tight line-clamp-2">
                  {artist.name}
                </h1>

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-[10px] sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                  {artist.followers && (
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <Users className="h-2.5 w-2.5 sm:h-4 sm:w-4" />
                      <span className="font-medium">{(artist.followers / 1000000).toFixed(1)}M</span>
                    </div>
                  )}
                  <span className="text-muted-foreground/50">•</span>
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    <Calendar className="h-2.5 w-2.5 sm:h-4 sm:w-4" />
                    <span className="font-medium">
                      {upcomingShows.length} {upcomingShows.length === 1 ? "show" : "shows"}
                    </span>
                  </div>
                  {artist.genres && artist.genres.length > 0 && (
                    <>
                      <span className="text-muted-foreground/50 hidden sm:inline">•</span>
                      <div className="hidden sm:flex items-center gap-2">
                        {(artist.genres || []).slice(0, 2).map((genre: any, idx: number) => (
                          <span key={idx} className="px-2 py-0.5 bg-secondary backdrop-blur-sm rounded-full text-xs font-medium">
                            {genre}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-0 sm:px-6 pb-4 sm:pb-8">
          <FadeIn delay={0.3} duration={0.6}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 sm:gap-6 lg:gap-8">
          {/* Upcoming Shows - Main Content */}
        <div className="lg:col-span-2">
          <MagicCard className="p-0 rounded-none sm:rounded-2xl border-0 bg-card border-t border-b border-border sm:border">
            <div className="px-4 py-4 sm:p-6">
              <Tabs defaultValue="upcoming" className="w-full">
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-foreground" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Shows</h2>
                  </div>
                  <TabsList className="flex w-full bg-white/5 rounded-lg p-1 gap-2 h-auto max-w-md">
                    <TabsTrigger value="upcoming" className="flex-1 justify-center data-[state=active]:bg-white/10 py-2.5">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>Upcoming</span>
                    </TabsTrigger>
                    <TabsTrigger value="past" className="flex-1 justify-center data-[state=active]:bg-white/10 py-2.5">
                      <Music className="h-4 w-4 mr-2" />
                      <span>Past</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="upcoming" className="mt-6">
                  {!shows ? (
              <div className="divide-y divide-white/5 -mx-4 sm:mx-0 sm:space-y-0 sm:divide-y-0 sm:space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="px-4 py-5 sm:p-5 sm:rounded-lg sm:border sm:border-white/10 min-h-[56px] flex items-center animate-pulse">
                    <div className="flex-1">
                      <div className="h-5 bg-white/10 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-white/5 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : isImportingShows ? (
              <FadeIn>
                <MagicCard className="p-8 rounded-2xl border-0 bg-card">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <div className="text-center">
                      <p className="text-lg font-medium text-white">Fetching Shows</p>
                      <p className="text-sm text-gray-400 mt-2">
                        Importing {artist.name}'s tour dates from Ticketmaster...
                      </p>
                      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
                        <span className="animate-pulse">⚡</span>
                        <span>Usually takes 3-5 seconds</span>
                      </div>
                    </div>
                  </div>
                  <BorderBeam size={150} duration={8} className="opacity-30" />
                </MagicCard>
              </FadeIn>
            ) : hasImportError ? (
              <MagicCard className="p-8 rounded-2xl border-0 bg-red-500/10 border border-red-500/20">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                    <Music className="h-8 w-8 text-red-400" />
                  </div>
                  <p className="text-red-400 font-medium">{hasImportError}</p>
                  <p className="text-sm text-gray-400">There was an issue importing show data.</p>
                  <Button onClick={() => window.location.reload()} variant="outline">
                    Retry Import
                  </Button>
                </div>
              </MagicCard>
            ) : upcomingShows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming shows scheduled</p>
                <p className="text-sm mt-1">Check back later for tour announcements</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5 -mx-4 sm:mx-0 sm:space-y-0 sm:divide-y-0 sm:space-y-3">
                {upcomingShows.map((show, idx) => (
                  <div
                    key={show._id}
                    className="px-4 py-5 sm:p-5 sm:rounded-xl sm:border sm:border-white/10 bg-transparent sm:bg-white/5 active:bg-white/10 sm:hover:bg-white/10 cursor-pointer transition-all duration-150 active:scale-[0.98] min-h-[56px] flex items-center"
                    onClick={() => onShowClick(show._id, (show as any).slug)}
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg sm:text-xl font-extrabold text-white mb-1.5 leading-tight">{show.venue?.name}</h3>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-300">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{show.venue?.city}, {show.venue?.country}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              {new Date(show.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          {show.startTime && (
                            <span className="text-xs">{show.startTime}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium border ${
                          new Date(show.date).toDateString() === new Date().toDateString()
                            ? "border-foreground text-foreground" 
                            : "border-border text-muted-foreground"
                        }`}>
                          {new Date(show.date).toDateString() === new Date().toDateString() ? "Tonight" : "Upcoming"}
                        </div>
                      </div>
                    </div>
                    
                    {show.venue?.capacity && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{show.venue.capacity.toLocaleString()} capacity</span>
                      </div>
                    )}
                  </div>
                ))}
                  </div>
                  )}
                </TabsContent>
                
                <TabsContent value="past" className="mt-6">
                  {!shows ? (
                    <div className="divide-y divide-white/5 -mx-4 sm:mx-0 sm:space-y-0 sm:divide-y-0 sm:space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="px-4 py-5 sm:p-5 sm:rounded-lg sm:border sm:border-white/10 min-h-[56px] flex items-center animate-pulse">
                          <div className="flex-1">
                            <div className="h-5 bg-white/10 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-white/5 rounded w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : recentShows.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No past shows recorded</p>
                      <p className="text-sm mt-1">Past shows will appear here after they happen</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5 -mx-4 sm:mx-0 sm:space-y-0 sm:divide-y-0 sm:space-y-3">
                      {recentShows.map((show) => (
                    <div
                      key={show._id}
                      className="px-4 py-5 sm:p-5 sm:rounded-xl sm:border sm:border-white/10 bg-transparent sm:bg-white/5 active:bg-white/10 sm:hover:bg-white/10 cursor-pointer transition-all duration-150 active:scale-[0.98] min-h-[56px] flex items-center"
                      onClick={() => onShowClick(show._id, (show as any).slug)}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl font-extrabold text-white mb-1.5 leading-tight">{show.venue?.name}</h3>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-300">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{show.venue?.city}, {show.venue?.country}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>
                                {new Date(show.date).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="px-3 py-1 rounded-full text-sm font-medium border border-green-500 text-green-500">
                            Completed
                          </div>
                        </div>
                      </div>
                      
                      {show.venue?.capacity && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{show.venue.capacity.toLocaleString()} capacity</span>
                        </div>
                      )}
                    </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
            <BorderBeam size={120} duration={10} className="opacity-20" />
          </MagicCard>
        </div>

        {/* Top Songs - Right Sidebar */}
        <div className="space-y-0 sm:space-y-6">
          <MagicCard className="p-0 rounded-none sm:rounded-2xl border-0 bg-black border-t border-b border-white/10 sm:border">
            <div className="px-4 py-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                  <Music className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white">Top Songs</h3>
              </div>
            
            {!songs ? (
              <div className="divide-y divide-white/5 -mx-4 sm:mx-0 sm:divide-y-0 sm:space-y-1">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-2 sm:py-2 min-h-[56px] animate-pulse">
                    <div className="w-4 h-4 bg-white/10 rounded"></div>
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-white/10 rounded w-3/4"></div>
                      <div className="h-2.5 bg-white/5 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : songs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No songs available yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5 -mx-4 sm:mx-0 sm:divide-y-0 sm:space-y-1">
                {songs.filter(Boolean).filter(song => song && !song.isLive && !song.isRemix).slice(0, 10).map((song, index) => {
                  if (!song) return null;
                  return (
                    <div
                      key={song._id}
                      className="group flex items-center gap-3 px-4 py-3 sm:px-2 sm:py-2 sm:rounded-lg active:bg-white/10 sm:hover:bg-accent/50 transition-all duration-150 active:scale-[0.98] min-h-[56px]"
                    >
                      <div className="w-4 text-center text-xs text-muted-foreground">
                        {index + 1}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate leading-tight">{song.title}</h4>
                        {song.album && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {song.album}
                          </p>
                        )}
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToSetlist(song.title);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-accent transition-all"
                        title={user ? "Add to setlist" : "Add to prediction (1 free action)"}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Artist Stats */}
          <div className="bg-card rounded-none sm:rounded-2xl px-4 py-6 sm:p-6 border-0 border-t border-b border-white/10 sm:border">
            <h3 className="text-xl font-bold mb-4">Artist Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Upcoming shows</span>
                <span className="font-medium">{upcomingShows.length}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total songs</span>
                <span className="font-medium">{songs?.length || 0}</span>
              </div>
              
              {artist.followers && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Followers</span>
                  <span className="font-medium">{artist.followers.toLocaleString()}</span>
                </div>
              )}
              
              {artist.popularity && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Popularity</span>
                  <span className="font-medium">{artist.popularity}%</span>
                </div>
              )}
            </div>
            </div>
            <BorderBeam size={100} duration={8} className="opacity-20" />
          </MagicCard>
        </div>
        </div>
      </FadeIn>
      </div>
    </motion.div>

    {/* Add to Setlist Modal */}
    <AddToSetlistModal
      isOpen={addToSetlistModal.isOpen}
      onClose={() => setAddToSetlistModal({ isOpen: false, songTitle: "" })}
      artistId={artistId}
      songTitle={addToSetlistModal.songTitle}
      onSignInRequired={onSignInRequired}
    />
  </>
  );
}
