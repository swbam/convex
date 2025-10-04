import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import React, { useMemo, useState, useEffect } from "react";
import { ArrowLeft, MapPin, Users, Music, ChevronUp, Calendar, ExternalLink, Ticket, Vote, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { SEOHead } from "./SEOHead";
import { AnimatedSubscribeButton } from "./ui/animated-subscribe-button";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { ShimmerButton } from "./ui/shimmer-button";
import { buildTicketmasterAffiliateUrl } from "../utils/ticketmaster";
import { FadeIn } from "./animations/FadeIn";
import { Badge } from "./ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Vote as VoteIcon } from "lucide-react";
import { motion } from "framer-motion";

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
  const setlist = useQuery(api.setlists.getByShow, { showId }); // Assume exists
  const triggerSetlistSync = useAction(api.setlistfm.triggerSetlistSync); // For retry

  const addSongToSetlist = useMutation(api.setlists.addSongToSetlist);
  const voteOnSong = useMutation(api.songVotes.voteOnSong);

  const [anonId, setAnonId] = useState(() => {
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('anonId');
      if (!id) {
        id = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('anonId', id);
      }
      return id;
    }
    return 'anon_default';
  });

  const [hasVoted, setHasVoted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hasVoted') === 'true';
    }
    return false;
  });

  const [hasAdded, setHasAdded] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hasAdded') === 'true';
    }
    return false;
  });

  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasVoted', hasVoted.toString());
      localStorage.setItem('hasAdded', hasAdded.toString());
    }
  }, [hasVoted, hasAdded]);

  // Loading state
  const isLoading = !show;

  const predictionSetlist = useMemo(() => {
    if (!setlists) return null;
    const shared = setlists.find((s: any) => !s.isOfficial && !s.userId);
    if (shared) return shared;
    return setlists.find((s: any) => !s.isOfficial) ?? null;
  }, [setlists]);

  const actualSetlistRecord = useMemo(() => {
    if (!setlists) return null;
    const officialWithActual = setlists.find((s: any) => s.isOfficial && s.actualSetlist && s.actualSetlist.length > 0);
    if (officialWithActual) return officialWithActual;
    return setlists.find((s: any) => s.actualSetlist && s.actualSetlist.length > 0) ?? null;
  }, [setlists]);

  const actualSetlistSongs = actualSetlistRecord?.actualSetlist ?? [];
  const hasActualSetlist = actualSetlistSongs.length > 0;

  const predictedSongTitleSet = useMemo(() => {
    if (!predictionSetlist?.songs) {
      return new Set<string>();
    }
    const titles = (predictionSetlist.songs as any[])
      .map((song) => (typeof song === "string" ? song : song?.title))
      .filter((title: string | undefined): title is string => Boolean(title))
      .map((title) => title.toLowerCase().trim());
    return new Set<string>(titles);
  }, [predictionSetlist]);

  const actualSongTitleSet = useMemo(() => {
    if (!actualSetlistSongs.length) {
      return new Set<string>();
    }
    const titles = actualSetlistSongs
      .map((song: any) => song?.title)
      .filter((title: string | undefined): title is string => Boolean(title))
      .map((title) => title.toLowerCase().trim());
    return new Set<string>(titles);
  }, [actualSetlistSongs]);

  const predictionSetlistId = predictionSetlist?._id as Id<"setlists"> | undefined;

  const handleVoteAction = () => {
    if (hasVoted) {
      setShowAuthModal(true);
      return false;
    }
    setHasVoted(true);
    return true;
  };

  const handleAddAction = () => {
    if (hasAdded) {
      setShowAuthModal(true);
      return false;
    }
    setHasAdded(true);
    return true;
  };

  const handleAddSongToSharedSetlist = async (songTitle: string) => {
    if (!user && !handleAddAction()) return;

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
        ...( !user && { anonId } ),
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
  
  const renderSetlistHeader = () => {
    if (!show.importStatus) return <h3 className="text-xl font-bold mb-4">Setlist</h3>;
  
    let badgeContent;
    let icon;
    switch (show.importStatus) {
      case "completed":
        badgeContent = "Imported";
        icon = <CheckCircle className="h-4 w-4" />;
        break;
      case "importing":
        badgeContent = "Importing";
        icon = <Loader2 className="h-4 w-4 animate-spin" />;
        break;
      case "failed":
        badgeContent = "Failed";
        icon = <AlertCircle className="h-4 w-4" />;
        break;
      default:
        badgeContent = "Pending";
    }
  
    return (
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Setlist {show.importStatus !== "completed" && `(${badgeContent})`}</h3>
        <Badge variant={show.importStatus === "completed" ? "default" : "secondary"} className="flex items-center gap-1">
          {icon} {badgeContent}
        </Badge>
        {show.status === "completed" && show.importStatus !== "completed" && !hasActualSetlist && (
          <p className="text-sm text-gray-400 mt-2">No setlist available yet - checking...</p>
        )}
        {show.importStatus === "failed" && (
          <Button variant="outline" size="sm" onClick={() => triggerSetlistSync({
            showId: showId,
            artistName: show.artist?.name || "",
            venueCity: show.venue?.city || "",
            showDate: show.date,
          })}>
            Retry Import
          </Button>
        )}
      </div>
    );
  };
  
  return (
    <>
      <motion.div
        className="px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <SEOHead
          title={`${show?.artist?.name || 'Artist'} - ${show?.venue?.name || 'Venue'} on ${showDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - Vote on Setlist!`}
          description={`Vote on the predicted setlist for ${show?.artist?.name || 'Artist'}'s show at ${show?.venue?.name || 'Venue'}, ${show?.venue?.city || ''}, ${show?.venue?.country || ''} on ${showDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Join the community to influence the setlist!`}
          image={show?.artist?.images?.[0] || ''}
          url={`${window.location.origin}/shows/${show?.slug}`}
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
  
      {/* Revamped Show Header with Cover Photo Background */}
      <div className="relative overflow-hidden rounded-2xl">
        {/* Background Cover Image */}
        {show?.artist?.images?.[0] && (
          <div className="absolute inset-0 z-0">
            <img
              src={show.artist.images[0]}
              alt=""
              className="w-full h-full object-cover opacity-25 blur-md scale-110"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/85 to-black" />
          </div>
        )}
        
        {/* Content */}
        <div className="relative z-10 p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
            {/* Large Artist Profile Image */}
            {show?.artist?.images?.[0] && (
              <div className="flex-shrink-0">
                <img
                  src={show.artist.images[0]}
                  alt={show?.artist?.name}
                  className="w-32 h-32 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-2xl object-cover shadow-2xl border-4 border-black/50"
                />
              </div>
            )}
            
            {/* Show Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-300 mb-2 uppercase tracking-wider">Concert</p>
              <button
                onClick={() => { if (show?.artistId) onArtistClick(show.artistId); }}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white hover:text-primary transition-colors text-left mb-2 leading-tight"
              >
                {show?.artist?.name}
              </button>
              
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm sm:text-base text-gray-200 mb-4">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 sm:h-5 sm:h-5 flex-shrink-0" />
                  <span className="font-medium">{show?.venue?.name}</span>
                </div>
                <span className="text-gray-500">•</span>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="font-medium">
                    {showDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                {show?.startTime && (
                  <>
                    <span className="text-gray-500">•</span>
                    <span className="font-medium">{show?.startTime}</span>
                  </>
                )}
              </div>
              
              {/* Buy Tickets Button - Prominent for Upcoming Shows */}
              {isUpcoming && (
                <ShimmerButton
                  onClick={() => window.open(buildTicketmasterAffiliateUrl(show?.ticketUrl || ''), '_blank')}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white border-0 px-6 py-3 text-base font-semibold"
                  shimmerColor="#60a5fa"
                >
                  <Ticket className="h-5 w-5 mr-2" />
                  Get Tickets
                  <ExternalLink className="h-4 w-4 ml-2" />
                </ShimmerButton>
              )}

              {/* Share Buttons */}
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/shows/${show?.slug}?utm_source=setlistvote&utm_medium=share&utm_campaign=${encodeURIComponent(show?.artist?.name || '')}-${encodeURIComponent(show?.slug || '')}`;
                    const shareText = `Vote on the predicted setlist for ${show?.artist?.name || ''}'s show at ${show?.venue?.name || ''} on ${showDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}! Join the community at SetlistVote. ${shareUrl}`;
                    if (navigator.share) {
                      void navigator.share({
                        title: `${show?.artist?.name || ''} - Vote on Setlist!`,
                        text: shareText,
                        url: shareUrl,
                      });
                    } else {
                      void navigator.clipboard.writeText(shareText);
                      toast.success('Link copied to clipboard!');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M15 8a3 3 0 10-6.976 2.224 1 1 0 01.435.179l.341.056a1 1 0 01.179.435c.086.24.24.435.435.179A3 3 0 0115 8zM5.5 13a2.5 2.5 0 01-.121-.535l-.745 1.149A2.5 2.5 0 005.5 15h3.179a1 1 0 01.435.179 1 1 0 01.179.435l.056.341A2.5 2.5 0 019 15.5V13a1 1 0 11-2 0v1.5a1 1 0 01-1 1 1 1 0 00-.179-.435l-.056-.341A2.5 2.5 0 005.5 13z"/>
                  </svg>
                  Share
                </button>
                <button
            
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Main Setlist Section */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
  
        {/* Enhanced Shared Setlist Display - Apple Music Style (no side borders) */}
        <MagicCard className="p-0 rounded-2xl border-0 bg-black border-t border-b border-white/5">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <Music className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">
                  {hasActualSetlist ? "Official Setlist" : "Vote on the Setlist"}
                </h2>
              </div>
              <div className="flex items-center gap-4">
                {/* ENHANCED: Show import status for completed shows */}
                {!hasActualSetlist && show?.status === "completed" && show?.importStatus && (
                  <div className={`text-xs px-3 py-1.5 rounded-full backdrop-blur-sm ${
                    show?.importStatus === "importing" ? "bg-blue-500/20 text-blue-400" :
                    show?.importStatus === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                    show?.importStatus === "failed" ? "bg-red-500/20 text-red-400" :
                    "bg-green-500/20 text-green-400"
                  }`}>
                    {show?.importStatus === "importing" && "Syncing setlist..."}
                    {show?.importStatus === "pending" && "Setlist sync pending"}
                    {show?.importStatus === "failed" && "Setlist not found"}
                    {show?.importStatus === "completed" && "Setlist synced"}
                  </div>
                )}
                {(predictionSetlist || hasActualSetlist) && (
                  <div className="text-lg font-medium text-gray-300">
                    {hasActualSetlist
                      ? actualSetlistSongs.length
                      : predictionSetlist?.songs?.length || 0} songs
                  </div>
                )}
                {predictionSetlist && !hasActualSetlist && !show?.importStatus && (
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
                        const songTitles = predictionSetlist?.songs?.map((song: any) =>
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
                        const songTitles = predictionSetlist?.songs?.map((song: any) =>
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
                      <div className="text-2xl font-bold text-white">{actualSetlistSongs.length}</div>
                      <div className="text-xs text-gray-400">songs played</div>
                    </div>
                  </div>
  
                  <div className="space-y-3">
                    {actualSetlistSongs.map((song: any, index: number) => (
                      <ActualSetlistSongRow
                        key={`actual-${index}`}
                        song={song}
                        index={index}
                        predictionSetlistId={predictionSetlistId}
                        predictedSongTitleSet={predictedSongTitleSet}
                      />
                    ))}
                  </div>
                </div>
  
                {/* SECONDARY: Complete Fan Requests with Vote Counts */}
                {predictionSetlist && predictionSetlist.songs && predictionSetlist.songs.length > 0 && (
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
                        <div className="text-lg font-bold text-white">{predictionSetlist.songs.length}</div>
                        <div className="text-xs text-gray-400">songs requested</div>
                      </div>
                    </div>
  
                    <div className="space-y-2">
                      {(predictionSetlist.songs || [])
                        .map((s: any) => (typeof s === 'string' ? s : s?.title))
                        .filter(Boolean)
                        .map((songTitle: string, index: number) => (
                          <FanRequestSongRow
                            key={`request-${songTitle}-${index}`}
                            songTitle={songTitle}
                            index={index}
                            predictionSetlistId={predictionSetlistId}
                            actualSongTitleSet={actualSongTitleSet}
                            user={user}
                            voteOnSong={voteOnSong}
                            handleVoteAction={handleVoteAction}
                            setShowAuthModal={setShowAuthModal}
                            anonId={anonId}
                          />
                        ))}
                    </div>
                  </div>
                )}
                
                {/* Accuracy Summary */}
                {predictionSetlist && predictionSetlist.songs && predictionSetlist.songs.length > 0 && (
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
                              const total = predictionSetlist.songs.length;
                              if (total === 0) return '—';
                              const correct = predictionSetlist.songs.filter((s: any) => {
                                const songTitle = typeof s === 'string' ? s : s?.title;
                                if (!songTitle) return false;
                                return actualSongTitleSet.has(songTitle.toLowerCase().trim());
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
            ) : (!predictionSetlist || predictionSetlist.songs.length === 0) ? (
  // No songs in shared setlist yet
  <div className="text-center py-12 text-muted-foreground">
    <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
    <p className="text-lg font-medium">No songs in the setlist yet</p>
    <p className="text-sm mt-1">Use the dropdown above to add the first song!</p>
  </div>
) : (
              <div className="mt-8 touch-manipulation">
                <div className="flex flex-col">
                  {renderSetlistHeader()}

                  {/* Setlist shown by default - no accordion */}
                  <div className="space-y-0 mt-6">
                    {(predictionSetlist.songs || [])
                      .map((s: any) => (typeof s === 'string' ? s : s?.title))
                      .filter(Boolean)
                      .map((songTitle: string, index: number) => (
                        <FanRequestSongRow
                          key={`setlist-song-${songTitle}-${index}`}
                          songTitle={songTitle}
                          index={index}
                          predictionSetlistId={predictionSetlist._id}
                          actualSongTitleSet={actualSongTitleSet}
                          user={user}
                          voteOnSong={voteOnSong}
                          handleVoteAction={handleVoteAction}
                          setShowAuthModal={setShowAuthModal}
                          anonId={anonId}
                        />
                      ))}
                  </div>
                </div>
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
                  <div className="font-medium text-white">{show?.venue?.name}</div>
                  <div className="text-sm text-gray-400">
                    {show?.venue?.city}, {show?.venue?.country}
                  </div>
                </div>
                
                {show?.venue?.capacity && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-white">{show?.venue?.capacity?.toLocaleString()} capacity</span>
                  </div>
                )}
                
                {show?.venue?.address && (
                  <div className="text-sm text-gray-400">
                    {show?.venue?.address}
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
                    {hasActualSetlist ? actualSetlistSongs.length : predictionSetlist?.songs?.length || 0}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Studio songs available</span>
                  <span className="font-medium text-white">{songs?.filter(Boolean).filter(s => s && !s.isLive && !s.isRemix).length || 0}</span>
                </div>
                
                {predictionSetlist && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Total votes</span>
                      <span className="font-medium text-white">
                        {((predictionSetlist.upvotes || 0) + (predictionSetlist.downvotes || 0))}
                      </span>
                    </div>
  
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Setlist upvotes</span>
                      <span className="font-medium text-white">{predictionSetlist.upvotes || 0}</span>
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
    </motion.div>
  
    {/* Auth Modal for Unauth Limits */}
    <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
      <DialogContent className="bg-black border-white/10 text-white max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Unlock More Actions</DialogTitle>
          <DialogDescription className="text-gray-300">
            You've used your free action. Sign up to vote on more songs and create setlists!
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAuthModal(false)}>
            Later
          </Button>
          <Button onClick={() => { setShowAuthModal(false); onSignInRequired(); }}>
            Sign Up Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}

function FanRequestSongRow({
  songTitle,
  index,
  predictionSetlistId,
  actualSongTitleSet,
  user,
  voteOnSong,
  handleVoteAction,
  setShowAuthModal,
  anonId,
}: {
  songTitle: string;
  index: number;
  predictionSetlistId?: Id<"setlists">;
  actualSongTitleSet: Set<string>;
  user: any;
  voteOnSong: any;
  handleVoteAction: () => boolean;
  setShowAuthModal: (show: boolean) => void;
  anonId: string;
}) {
  const normalizedTitle = songTitle.toLowerCase().trim();
  const wasPlayed = actualSongTitleSet.has(normalizedTitle);

  // Get real vote count
  const songVotes = useQuery(
    api.songVotes.getSongVotes,
    predictionSetlistId
      ? {
          setlistId: predictionSetlistId,
          songTitle,
        }
      : "skip"
  );
  
  const voteCount = songVotes?.upvotes || 0;
  const userVoted = songVotes?.userVoted || false;

  const handleVote = async () => {
    if (!predictionSetlistId) return;

    if (!user) {
      if (!handleVoteAction()) {
        setShowAuthModal(true);
        return;
      }
      // For anonymous, still call mutation if backend supports
      try {
        await voteOnSong({
          setlistId: predictionSetlistId,
          songTitle,
          voteType: "upvote",
          anonId,
        });
        toast.success("Vote added!");
      } catch (e) {
        toast.error("Vote failed");
      }
      return;
    }

    try {
      await voteOnSong({
        setlistId: predictionSetlistId,
        songTitle,
        voteType: "upvote",
      });
      toast.success("Vote added!");
    } catch (e) {
      toast.error("Vote failed");
    }
  };
  
  return (
    <div
      className="flex items-center justify-between py-3 px-0 hover:bg-white/5 transition-all duration-200 min-h-[44px]"
      style={{
        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Minimal status indicator */}
        {wasPlayed ? (
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <span className="text-xs text-gray-500 w-5 text-center font-medium">{index + 1}</span>
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium text-sm ${
            wasPlayed ? 'text-white' : 'text-gray-300'
          } truncate`}>
            {songTitle}
          </h3>
          {wasPlayed && (
            <p className="text-xs text-green-400">Played</p>
          )}
        </div>
      </div>
      
      {/* Reddit-style upvote icon + count below - now clickable */}
      {!wasPlayed && (
        <button
          onClick={() => { void handleVote(); }}
          className={`flex flex-col items-center gap-0.5 text-sm transition-colors ${
            userVoted ? 'text-primary' : 'text-gray-500 hover:text-white'
          }`}
        >
          <ChevronUp className={`h-4 w-4 ${userVoted ? 'fill-current' : ''}`} />
          <span className={`font-semibold text-xs ${
            userVoted ? 'text-primary' : 'text-gray-400'
          }`}>
            {voteCount}
          </span>
        </button>
      )}
      {wasPlayed && (
        <div className="flex flex-col items-center gap-0.5 text-sm text-green-400">
          <ChevronUp className="h-4 w-4 fill-current" />
          <span className="font-semibold text-xs">{voteCount}</span>
        </div>
      )}
    </div>
  );
}

// Actual setlist song row component
function ActualSetlistSongRow({
  song,
  index,
  predictionSetlistId,
  predictedSongTitleSet,
}: {
  song: any;
  index: number;
  predictionSetlistId?: Id<"setlists">;
  predictedSongTitleSet: Set<string>;
}) {
  const normalizedTitle = (song?.title ?? "").toLowerCase().trim();
  const wasRequested = normalizedTitle.length > 0 && predictedSongTitleSet.has(normalizedTitle);

  // Get real vote count if the song was requested
  const songVotes = useQuery(
    api.songVotes.getSongVotes,
    wasRequested && predictionSetlistId
      ? { setlistId: predictionSetlistId, songTitle: song.title }
      : "skip"
  );
  
  const voteCount = songVotes?.upvotes || 0;
  
  return (
    <div
      className={`flex items-center justify-between py-3 px-0 transition-all duration-200 min-h-[44px] ${
        wasRequested ? 'bg-green-500/5' : ''
      }`}
      style={{
        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className={`text-sm font-semibold w-6 text-center ${
          wasRequested ? 'text-green-400' : 'text-gray-500'
        }`}>
          {index + 1}
        </span>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm sm:text-base text-white truncate">{song.title}</h3>
          {song.album && (
            <p className="text-xs text-gray-400 truncate">{song.album}</p>
          )}
        </div>
      </div>
      
      {/* Clean badges - upvote display only, no click for past shows */}
      <div className="flex items-center gap-2">
        {song.encore && (
          <span className="bg-yellow-500/10 text-yellow-400 text-xs font-medium px-2 py-0.5 rounded-full">
            Encore
          </span>
        )}
        
        {wasRequested && voteCount > 0 && (
          <div className="flex flex-col items-center gap-0.5 text-green-400">
            <ChevronUp className="h-3.5 w-3.5 fill-current" />
            <span className="text-xs font-semibold">{voteCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Individual Song in Shared Setlist with Always-Visible Voting - ENHANCED: Cleaner, simpler UI
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
    } catch {
      toast.error("Failed to vote");
    }
  };

  return (
    <div 
      className="flex items-center justify-between py-3 px-0 hover:bg-white/5 transition-all duration-200 group min-h-[44px]"
      style={{
        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-xs text-gray-500 w-6 text-right font-medium">
          {position}
        </span>
        <span className="font-medium text-sm sm:text-base text-white truncate">{songTitle}</span>
      </div>
      
      {/* ENHANCED: Minimal upvote button - just icon and number, no border/background */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          void handleSongVote();
        }}
        className={`flex items-center gap-1.5 px-2 py-1 transition-all duration-200 min-h-[44px] ${
          songVotes?.userVoted 
            ? 'text-primary' 
            : 'text-gray-500 hover:text-white'
        }`}
      >
        <ChevronUp className={`h-5 w-5 ${songVotes?.userVoted ? 'fill-current' : ''}`} />
        <span className="font-semibold text-sm">{songVotes?.upvotes || 0}</span>
      </button>
    </div>
  );
}
