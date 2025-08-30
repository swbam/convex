import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ArrowLeft, MapPin, Calendar, Clock, Users, Music, TrendingUp, ChevronUp, Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SEOHead } from "./SEOHead";
import { AnimatedSubscribeButton } from "./ui/animated-subscribe-button";

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
    limit: 100
  } : "skip");
  const setlists = useQuery(api.setlists.getByShow, show ? { showId } : "skip");
  const user = useQuery(api.auth.loggedInUser);

  const addSongToSetlist = useMutation(api.setlists.addSongToSetlist);

  const [anonymousActions, setAnonymousActions] = useState(0);

  // Get the shared community setlist (there should only be one per show)
  const communitySetlist = setlists?.find(s => !s.isOfficial) || null;

  const handleAnonymousAction = () => {
    if (anonymousActions >= 4) { // Allow 2 song additions + 2 votes = 4 total actions
      onSignInRequired();
      return false;
    }
    setAnonymousActions(prev => prev + 1);
    return true;
  };

  const handleAddSongToSharedSetlist = async (songTitle: string) => {
    if (!user && !handleAnonymousAction()) return;

    try {
      const selectedSong = songs?.find(s => s?.title === songTitle);
      if (!selectedSong) return;

      await addSongToSetlist({
        showId,
        song: {
          title: selectedSong.title,
          album: selectedSong.album,
          duration: selectedSong.durationMs,
          songId: selectedSong._id,
        },
      });

      toast.success(`Added "${songTitle}" to the setlist`);
    } catch (error: any) {
      console.error("Failed to add song:", error);
      toast.error("Failed to add song to setlist");
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

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      <SEOHead
        title={`${show.artist?.name || 'Artist'} @ ${show.venue?.name || 'Venue'} – ${showDate.toLocaleDateString('en-US')} | TheSet`}
        description={`Details for ${show.artist?.name} at ${show.venue?.name} on ${showDate.toLocaleDateString('en-US')}. View setlists and vote.`}
        image={show.artist?.images?.[0]}
        url={typeof window !== 'undefined' ? window.location.href : undefined}
      />
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
        {/* Setlist Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Song Selection for Upcoming Shows */}
          {!officialSetlist && isUpcoming && (
            <div className="dashboard-card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Add Songs to Setlist</h2>
              </div>
              
              {/* Enhanced Song Selection */}
              {songs && songs.length > 0 && (
                <div className="p-5 bg-muted/10 border border-muted/20 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Add Songs to Setlist</h3>
                    <div className="text-xs text-muted-foreground">
                      {(songs || []).filter(Boolean).filter(s => s && !s.isLive && !s.isRemix).filter((s) => {
                        const songTitles = communitySetlist?.songs?.map((song: any) => 
                          typeof song === 'string' ? song : song?.title
                        ) || [];
                        return !songTitles.includes(s!.title);
                      }).length} available
                    </div>
                  </div>
                  
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        void handleAddSongToSharedSetlist(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm transition-all hover:border-muted-foreground"
                  >
                    <option value="" disabled>
                      {user ? "Choose a song to add instantly..." : "Sign in to add songs"}
                    </option>
                    {(songs || [])
                      .filter(Boolean)
                      .filter((s) => s && !s.isLive && !s.isRemix)
                      .filter((s) => {
                        // Don't show songs already in the setlist
                        const songTitles = communitySetlist?.songs?.map((song: any) => 
                          typeof song === 'string' ? song : song?.title
                        ) || [];
                        return !songTitles.includes(s!.title);
                      })
                      .sort((a, b) => (b!.popularity || 0) - (a!.popularity || 0))
                      .map((song) => (
                        <option 
                          key={song!._id} 
                          value={song!.title}
                        >
                          {song!.title} {song!.album ? `• ${song!.album}` : ''}
                        </option>
                      ))
                    }
                  </select>
                  
                  <div className="mt-3 text-xs text-muted-foreground">
                    Songs are added instantly - no save button needed
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Shared Setlist Display */}
          <div className="dashboard-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">
                {officialSetlist ? "Official Setlist" : "Vote on the Setlist"}
              </h2>
              <div className="flex items-center gap-4">
                {(communitySetlist || officialSetlist) && (
                  <div className="text-sm text-muted-foreground">
                    {(officialSetlist?.songs?.length || communitySetlist?.songs?.length || 0)} songs
                  </div>
                )}
                {communitySetlist && !officialSetlist && (
                  <div className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded-full">
                    Community Predictions
                  </div>
                )}
              </div>
            </div>
            
            {officialSetlist ? (
              // Show official setlist (verified from setlist.fm)
              <div className="space-y-2">
                <div className="mb-4 p-3 bg-muted/10 border border-muted/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">Official Setlist</span>
                    <span className="text-xs text-muted-foreground">Verified from setlist.fm</span>
                  </div>
                </div>
                {(officialSetlist.songs as any[]).map((songTitle, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/5 border border-muted/20"
                  >
                    <div className="w-6 h-6 bg-primary/20 text-center rounded-full flex items-center justify-center text-xs font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground text-sm">{typeof songTitle === 'string' ? songTitle : songTitle?.title}</h3>
                    </div>
                  </div>
                ))}
              </div>
            ) : !communitySetlist || (communitySetlist.songs?.length || 0) === 0 ? (
              // No songs in shared setlist yet
              <div className="text-center py-12 text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No songs in the setlist yet</p>
                <p className="text-sm mt-1">Use the dropdown above to add the first song!</p>
              </div>
            ) : (
              // Show shared setlist with instant voting (no save buttons)
              <div className="space-y-2">
                <div className="mb-4 p-3 bg-muted/5 border border-muted/20 rounded-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Click ↑ to vote for songs you want to hear</span>
                    <span className="text-muted-foreground">{communitySetlist.songs?.length || 0} songs • {((communitySetlist.upvotes || 0) + (communitySetlist.downvotes || 0))} total votes</span>
                  </div>
                </div>
                
                {(communitySetlist.songs || [])
                  .map((s: any) => (typeof s === 'string' ? s : s?.title))
                  .filter(Boolean)
                  .map((songTitle: string, index: number) => (
                    <SongVoteRow
                      key={`${communitySetlist._id}-${songTitle}-${index}`}
                      setlistId={communitySetlist._id}
                      songTitle={songTitle}
                      position={index + 1}
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

          {/* Show Stats */}
          <div className="dashboard-card">
            <h3 className="text-xl font-bold mb-4">Show Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Songs in setlist</span>
                <span className="font-medium">{officialSetlist?.songs?.length || communitySetlist?.songs?.length || 0}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Studio songs available</span>
                <span className="font-medium">{songs?.filter(Boolean).filter(s => s && !s.isLive && !s.isRemix).length || 0}</span>
              </div>
              
              {communitySetlist && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Song votes</span>
                    <span className="font-medium">
                      {(communitySetlist.songs || []).reduce((total: number, _: any, index: number) => {
                        // This would need to be calculated properly with individual song votes
                        return total + (index + 1); // Placeholder calculation
                      }, 0)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Setlist upvotes</span>
                    <span className="font-medium">{communitySetlist.upvotes || 0}</span>
                  </div>
                </>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Show status</span>
                <span className="font-medium capitalize">{show.status}</span>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          {!user && (
            <div className="dashboard-card text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-3 text-primary" />
              <h3 className="font-bold mb-2">Join the Voting</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Sign in to request unlimited songs and vote on others
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

// Individual Song in Shared Setlist with Always-Visible Voting
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
      // No toast needed - the UI update is instant and clear
    } catch {
      toast.error("Failed to vote");
    }
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-muted/5 rounded-lg hover:bg-muted/10 transition-all duration-200 group">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-6 h-6 bg-muted/30 text-center rounded-full flex items-center justify-center text-xs font-semibold text-muted-foreground">
          {position}
        </div>
        <span className="font-medium text-sm text-foreground truncate">{songTitle}</span>
      </div>
      
      {/* Always-visible vote button with count */}
      <AnimatedSubscribeButton
        subscribeStatus={songVotes?.userVoted || false}
        onClick={() => void handleSongVote()}
        className="ml-3 h-7 min-w-[60px] text-xs"
      >
        <span className="flex items-center gap-1">
          <ChevronUp className="h-3 w-3" />
          <span className="font-semibold">{songVotes?.upvotes || 0}</span>
        </span>
        <span className="flex items-center gap-1">
          <Heart className="h-3 w-3 fill-current" />
          <span className="font-semibold">{songVotes?.upvotes || 0}</span>
        </span>
      </AnimatedSubscribeButton>
    </div>
  );
}