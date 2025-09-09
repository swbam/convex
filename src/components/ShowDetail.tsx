import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import React, { useState } from "react";
import { ArrowLeft, MapPin, Users, Music, ChevronUp, Heart, Vote } from "lucide-react";
import { toast } from "sonner";
import { SEOHead } from "./SEOHead";
import { AnimatedSubscribeButton } from "./ui/animated-subscribe-button";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
// import { ShimmerButton } from "./ui/shimmer-button";

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
  
  // Check if community setlist has actual setlist data from setlist.fm
  const hasActualSetlist = communitySetlist?.actualSetlist && communitySetlist.actualSetlist.length > 0;

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
      <div className="px-4 sm:px-6 py-8">
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
    <div className="px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8 relative z-10">
      <SEOHead
        title={`${show.artist?.name || 'Artist'} @ ${show.venue?.name || 'Venue'} – ${showDate.toLocaleDateString('en-US')} | setlists.live`}
        description={`Details for ${show.artist?.name} at ${show.venue?.name} on ${showDate.toLocaleDateString('en-US')}. View setlists and vote.`}
        image={show.artist?.images?.[0]}
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

      {/* Clean Apple-Style Show Header */}
      <MagicCard className="relative overflow-hidden rounded-xl p-0 border-0 bg-black">
        <div className="relative z-10 p-3 sm:p-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Compact Artist Image */}
            {show.artist?.images?.[0] && (
              <div className="flex-shrink-0">
                <img
                  src={show.artist.images[0]}
                  alt={show.artist.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover"
                />
              </div>
            )}
            
            {/* Show Info - Clean Typography */}
            <div className="flex-1 min-w-0">
              <button
                onClick={() => onArtistClick(show.artistId)}
                className="text-xl sm:text-2xl lg:text-3xl font-bold text-white hover:text-primary transition-colors text-left truncate block"
              >
                {show.artist?.name}
              </button>
              <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{show.venue?.name}</span>
                <span>•</span>
                <span className="truncate">
                  {showDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
            
            {/* Status Badge - Minimal */}
            {isToday && (
              <div className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-semibold">
                Tonight
              </div>
            )}
          </div>
        </div>
      </MagicCard>

      {/* Two-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Main Setlist Section */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">


          {/* Enhanced Shared Setlist Display with Better Border */}
          <MagicCard className="p-0 rounded-2xl border border-white/10">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <Music className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">
                    {officialSetlist ? "Official Setlist" : "Vote on the Setlist"}
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  {(communitySetlist || officialSetlist) && (
                    <div className="text-lg font-medium text-gray-300">
                      {(officialSetlist?.songs?.length || communitySetlist?.songs?.length || 0)} songs
              </div>
            )}
                  {communitySetlist && !officialSetlist && (
                    <div className="text-sm text-gray-400 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
                      Community Predictions
            </div>
          )}
        </div>
      </div>

              {/* Song Addition Dropdown - Improved Design */}
              {!hasActualSetlist && isUpcoming && songs && songs.length > 0 && (
                <div className="mb-6 p-4 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">Add Songs to Setlist</h3>
                    <div className="text-sm text-gray-300">
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
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-base sm:text-lg text-white placeholder-gray-400 backdrop-blur-sm transition-all duration-300 cursor-pointer"
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
                          className="bg-background text-foreground text-base sm:text-lg py-2"
                        >
                          {song!.title} {song!.album ? `• ${song!.album}` : ''}
                        </option>
                      ))
                    }
                  </select>
                  
                  <div className="mt-3 text-sm text-gray-300 font-medium">
                    <ChevronUp className="inline h-4 w-4 mr-1" />
                    Songs are added instantly - no save button needed
                  </div>
                </div>
              )}
            
            {hasActualSetlist ? (
              // Post-Show: Actual Setlist as Primary Content
              <div className="space-y-8">
                {/* MAIN: Actual Setlist Performed */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">What Actually Happened</h2>
                        <p className="text-green-400 text-sm">Official setlist from setlist.fm</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{communitySetlist.actualSetlist?.length || 0}</div>
                      <div className="text-xs text-gray-400">songs played</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {(communitySetlist.actualSetlist || []).map((song: any, index: number) => (
                      <ActualSetlistSongRow
                        key={`actual-${index}`}
                        song={song}
                        index={index}
                        communitySetlist={communitySetlist}
                        setlistId={communitySetlist._id}
                      />
                    ))}
                  </div>
                </div>

                {/* SECONDARY: Complete Fan Requests with Vote Counts */}
                {communitySetlist && communitySetlist.songs && communitySetlist.songs.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">All Fan Requests</h2>
                          <p className="text-blue-400 text-sm">Complete voting results</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-white">{communitySetlist.songs.length}</div>
                        <div className="text-xs text-gray-400">songs requested</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {(communitySetlist.songs || [])
                        .map((s: any) => (typeof s === 'string' ? s : s?.title))
                        .filter(Boolean)
                        .map((songTitle: string, index: number) => (
                          <FanRequestSongRow
                            key={`request-${songTitle}-${index}`}
                            songTitle={songTitle}
                            index={index}
                            communitySetlist={communitySetlist}
                            setlistId={communitySetlist._id}
                          />
                        ))}
                    </div>
                  </div>
                )}
                
                {/* Accuracy Summary */}
                {communitySetlist && communitySetlist.songs && communitySetlist.songs.length > 0 && (
                  <div className="mt-6">
                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white">Fan Prediction Accuracy</h3>
                            <p className="text-purple-400 text-sm">How well did the community predict?</p>
              </div>
            </div>
            
                        <div className="text-right">
                          <div className="text-3xl font-bold text-purple-400">
                            {(() => {
                              const total = (communitySetlist.songs || []).length || 0;
                              if (total === 0) return '—';
                              const correct = (communitySetlist.songs || []).filter((s: any) => {
                                const songTitle = typeof s === 'string' ? s : s?.title;
                                return (communitySetlist.actualSetlist || []).some((actualSong: any) => actualSong.title === songTitle);
                              }).length;
                              const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                              return `${pct}%`;
                            })()}
                          </div>
                          <div className="text-xs text-gray-400">accuracy rate</div>
                  </div>
                </div>
                    </div>
                  </div>
                )}
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

                        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Venue Details */}
          <MagicCard className="p-0 rounded-2xl border-0">
            <div className="p-4 sm:p-6 bg-black">
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-white">Venue Details</h3>
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-white">{show.venue?.name}</div>
                  <div className="text-sm text-gray-400">
                    {show.venue?.city}, {show.venue?.country}
                  </div>
                </div>
                
                {show.venue?.capacity && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-white">{show.venue.capacity.toLocaleString()} capacity</span>
                  </div>
                )}
                
                {show.venue?.address && (
                  <div className="text-sm text-gray-400">
                    {show.venue.address}
                  </div>
                )}
              </div>
            </div>
            <BorderBeam size={100} duration={8} className="opacity-20" />
          </MagicCard>

          {/* Show Stats */}
          <MagicCard className="p-0 rounded-2xl border-0">
            <div className="p-4 sm:p-6 bg-black">
              <h3 className="text-lg sm:text-xl font-bold mb-4 text-white">Show Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Songs {hasActualSetlist ? 'played' : 'in setlist'}</span>
                  <span className="font-medium text-white">
                    {hasActualSetlist ? communitySetlist.actualSetlist?.length || 0 : communitySetlist?.songs?.length || 0}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Studio songs available</span>
                  <span className="font-medium text-white">{songs?.filter(Boolean).filter(s => s && !s.isLive && !s.isRemix).length || 0}</span>
                </div>
                
                {communitySetlist && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Total votes</span>
                      <span className="font-medium text-white">
                        {((communitySetlist.upvotes || 0) + (communitySetlist.downvotes || 0))}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Setlist upvotes</span>
                      <span className="font-medium text-white">{communitySetlist.upvotes || 0}</span>
                    </div>
                  </>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Show status</span>
                  <span className="font-medium text-white capitalize">{show.status}</span>
                </div>
              </div>
            </div>
            <BorderBeam size={100} duration={8} className="opacity-20" />
          </MagicCard>

          {/* Call to Action - Only for upcoming shows */}
          {!user && isUpcoming && (
            <MagicCard className="p-0 rounded-2xl border-0">
              <div className="p-6 text-center bg-black">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                    <Vote className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Join the Voting</h3>
                </div>
                <p className="text-gray-300 mb-6">
                  Sign in to request songs and vote on setlists
                </p>
                <button
                  onClick={onSignInRequired}
                  className="w-full bg-primary/20 hover:bg-primary/30 text-white border border-primary/30 rounded-xl py-3 px-6 font-medium transition-all duration-300"
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

      {/* Sticky mobile CTA for primary action */}
      {isUpcoming && (
        <div className="sm:hidden fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40">
          <button
            onClick={onSignInRequired}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground shadow-lg"
          >
            Vote on Setlist
          </button>
        </div>
      )}
    </div>
  );
}

// Fan request song row component
function FanRequestSongRow({
  songTitle,
  index,
  communitySetlist,
  setlistId
}: {
  songTitle: string;
  index: number;
  communitySetlist: any;
  setlistId: Id<"setlists">;
}) {
  const wasPlayed = (communitySetlist.actualSetlist || []).some(
    (actualSong: any) => actualSong.title === songTitle
  );
  
  // Get real vote count
  const songVotes = useQuery(api.songVotes.getSongVotes, { 
    setlistId, 
    songTitle 
  });
  
  const voteCount = songVotes?.upvotes || 0;
  
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
        wasPlayed 
          ? 'bg-green-500/10 border-green-500/20' 
          : 'bg-white/5 border-white/10'
      }`}
    >
      {/* Status Icon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
        wasPlayed 
          ? 'bg-green-500/20' 
          : 'bg-gray-500/20'
      }`}>
        {wasPlayed ? (
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      
      {/* Song Info */}
      <div className="flex-1">
        <h3 className={`font-semibold text-base ${
          wasPlayed ? 'text-white' : 'text-gray-300'
        }`}>
          {songTitle}
        </h3>
        <p className={`text-sm ${
          wasPlayed ? 'text-green-400' : 'text-gray-500'
        }`}>
          {wasPlayed ? 'Played in setlist' : 'Not played'}
        </p>
      </div>
      
      {/* Vote Count */}
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
        wasPlayed 
          ? 'bg-green-500/20' 
          : 'bg-white/10'
      }`}>
        <Heart className={`h-4 w-4 ${
          wasPlayed ? 'text-green-400' : 'text-gray-400'
        } fill-current`} />
        <span className={`font-bold text-sm ${
          wasPlayed ? 'text-green-400' : 'text-gray-400'
        }`}>
          {voteCount}
        </span>
      </div>
      
      {/* Rank Badge for High-Voted Songs */}
      {voteCount > 10 && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          wasPlayed 
            ? 'bg-yellow-500/20 text-yellow-400' 
            : 'bg-orange-500/20 text-orange-400'
        }`}>
          TOP {index + 1}
        </span>
      )}
    </div>
  );
}

// Actual setlist song row component
function ActualSetlistSongRow({
  song,
  index,
  communitySetlist,
  setlistId
}: {
  song: any;
  index: number;
  communitySetlist: any;
  setlistId: Id<"setlists">;
}) {
  // Check if this song was requested by fans
  const wasRequested = (communitySetlist.songs || []).some(
    (requestedSong: any) => (typeof requestedSong === 'string' ? requestedSong : requestedSong?.title) === song.title
  );
  
  // Get real vote count if the song was requested
  const songVotes = useQuery(api.songVotes.getSongVotes, 
    wasRequested ? { setlistId, songTitle: song.title } : 'skip'
  );
  
  const voteCount = songVotes?.upvotes || 0;
  
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
        wasRequested 
          ? 'bg-green-500/10 border-green-500/20' 
          : 'bg-white/5 border-white/10'
      }`}
    >
      <div className="w-8 h-8 bg-green-500/20 text-center rounded-full flex items-center justify-center text-sm font-bold text-green-400">
        {index + 1}
      </div>
      
      <div className="flex-1">
        <h3 className="font-semibold text-white text-lg sm:text-xl">{song.title}</h3>
        {song.album && (
          <p className="text-sm sm:text-base text-gray-400">{song.album}</p>
        )}
      </div>
      
      {/* Real Vote Count for Requested Songs */}
      {wasRequested && voteCount > 0 && (
        <div className="flex items-center gap-2 bg-green-500/20 rounded-lg px-3 py-2">
          <Heart className="h-4 w-4 text-green-400 fill-current" />
          <span className="text-green-400 font-semibold text-sm">{voteCount}</span>
        </div>
      )}

      {/* Encore Badge */}
      {song.encore && (
        <span className="bg-yellow-500/20 text-yellow-400 text-xs font-semibold px-3 py-1 rounded-full">
          Encore
        </span>
      )}
      
      {/* Fan Favorite Badge */}
      {wasRequested && voteCount >= 10 && (
        <span className="bg-green-500/20 text-green-400 text-xs font-semibold px-3 py-1 rounded-full">
          Fan Favorite
        </span>
      )}
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
    <div className="flex items-center justify-between py-3.5 px-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all duration-200 group">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 bg-primary/20 text-center rounded-full flex items-center justify-center text-sm font-semibold text-primary">
          {position}
        </div>
        <span className="font-medium text-base sm:text-lg text-white truncate">{songTitle}</span>
      </div>
      
      {/* Always-visible vote button with count */}
      <AnimatedSubscribeButton
        subscribeStatus={songVotes?.userVoted || false}
        onClick={() => void handleSongVote()}
        className="ml-3 h-8 sm:h-9 min-w-[70px] text-sm sm:text-base"
      >
        <span className="flex items-center gap-1.5">
          <ChevronUp className="h-4 w-4" />
          <span className="font-semibold">{songVotes?.upvotes || 0}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Heart className="h-4 w-4 fill-current" />
          <span className="font-semibold">{songVotes?.upvotes || 0}</span>
        </span>
      </AnimatedSubscribeButton>
    </div>
  );
}