import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ArrowLeft, MapPin, Calendar, Clock, Users, Music, Plus, TrendingUp, ChevronUp } from "lucide-react";
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
  const submitVote = useMutation(api.setlists.submitVote);
  const voteOnSong = useMutation(api.songVotes.voteOnSong);

  const [anonymousActions, setAnonymousActions] = useState(0);
  const [predictedSongs, setPredictedSongs] = useState<string[]>([]);

  // Load user's existing setlist
  useEffect(() => {
    if (userSetlist) {
      const titles = (userSetlist.songs || []).map((s: any) => (typeof s === "string" ? s : s.title)).filter(Boolean);
      setPredictedSongs(titles);
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
  };

  const handleAutoSave = async (songTitles: string[]) => {
    if (!user) return;

    try {
      const songObjects = songTitles.map(title => ({
        title,
        album: songs?.find(s => s?.title === title)?.album,
        duration: songs?.find(s => s?.title === title)?.durationMs,
        songId: songs?.find(s => s?.title === title)?._id,
      }));

      await createSetlist({
        showId,
        songs: songObjects,
      });
    } catch (error: any) {
      console.error("Auto-save failed:", error);
    }
  };

  const handleVote = async (setlistId: Id<"setlists">, voteType: "accurate" | "inaccurate") => {
    if (!user) {
      onSignInRequired();
      return;
    }

    try {
      await submitVote({ setlistId, voteType });
      toast.success(`Voted ${voteType} on setlist`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to vote");
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
                  ? "border border-border text-foreground" 
                  : "border border-border text-muted-foreground"
                : "border border-border text-muted-foreground"
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
                <h2 className="text-2xl font-bold">Vote on the set</h2>
              </div>
              
              {/* Song Dropdown & Add Interface */}
              {songs && songs.length > 0 && (
                <div className="mb-6 p-4 bg-muted/10 border border-muted/20 rounded-lg">
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">Add Songs to Your Prediction</h3>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const selectedSong = songs.find(s => s?.title === e.target.value);
                        if (selectedSong && !predictedSongs.includes(selectedSong.title)) {
                          const newSongs = [...predictedSongs, selectedSong.title];
                          setPredictedSongs(newSongs);
                          // Auto-save immediately (no save button)
                          handleAutoSave(newSongs).catch(console.error);
                          toast.success(`Added "${selectedSong.title}" to your prediction`);
                        } else if (selectedSong) {
                          toast.info(`"${selectedSong.title}" is already in your prediction`);
                        }
                        e.target.value = "";
                      }
                    }}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  >
                    <option value="" disabled>Choose a song to add...</option>
                    {(songs || [])
                      .filter(Boolean)
                      .filter((s) => s && !s.isLive && !s.isRemix)
                      .sort((a, b) => a!.title.localeCompare(b!.title))
                      .map((song) => (
                        <option 
                          key={song!._id} 
                          value={song!.title}
                          disabled={predictedSongs.includes(song!.title)}
                        >
                          {song!.title} {song!.album ? `• ${song!.album}` : ''}
                        </option>
                      ))
                    }
                  </select>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {user 
                      ? `${(songs || []).filter(Boolean).filter(s => s && !s.isLive && !s.isRemix).length} studio songs available from ${show?.artist?.name || 'this artist'}`
                      : "Sign in to add unlimited songs to your prediction"
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Setlists Display */}
          <div className="dashboard-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">
                {officialSetlist ? "Official Setlist" : (isUpcoming ? "Community votes" : "Predicted Setlists")}
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
                {(officialSetlist.songs as any[]).map((songTitle, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-3 rounded-lg bg-green-500/5 border border-green-500/10"
                  >
                    <div className="w-6 text-center text-sm font-medium text-green-600">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-green-700">{typeof songTitle === 'string' ? songTitle : songTitle?.title}</h3>
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

// Individual Song Vote Row Component
function SongVoteRow({ 
  setlistId, 
  songTitle, 
  position, 
  user, 
  onSignInRequired 
}: {
  setlistId: Id<"setlists">;
  songTitle: string;
  position: number;
  user: any;
  onSignInRequired: () => void;
}) {
  const voteOnSong = useMutation(api.songVotes.voteOnSong);
  const songVotes = useQuery(api.songVotes.getSongVotes, { 
    setlistId, 
    songTitle 
  });

  const handleSongVote = async () => {
    if (!user) {
      onSignInRequired();
      return;
    }

    try {
      await voteOnSong({
        setlistId,
        songTitle,
        voteType: "upvote",
      });
      toast.success(songVotes?.userVoted ? "Vote removed!" : "Song upvoted!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to vote");
    }
  };

  return (
    <div className="flex items-center justify-between py-4 px-5 bg-muted/5 rounded-lg hover:bg-muted/10 transition-colors">
      <div className="flex items-center gap-4">
        <span className="w-10 h-10 bg-muted/20 text-center rounded-full flex items-center justify-center text-sm font-bold text-muted-foreground">
          {position}
        </span>
        <span className="font-medium text-lg">{songTitle}</span>
      </div>
      
      <button
        onClick={handleSongVote}
        className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${
          songVotes?.userVoted 
            ? "bg-primary border-primary text-primary-foreground shadow-lg scale-105" 
            : "border-border hover:border-primary/50 hover:bg-primary/5 hover:scale-105"
        }`}
      >
        <ChevronUp className="h-5 w-5" />
        <span className="font-bold text-lg">{songVotes?.upvotes || 0}</span>
      </button>
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
  onVote: (setlistId: Id<"setlists">, voteType: "accurate" | "inaccurate") => void;
  user: any;
  onSignInRequired: () => void;
}) {
  const userVote = useQuery(api.setlists.getUserVote, { setlistId: setlist._id });
  const setlistVotes = useQuery(api.setlists.getSetlistVotes, { setlistId: setlist._id });
  
  const handleVote = (voteType: "accurate" | "inaccurate") => {
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
        
        {/* ProductHunt-style Upvoting */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleVote("accurate")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
              userVote === "accurate" 
                ? "bg-primary border-primary text-primary-foreground shadow-lg" 
                : "border-border hover:border-primary/50 hover:bg-primary/5"
            }`}
          >
            <ChevronUp className="h-4 w-4" />
            <span className="font-semibold">{setlistVotes?.accurate || 0}</span>
          </button>
        </div>
      </div>

      {/* Songs with ProductHunt-style voting */}
      <div className="space-y-3">
        {setlist.songs.slice(0, 20).map((songTitle: string, index: number) => (
          <SongVoteRow
            key={`${setlist._id}-${songTitle}-${index}`}
            setlistId={setlist._id}
            songTitle={songTitle}
            position={index + 1}
            user={user}
            onSignInRequired={onSignInRequired}
          />
        ))}
        {setlist.songs.length > 20 && (
          <div className="text-sm text-muted-foreground text-center py-2">
            +{setlist.songs.length - 20} more songs
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 mt-4 border-t">
        <span>{setlist.songs.length} songs</span>
        <span>•</span>
        <span className="text-primary font-medium">{setlistVotes?.accurate || 0} upvotes</span>
      </div>
    </div>
  );
}