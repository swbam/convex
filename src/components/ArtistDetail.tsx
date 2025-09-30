import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ArrowLeft, Calendar, MapPin, Users, Music, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddToSetlistModal } from "./AddToSetlistModal";
import { SEOHead } from "./SEOHead";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { FadeIn } from "./animations/FadeIn";

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

  const [anonymousActions, setAnonymousActions] = useState(0);
  const [addToSetlistModal, setAddToSetlistModal] = useState<{ isOpen: boolean; songTitle: string }>({ isOpen: false, songTitle: "" });
  const followArtist = useMutation(api.artists.followArtist);

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

  if (!artist) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-32"></div>
          <div className="h-64 bg-muted rounded"></div>
          <div className="h-6 bg-muted rounded w-48"></div>
        </div>
      </div>
    );
  }

  const upcomingShows = shows?.filter(show => show.status === "upcoming") || [];
  const recentShows = shows?.filter(show => show.status === "completed") || [];

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8 relative z-10">
      <SEOHead
        title={`${artist.name} – Artist | setlists.live`}
        description={`Explore ${artist.name}'s upcoming shows, catalog and top songs. Vote on setlist predictions.`}
        image={artist.images?.[0]}
        url={typeof window !== 'undefined' ? window.location.href : undefined}
      />
      {/* Enhanced Back Button */}
      <MagicCard className="inline-block p-0 rounded-xl border-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-300 px-4 py-2 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </MagicCard>

      {/* Revamped Header with Cover Photo Background */}
      <div className="relative overflow-hidden rounded-2xl">
        {/* Background Cover Image */}
        {artist.images?.[0] && (
          <div className="absolute inset-0 z-0">
            <img
              src={artist.images[0]}
              alt=""
              className="w-full h-full object-cover opacity-30 blur-sm scale-110"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black" />
          </div>
        )}
        
        {/* Content */}
        <div className="relative z-10 p-6 sm:p-8 lg:p-10">
          <div className="flex items-end gap-4 sm:gap-6">
            {/* Large Profile Image */}
            {artist.images?.[0] && (
              <div className="flex-shrink-0">
                <img
                  src={artist.images[0]}
                  alt={artist.name}
                  className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-2xl object-cover shadow-2xl border-4 border-black/50"
                />
              </div>
            )}
            
            {/* Artist Info */}
            <div className="flex-1 min-w-0 pb-2">
              <p className="text-xs sm:text-sm font-medium text-gray-300 mb-2 uppercase tracking-wider">Artist</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-3 leading-tight">
                {artist.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
                {artist.followers && (
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">{(artist.followers / 1000000).toFixed(1)}M followers</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">{upcomingShows.length} upcoming {upcomingShows.length === 1 ? 'show' : 'shows'}</span>
                </div>
                {artist.genres && artist.genres.length > 0 && (
                  <div className="hidden sm:flex items-center gap-2">
                    {artist.genres.slice(0, 2).map((genre, idx) => (
                      <span key={idx} className="px-2 py-1 bg-white/10 rounded-full text-xs font-medium">
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <FadeIn delay={0.3} duration={0.6}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
          {/* Upcoming Shows - Main Content */}
        <div className="lg:col-span-2">
          <MagicCard className="p-0 rounded-2xl border-0 bg-black" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
            <div className="p-4 sm:p-6">
              <Tabs defaultValue="upcoming" className="w-full">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">Shows</h2>
                  </div>
                  <TabsList className="grid w-[200px] grid-cols-2">
                    <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                    <TabsTrigger value="past">Past</TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="upcoming" className="mt-6">
                  {!shows ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 rounded-lg border animate-pulse">
                    <div className="h-6 bg-muted rounded mb-2"></div>
                    <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : upcomingShows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming shows scheduled</p>
                <p className="text-sm mt-1">Check back later for tour announcements</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingShows.map((show) => (
                  <div
                    key={show._id}
                    className="p-4 sm:p-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-all duration-200"
                    onClick={() => onShowClick(show._id, (show as any).slug)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{show.venue?.name}</h3>
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
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="p-4 rounded-lg border animate-pulse">
                          <div className="h-6 bg-muted rounded mb-2"></div>
                          <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
                          <div className="h-4 bg-muted rounded w-1/2"></div>
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
                    <div className="space-y-3">
                      {recentShows.map((show) => (
                    <div
                      key={show._id}
                      className="p-4 sm:p-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-all duration-200"
                      onClick={() => onShowClick(show._id, (show as any).slug)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{show.venue?.name}</h3>
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
        <div className="space-y-4 sm:space-y-6">
          <MagicCard className="p-0 rounded-2xl border-0 bg-black" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                  <Music className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white">Top Songs</h3>
              </div>
            
            {!songs ? (
              <div className="space-y-3">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                    <div className="w-4 h-4 bg-muted rounded shimmer"></div>
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-muted rounded shimmer"></div>
                      <div className="h-2 bg-muted rounded w-2/3 shimmer"></div>
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
              <div className="space-y-2">
                {songs.filter(Boolean).filter(song => song && !song.isLive && !song.isRemix).slice(0, 10).map((song, index) => {
                  if (!song) return null;
                  return (
                    <div
                      key={song._id}
                      className="group flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="w-4 text-center text-xs text-muted-foreground">
                        {index + 1}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{song.title}</h4>
                        {song.album && (
                          <p className="text-xs text-muted-foreground truncate">
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
          <div className="bg-black rounded-2xl p-6 border border-white/10">
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

      {/* Add to Setlist Modal */}
      <AddToSetlistModal
        isOpen={addToSetlistModal.isOpen}
        onClose={() => setAddToSetlistModal({ isOpen: false, songTitle: "" })}
        artistId={artistId}
        songTitle={addToSetlistModal.songTitle}
        onSignInRequired={onSignInRequired}
      />
    </div>
  );
}
