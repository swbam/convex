import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import React, { useState } from "react";
import { ArrowLeft, MapPin, Calendar, Clock, Users, Music, ChevronUp, Heart, Star, Vote } from "lucide-react";
import { toast } from "sonner";
import { SEOHead } from "./SEOHead";
import { AnimatedSubscribeButton } from "./ui/animated-subscribe-button";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { ShimmerButton } from "./ui/shimmer-button";

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
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <SEOHead
        title={`${show.artist?.name || 'Artist'} @ ${show.venue?.name || 'Venue'} – ${showDate.toLocaleDateString('en-US')} | TheSet`}
        description={`Details for ${show.artist?.name} at ${show.venue?.name} on ${showDate.toLocaleDateString('en-US')}. View setlists and vote.`}
        image={show.artist?.images?.[0]}
        url={typeof window !== 'undefined' ? window.location.href : undefined}
      />
      
      {/* Enhanced Back Button */}
      <MagicCard className="inline-block p-0 rounded-xl border-0 hover:border-white/20">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-300 px-4 py-2 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </MagicCard>

      {/* Enhanced Show Header with MagicCard */}
      <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0 hover:border-white/20">
        {/* Background Image */}
        {show.artist?.images?.[0] && (
          <div className="absolute inset-0 z-0">
            <img 
              src={show.artist.images[0]} 
              alt={show.artist.name}
              className="w-full h-full object-cover opacity-20 blur-sm scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/80" />
          </div>
        )}
        
        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 sm:gap-6 lg:gap-8">
            <div className="space-y-6 flex-1">
              {/* Artist Name and Status */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <button
                    onClick={() => onArtistClick(show.artistId)}
                    className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white hover:text-primary transition-colors text-left leading-tight"
                  >
                    {show.artist?.name}
                  </button>
                  <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-sm ${
                    isUpcoming 
                      ? isToday 
                        ? 'bg-green-500/30 text-green-300 border border-green-500/50' 
                        : 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                      : 'bg-gray-500/30 text-gray-300 border border-gray-500/50'
                  }`}>
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      isUpcoming ? (isToday ? 'bg-green-400' : 'bg-blue-400') : 'bg-gray-400'
                    }`} />
                    {isUpcoming ? (isToday ? 'Tonight' : 'Upcoming') : 'Completed'}
                  </div>
                </div>
                
                {/* Venue and Date Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 text-gray-300">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">{show.venue?.name}</div>
                      <div className="text-sm text-gray-400">{show.venue?.city}, {show.venue?.country}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-gray-300">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {showDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="text-sm text-gray-400">
                        {showDate.toLocaleDateString('en-US', { weekday: 'long' })}
                      </div>
                    </div>
                  </div>
                  
                  {show.startTime && (
                    <div className="flex items-center gap-3 text-gray-300">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <Clock className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{show.startTime}</div>
                        <div className="text-sm text-gray-400">Show Time</div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Additional Info */}
                <div className="flex flex-wrap gap-4">
                  {show.venue?.capacity && (
                    <div className="flex items-center gap-2 bg-white/5 rounded-lg p-3 backdrop-blur-sm">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-300">{show.venue.capacity.toLocaleString()} capacity</span>
                    </div>
                  )}
                  
                  {show.venue?.address && (
                    <div className="text-gray-400 bg-white/5 rounded-lg p-3 backdrop-blur-sm">
                      <div className="text-sm">{show.venue.address}</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4">
                {show.ticketUrl && (
                  <a 
                    href={show.ticketUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-6 py-3 bg-primary/20 hover:bg-primary/30 text-white rounded-xl font-medium transition-all duration-300 border border-primary/30 backdrop-blur-sm"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Get Tickets
                  </a>
                )}
              </div>
            </div>

            {/* Artist Image - Mobile Responsive */}
            {show.artist?.images?.[0] && (
              <div className="flex-shrink-0 self-center sm:self-start">
                <MagicCard className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 xl:w-64 xl:h-64 p-0 rounded-2xl overflow-hidden border-0 hover:border-white/30">
                  <img 
                    src={show.artist.images[0]} 
                    alt={show.artist.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                  <BorderBeam size={80} duration={12} className="opacity-0 hover:opacity-40 transition-opacity duration-500" />
                </MagicCard>
              </div>
            )}
          </div>
        </div>
        
        <BorderBeam size={200} duration={15} className="opacity-30" />
      </MagicCard>

      {/* Mobile-Responsive Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Setlist Section - Mobile First */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">


          {/* Enhanced Shared Setlist Display */}
          <MagicCard className="p-0 rounded-2xl border-0">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                    <Music className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">
                    {officialSetlist ? "Official Setlist" : "Vote on the Setlist"}
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  {(communitySetlist || officialSetlist) && (
                    <div className="text-base font-medium text-gray-300">
                      {(officialSetlist?.songs?.length || communitySetlist?.songs?.length || 0)} songs
                    </div>
                  )}
                  {communitySetlist && !officialSetlist && (
                    <div className="text-sm text-gray-400 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                      Community Predictions
                    </div>
                  )}
                </div>
              </div>

              {/* Song Addition Dropdown - Moved into setlist section */}
              {!officialSetlist && isUpcoming && songs && songs.length > 0 && (
                <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-white">Add Songs to Setlist</h3>
                    <div className="text-sm text-gray-400">
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
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-base text-white placeholder-gray-400 backdrop-blur-sm transition-all duration-300"
                  >
                    <option value="" disabled className="bg-background text-foreground text-base">
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
                      .sort((a, b) => a!.title.localeCompare(b!.title))
                      .map((song) => (
                        <option 
                          key={song!._id} 
                          value={song!.title}
                          className="bg-background text-foreground text-base"
                        >
                          {song!.title} {song!.album ? `• ${song!.album}` : ''}
                        </option>
                      ))
                    }
                  </select>
                  
                  <div className="mt-3 text-sm text-gray-400">
                    Songs are added instantly - no save button needed
                  </div>
                </div>
              )}
            
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
                      <h3 className="font-medium text-foreground text-base">{typeof songTitle === 'string' ? songTitle : songTitle?.title}</h3>
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
                <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300 font-medium">Click ↑ to vote for songs you want to hear</span>
                    <span className="text-gray-400">{communitySetlist.songs?.length || 0} songs • {((communitySetlist.upvotes || 0) + (communitySetlist.downvotes || 0))} total votes</span>
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
            <BorderBeam size={120} duration={10} className="opacity-20" />
          </MagicCard>
        </div>

        {/* Enhanced Sidebar - Mobile Responsive */}
        <div className="space-y-4 sm:space-y-6 lg:order-last">
          {/* Enhanced Venue Details */}
          <MagicCard className="p-0 rounded-2xl border-0">
            <div className="p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-white">Venue Details</h3>
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
            <BorderBeam size={100} duration={8} className="opacity-20" />
          </MagicCard>

          {/* Enhanced Show Stats */}
          <MagicCard className="p-0 rounded-2xl border-0">
            <div className="p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-white">Show Stats</h3>
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
            <BorderBeam size={100} duration={8} className="opacity-20" />
          </MagicCard>

          {/* Enhanced Call to Action */}
          {!user && (
            <MagicCard className="p-0 rounded-2xl border-0">
              <div className="p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                    <Vote className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Join the Voting</h3>
                </div>
                <p className="text-gray-300 mb-6">
                  Sign in to request unlimited songs and vote on others
                </p>
                <button
                  onClick={onSignInRequired}
                  className="w-full bg-primary/20 hover:bg-primary/30 text-white border border-primary/30 rounded-xl py-3 px-6 font-medium transition-all duration-300 backdrop-blur-sm"
                >
                  <Music className="h-4 w-4 mr-2 inline" />
                  Sign In to Vote
                </button>
              </div>
              <BorderBeam size={120} duration={10} className="opacity-30" />
            </MagicCard>
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