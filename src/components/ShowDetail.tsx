import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ArrowLeft, MapPin, Calendar, Clock, Users, Music, Plus, TrendingUp, ChevronUp, ChevronDown, Save, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface ShowDetailProps {
  showId: Id<"shows">;
  onBack: () => void;
  onArtistClick: (artistId: Id<"artists">) => void;
  onSignInRequired: () => void;
}

export function ShowDetail({ showId, onBack, onArtistClick, onSignInRequired }: ShowDetailProps) {
  const show = useQuery(api.shows.getById, { id: showId });
  const songs = useQuery(api.songs.getByArtist, show?.artistId ? { 
    artistId: show.artistId,
    limit: 50 
  } : "skip");
  const setlists = useQuery(api.setlists.getByShow, show ? { showId } : "skip");
  const userSetlist = useQuery(api.setlists.getUserSetlistForShow, show ? { showId } : "skip");
  const user = useQuery(api.auth.loggedInUser);

  const createSetlist = useMutation(api.setlists.create);
  const voteOnSetlist = useMutation(api.setlists.vote);

  const [anonymousActions, setAnonymousActions] = useState(0);
  const [predictedSongs, setPredictedSongs] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load user's existing setlist
  useEffect(() => {
    if (userSetlist) {
      setPredictedSongs(userSetlist.songs);
    }
  }, [userSetlist]);

  const handleAnonymousAction = () => {
    if (anonymousActions >= 2) {
      onSignInRequired();
      return false;
    }
    setAnonymousActions(prev => prev + 1);
    return true;
  };

  const handleAddToSetlist = (songTitle: string) => {
    if (!user && !handleAnonymousAction()) return;
    
    if (predictedSongs.includes(songTitle)) {
      setPredictedSongs(prev => prev.filter(s => s !== songTitle));
      toast.success(`Removed "${songTitle}" from prediction`);
    } else {
      setPredictedSongs(prev => [...prev, songTitle]);
      if (user) {
        toast.success(`Added "${songTitle}" to setlist prediction`);
      } else {
        toast.success(`Added "${songTitle}" to your prediction (${anonymousActions + 1}/2 free actions used)`);
      }
    }
    
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const handleSaveSetlist = async () => {
    if (!user && !handleAnonymousAction()) return;
    
    setIsSaving(true);
    try {
      await createSetlist({
        showId,
        songs: predictedSongs,
      });
      setIsEditing(false);
      toast.success("Setlist prediction saved!");
    } catch (error) {
      toast.error("Failed to save setlist");
    } finally {
      setIsSaving(false);
    }
  };

  const handleVote = async (setlistId: Id<"setlists">, voteType: "up" | "down") => {
    if (!user) {
      onSignInRequired();
      return;
    }

    try {
      const result = await voteOnSetlist({ setlistId, voteType });
      if (result === "added") {
        toast.success(`${voteType === "up" ? "Upvoted" : "Downvoted"} setlist`);
      } else if (result === "removed") {
        toast.success("Vote removed");
      } else {
        toast.success("Vote changed");
      }
    } catch (error) {
      toast.error("Failed to vote");
    }
  };

  if (!show) {
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

  const showDate = new Date(show.date);
  const isUpcoming = show.status === "upcoming";
  const isToday = showDate.toDateString() === new Date().toDateString();

  // Get official setlist if available
  const officialSetlist = setlists?.find(s => s.isOfficial);
  const userSetlists = setlists?.filter(s => !s.isOfficial) || [];

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

      {/* Show Header */}
      <div className="dashboard-card">
        <div className="space-y-6">
          <div>
            <button
              onClick={() => onArtistClick(show.artistId)}
              className="text-4xl font-bold hover:text-primary transition-colors"
            >
              {show.artist?.name}
            </button>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{show.venue?.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {showDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              {show.startTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{show.startTime}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              isUpcoming 
                ? isToday 
                  ? "bg-primary/20 text-primary" 
                  : "bg-blue-500/20 text-blue-400"
                : "bg-green-500/20 text-green-400"
            }`}>
              {isToday ? "Tonight" : show.status}
            </div>
            
            {show.venue?.capacity && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{show.venue.capacity.toLocaleString()} capacity</span>
              </div>
            )}
          </div>

          {show.venue?.city && (
            <div className="text-muted-foreground">
              {show.venue.address && `${show.venue.address}, `}
              {show.venue.city}, {show.venue.country}
            </div>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Setlist Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Song Selection */}
          {!officialSetlist && isUpcoming && (
            <div className="dashboard-card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Build Your Prediction</h2>
                {isEditing && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPredictedSongs(userSetlist?.songs || []);
                        setIsEditing(false);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSetlist}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>
              
              {songs === undefined ? (
                // Loading state
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg">
                      <div className="w-6 h-6 bg-muted rounded shimmer"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded shimmer"></div>
                        <div className="h-3 bg-muted rounded w-2/3 shimmer"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : songs.length === 0 ? (
                // No songs available
                <div className="text-center py-12 text-muted-foreground">
                  <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No songs available yet</p>
                  <p className="text-sm mt-1">Songs will be imported automatically</p>
                </div>
              ) : (
                // Song selection interface - filter for studio songs only
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {songs.filter(Boolean).filter(song => song && !song.isLive && !song.isRemix).map((song, index) => {
                    if (!song) return null;
                    const isPredicted = predictedSongs.includes(song.title);
                    return (
                      <div
                        key={song._id}
                        className={`group flex items-center gap-4 p-3 rounded-lg transition-colors ${
                          isPredicted 
                            ? "bg-primary/10 border border-primary/20" 
                            : "hover:bg-accent/50"
                        }`}
                      >
                        <div className="w-6 text-center text-sm text-muted-foreground">
                          {isPredicted ? "✓" : index + 1}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-medium truncate ${
                            isPredicted ? "text-primary" : ""
                          }`}>
                            {song.title}
                          </h3>
                          {song.album && (
                            <p className="text-sm text-muted-foreground truncate">
                              {song.album}
                            </p>
                          )}
                        </div>
                        
                        {song.durationMs && (
                          <div className="text-sm text-muted-foreground">
                            {Math.floor(song.durationMs / 60000)}:{String(Math.floor((song.durationMs % 60000) / 1000)).padStart(2, '0')}
                          </div>
                        )}
                        
                        <button
                          onClick={() => handleAddToSetlist(song.title)}
                          className={`p-2 rounded-full transition-all ${
                            isPredicted
                              ? "bg-primary/20 text-primary"
                              : "opacity-0 group-hover:opacity-100 hover:bg-accent"
                          }`}
                          title={
                            isPredicted 
                              ? "Remove from prediction" 
                              : user 
                                ? "Add to prediction" 
                                : "Add to prediction (free action)"
                          }
                        >
                          <Plus className={`h-4 w-4 ${isPredicted ? "rotate-45" : ""}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Setlists Display */}
          <div className="dashboard-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">
                {officialSetlist ? "Official Setlist" : "Setlist Predictions"}
              </h2>
              {userSetlists.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {userSetlists.length} prediction{userSetlists.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            
            {officialSetlist ? (
              // Show official setlist
              <div className="space-y-2">
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-700">Official Setlist</span>
                    <span className="text-sm text-green-600">{officialSetlist.songs.length} songs</span>
                  </div>
                </div>
                {officialSetlist.songs.map((songTitle, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-3 rounded-lg bg-green-500/5 border border-green-500/10"
                  >
                    <div className="w-6 text-center text-sm font-medium text-green-600">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-green-700">{songTitle}</h3>
                    </div>
                  </div>
                ))}
              </div>
            ) : setlists === undefined ? (
              // Loading state
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-4 bg-muted rounded w-24 shimmer"></div>
                      <div className="h-4 bg-muted rounded w-16 shimmer"></div>
                    </div>
                    <div className="space-y-2">
                      {[...Array(5)].map((_, j) => (
                        <div key={j} className="h-3 bg-muted rounded shimmer"></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : userSetlists.length === 0 ? (
              // No predictions yet
              <div className="text-center py-12 text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No predictions yet</p>
                <p className="text-sm mt-1">Be the first to predict the setlist!</p>
              </div>
            ) : (
              // Show user predictions with voting
              <div className="space-y-4">
                {userSetlists.map((setlist) => (
                  <SetlistCard
                    key={setlist._id}
                    setlist={setlist}
                    onVote={handleVote}
                    user={user}
                    onSignInRequired={onSignInRequired}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Venue Details */}
          <div className="dashboard-card">
            <h3 className="text-xl font-bold mb-4">Venue Details</h3>
            <div className="space-y-3">
              <div>
                <div className="font-medium">{show.venue?.name}</div>
                <div className="text-sm text-muted-foreground">
                  {show.venue?.city}, {show.venue?.country}
                </div>
              </div>
              
              {show.venue?.capacity && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{show.venue.capacity.toLocaleString()} capacity</span>
                </div>
              )}
              
              {show.venue?.address && (
                <div className="text-sm text-muted-foreground">
                  {show.venue.address}
                </div>
              )}
            </div>
          </div>

          {/* Prediction Stats */}
          <div className="dashboard-card">
            <h3 className="text-xl font-bold mb-4">Your Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your predictions</span>
                <span className="font-medium">{predictedSongs.length}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Available songs</span>
                <span className="font-medium">{songs?.length || 0}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total predictions</span>
                <span className="font-medium">{userSetlists.length}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Completion</span>
                <span className="font-medium">
                  {songs?.length ? Math.round((predictedSongs.length / Math.min(songs.length, 25)) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          {!user && (
            <div className="dashboard-card text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="font-bold mb-2">Join the Competition</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Sign in to create unlimited predictions and vote on others
              </p>
              <button
                onClick={onSignInRequired}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SetlistCard({ 
  setlist, 
  onVote, 
  user, 
  onSignInRequired 
}: { 
  setlist: any; 
  onVote: (setlistId: Id<"setlists">, voteType: "up" | "down") => void;
  user: any;
  onSignInRequired: () => void;
}) {
  const userVote = useQuery(api.setlists.getUserVote, { setlistId: setlist._id });
  
  const handleVote = (voteType: "up" | "down") => {
    if (!user) {
      onSignInRequired();
      return;
    }
    onVote(setlist._id, voteType);
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium">{setlist.username}</span>
          <span className="text-sm text-muted-foreground">
            {new Date(setlist._creationTime).toLocaleDateString()}
          </span>
        </div>
        
        {/* Voting */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleVote("up")}
            className={`p-1 rounded transition-colors ${
              userVote === "up" 
                ? "bg-green-500/20 text-green-600" 
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            }`}
            title="Upvote"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          
          <span className={`text-sm font-medium min-w-[2rem] text-center ${
            setlist.score > 0 ? "text-green-600" : 
            setlist.score < 0 ? "text-red-600" : 
            "text-muted-foreground"
          }`}>
            {setlist.score || 0}
          </span>
          
          <button
            onClick={() => handleVote("down")}
            className={`p-1 rounded transition-colors ${
              userVote === "down" 
                ? "bg-red-500/20 text-red-600" 
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            }`}
            title="Downvote"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Songs */}
      <div className="space-y-1">
        {setlist.songs.slice(0, 10).map((songTitle: string, index: number) => (
          <div key={index} className="flex items-center gap-3 text-sm">
            <span className="w-6 text-center text-muted-foreground">{index + 1}</span>
            <span>{songTitle}</span>
          </div>
        ))}
        {setlist.songs.length > 10 && (
          <div className="text-sm text-muted-foreground pl-9">
            +{setlist.songs.length - 10} more songs
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
        <span>{setlist.songs.length} songs</span>
        <span>•</span>
        <span>{setlist.upvotes || 0} upvotes</span>
        <span>•</span>
        <span>{setlist.downvotes || 0} downvotes</span>
      </div>
    </div>
  );
}
