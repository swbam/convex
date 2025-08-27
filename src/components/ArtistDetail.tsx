import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ArrowLeft, Heart, Play, Calendar, MapPin, Users, Music, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddToSetlistModal } from "./AddToSetlistModal";

interface ArtistDetailProps {
  artistId: Id<"artists">;
  onBack: () => void;
  onShowClick: (showId: Id<"shows">) => void;
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
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      {/* Artist Header */}
      <div className="dashboard-card">
        <div className="flex flex-col md:flex-row gap-6">
          {artist.images?.[0] && (
            <img
              src={artist.images[0]}
              alt={artist.name}
              className="w-48 h-48 rounded-lg object-cover mx-auto md:mx-0"
            />
          )}
          
          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{artist.name}</h1>
              {artist.genres && artist.genres.length > 0 && (
                <p className="text-muted-foreground text-lg">
                  {artist.genres.join(", ")}
                </p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              {artist.followers && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{artist.followers.toLocaleString()} followers</span>
                </div>
              )}
              {artist.popularity && (
                <div className="flex items-center gap-1">
                  <Music className="h-4 w-4" />
                  <span>{artist.popularity}% popularity</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{upcomingShows.length} upcoming shows</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleFollow}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  isFollowing 
                    ? "bg-primary/20 text-primary border border-primary" 
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                <Heart className={`h-4 w-4 ${isFollowing ? "fill-current" : ""}`} />
                {isFollowing ? "Following" : "Follow"}
              </button>
              
              <button className="flex items-center gap-2 px-6 py-3 rounded-lg border border-border hover:bg-accent transition-colors">
                <Play className="h-4 w-4" />
                Play
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Shows - Main Content */}
        <div className="lg:col-span-2">
          <div className="dashboard-card">
            <h2 className="text-2xl font-bold mb-6">Upcoming Shows</h2>
            
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
              <div className="space-y-4">
                {upcomingShows.map((show) => (
                  <div
                    key={show._id}
                    className="p-6 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => onShowClick(show._id)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2">{show.venue?.name}</h3>
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{show.venue?.city}, {show.venue?.country}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {new Date(show.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          {show.startTime && (
                            <span>{show.startTime}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                          new Date(show.date).toDateString() === new Date().toDateString()
                            ? "bg-primary/20 text-primary" 
                            : "bg-blue-500/20 text-blue-400"
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

            {/* Recent Shows Section */}
            {recentShows.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">Recent Shows</h3>
                <div className="space-y-3">
                  {recentShows.slice(0, 3).map((show) => (
                    <div
                      key={show._id}
                      className="p-4 rounded-lg border bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => onShowClick(show._id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{show.venue?.name}</div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{show.venue?.city}</span>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(show.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Songs - Right Sidebar */}
        <div className="space-y-6">
          <div className="dashboard-card">
            <h3 className="text-xl font-bold mb-4">Top Songs</h3>
            
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
          <div className="dashboard-card">
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
        </div>
      </div>

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
