import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import React, { useMemo, useState, useEffect } from "react";
import {
  MapPin,
  Users,
  Music,
  ChevronUp,
  Calendar,
  Ticket,
  Vote,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { SEOHead } from "./SEOHead";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { buildTicketmasterAffiliateUrl } from "../utils/ticketmaster";
import { Badge } from "./ui/badge";
import { motion } from "framer-motion";
import { SongCombobox } from "./SongCombobox";

interface ShowDetailProps {
  showId: Id<"shows">;
  onBack: () => void;
  onArtistClick: (artistId: Id<"artists">) => void;
  onSignInRequired: () => void;
}

export function ShowDetail({
  showId,
  onArtistClick,
  onSignInRequired,
}: ShowDetailProps) {
  const show = useQuery(api.shows.getById, { id: showId });
  const songs = useQuery(
    api.songs.getByArtist,
    show?.artistId
      ? {
          artistId: show.artistId,
          limit: 100,
        }
      : "skip"
  );
  const setlists = useQuery(api.setlists.getByShow, show ? { showId } : "skip");
  const user = useQuery(api.auth.loggedInUser);
  const triggerSetlistSync = useAction(api.setlistfm.triggerSetlistSync);
  const ensureAutoSetlist = useAction(api.setlists.ensureAutoSetlistForShow);
  const fetchArtistImages = useAction(api.media.getArtistImages);

  // Dynamic media selection (Ticketmaster hero, Spotify avatar)
  const [heroImage, setHeroImage] = React.useState<string | undefined>(undefined);
  const [avatarImage, setAvatarImage] = React.useState<string | undefined>(undefined);
  const [spotifyLink, setSpotifyLink] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    const artistId = show?.artistId as Id<"artists"> | undefined;
    if (!artistId) return;
    void (async () => {
      try {
        const res = await fetchArtistImages({ artistId });
        if (res) {
          setHeroImage(res.heroUrl || undefined);
          setAvatarImage(res.avatarUrl || undefined);
          setSpotifyLink(res.spotifyUrl || undefined);
        }
      } catch {
        // ignore
      }
    })();
  }, [show?.artistId, fetchArtistImages]);

  const addSongToSetlist = useMutation(api.setlists.addSongToSetlist);
  const voteOnSong = useMutation(api.songVotes.voteOnSong);

  const [anonId] = useState(() => {
    if (typeof window !== "undefined") {
      let id = localStorage.getItem("anonId");
      if (!id) {
        id =
          "anon_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substr(2, 9);
        localStorage.setItem("anonId", id);
      }
      return id;
    }
    return "anon_default";
  });

  const [hasVoted, setHasVoted] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hasVoted") === "true";
    }
    return false;
  });

  const [hasAdded, setHasAdded] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hasAdded") === "true";
    }
    return false;
  });

  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hasVoted", hasVoted.toString());
      localStorage.setItem("hasAdded", hasAdded.toString());
    }
  }, [hasVoted, hasAdded]);


  const predictionSetlist = useMemo(() => {
    if (!setlists) return null;
    const shared = setlists.find((s: any) => !s.isOfficial && !s.userId);
    if (shared) return shared;
    return setlists.find((s: any) => !s.isOfficial) ?? null;
  }, [setlists]);

  const actualSetlistRecord = useMemo(() => {
    if (!setlists) return null;
    const officialWithActual = setlists.find(
      (s: any) => s.isOfficial && s.actualSetlist && s.actualSetlist.length > 0
    );
    if (officialWithActual) return officialWithActual;
    return (
      setlists.find(
        (s: any) => s.actualSetlist && s.actualSetlist.length > 0
      ) ?? null
    );
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

  const predictionSetlistId = predictionSetlist?._id as
    | Id<"setlists">
    | undefined;

  // Simple analytics
  const catalogCount = songs?.length || 0;
  const predictedCount = predictionSetlist?.songs?.length || 0;
  const catalogCoverage = catalogCount
    ? Math.round((predictedCount / catalogCount) * 100)
    : 0;

  // Memoize song items for combobox (moved from JSX to fix hooks rules violation)
  const songComboboxItems = useMemo(() => {
    if (!songs || songs.length === 0) return [];
    const seen = new Set<string>();
    return (songs || [])
      .filter(Boolean)
      // Exclude remixes and live variants
      .filter((s: any) => !s?.isRemix && !s?.isLive)
      // Deduplicate by normalized title
      .filter((s: any) => {
        const t = (s?.title || "").toString();
        const norm = t
          .toLowerCase()
          .replace(/\s*\(.*?\)\s*/g, " ")
          .replace(/\s+-\s+.*$/, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (seen.has(norm)) return false;
        seen.add(norm);
        return true;
      })
      .map((s: any) => {
        const title = s.title as string;
        const disabled =
          predictedSongTitleSet.has(
            (title || "").toLowerCase().trim()
          ) || false;
        return {
          id: s._id,
          title,
          album: s.album || null,
          disabled,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [songs, predictedSongTitleSet]);

  // Ensure a 5-song initial setlist exists (no-op if already present)
  React.useEffect(() => {
    if (!showId) return;
    if (!setlists) return; // wait for load
    const hasSongs = !!predictionSetlist && Array.isArray(predictionSetlist.songs) && predictionSetlist.songs.length > 0;
    if (!hasSongs) {
      void ensureAutoSetlist({ showId });
    }
  }, [showId, setlists, predictionSetlist, ensureAutoSetlist]);

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
      const selectedSong = songs?.find((s) => s?.title === songTitle);
      if (!selectedSong) return;

      await addSongToSetlist({
        showId,
        song: {
          title: selectedSong.title,
          album: selectedSong.album,
          duration: selectedSong.durationMs,
          songId: selectedSong._id,
        },
        ...(!user && { anonId }),
      });

      toast.success(`Added "${songTitle}" to the setlist`);
    } catch {
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

  const renderSetlistHeader = () => {
    if (!show.importStatus)
      return <h3 className="text-xl font-bold mb-4">Setlist</h3>;

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
        <h3 className="text-xl font-bold">
          Setlist {show.importStatus !== "completed" && `(${badgeContent})`}
        </h3>
        <Badge
          variant={show.importStatus === "completed" ? "default" : "secondary"}
          className="flex items-center gap-1"
        >
          {icon} {badgeContent}
        </Badge>
        {show.status === "completed" &&
          show.importStatus !== "completed" &&
          !hasActualSetlist && (
            <p className="text-sm text-gray-400 mt-2">
              No setlist available yet - checking...
            </p>
          )}
        {show.importStatus === "failed" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void triggerSetlistSync({
                showId: showId,
                artistName: show.artist?.name || "",
                venueCity: show.venue?.city || "",
                showDate: show.date,
              });
            }}
          >
            Retry Import
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <motion.div
        className="space-y-4 sm:space-y-6 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <SEOHead />

        {/* Hero Header - Compact, full width */}
        <div className="relative w-full overflow-hidden bg-card">
          {heroImage && (
            <div className="absolute inset-0 z-0">
              <img src={heroImage} alt="" className="w-full h-full object-cover opacity-20 dark:opacity-30 blur-sm scale-105" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/60 dark:from-black/90 dark:via-black/70 dark:to-black/50" />
            </div>
          )}

          <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
            <div className="flex flex-row items-center gap-4 sm:gap-6 max-w-6xl mx-auto">
              {/* Profile Image */}
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
                      src={avatarImage || heroImage}
                      alt={show?.artist?.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-lg object-cover shadow-lg ring-1 ring-border"
                    />
                  </a>
                </div>
              )}

              {/* Show Info */}
              <div className="flex-1 min-w-0">
                {/* Artist Name - clickable */}
                <button
                  onClick={() => {
                    if (show?.artistId) onArtistClick(show.artistId);
                  }}
                  className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground hover:text-primary transition-colors leading-tight tracking-tight text-left line-clamp-1"
                >
                  {show?.artist?.name}
                </button>

                {/* Venue & Date - single line */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-1">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                    <span className="truncate max-w-[120px] sm:max-w-none">{show?.venue?.name}</span>
                  </div>
                  <span className="text-muted-foreground/40">•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                    <span>
                      {showDate.toLocaleDateString("en-US", { weekday: 'short', month: "short", day: "numeric" })}
                      {show?.startTime && ` • ${(() => {
                        const [hours, minutes] = show.startTime.split(':');
                        const hour = parseInt(hours);
                        const ampm = hour >= 12 ? 'PM' : 'AM';
                        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                        return `${displayHour}:${minutes} ${ampm}`;
                      })()}`}
                    </span>
                  </div>
                </div>
                
                {/* Get Tickets - inline on all sizes */}
                {isUpcoming && show?.ticketUrl && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() =>
                        window.open(
                          buildTicketmasterAffiliateUrl(show.ticketUrl || ""),
                          "_blank"
                        )
                      }
                      className="inline-flex items-center px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md text-xs transition-all"
                    >
                      <Ticket className="h-3 w-3 mr-1" />
                      Get Tickets
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="container mx-auto px-0 sm:px-6 pb-4 sm:pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 sm:gap-6 lg:gap-8">
          
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            
            <MagicCard className="p-0 rounded-none sm:rounded-2xl border-0 bg-card border-t border-b border-border sm:border">
              <div className="px-4 py-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                      <Music className="h-5 w-5 text-foreground" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Setlist</h2>
                  </div>
                </div>

                {/* Song Addition: Combined Search + Dropdown */}
                {!hasActualSetlist && isUpcoming && songs && songs.length > 0 && (
                  <div className="mb-4">
                    <SongCombobox
                      disabled={false}
                      placeholder={
                        user 
                          ? "Add a song..." 
                          : hasAdded 
                            ? "Sign in to add more songs" 
                            : "Add a song (1 free action)"
                      }
                      items={songComboboxItems}
                      onSelect={(title) => {
                        void handleAddSongToSharedSetlist(title);
                      }}
                    />
                  </div>
                )}

                {hasActualSetlist ? (
                  <div className="space-y-6">
                    {/* MAIN: Actual Setlist Performed - Clean integrated design */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                              Official Setlist
                            </h2>
                            <p className="text-green-400 text-sm">
                              from setlist.fm • {(() => {
                                const predicted = actualSetlistSongs.filter((song: any) =>
                                  predictedSongTitleSet.has((song?.title ?? "").toLowerCase().trim())
                                ).length;
                                return `${predicted}/${actualSetlistSongs.length} predicted`;
                              })()}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-2xl font-bold text-foreground">
                            {actualSetlistSongs.length}
                          </div>
                          <div className="text-xs text-gray-400">
                            songs played
                          </div>
                        </div>
                      </div>

                      {/* Actual setlist with integrated vote counts */}
                      <div className="space-y-2">
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

                    {/* Accuracy Summary */}
                    {predictionSetlist &&
                      predictionSetlist.songs &&
                      predictionSetlist.songs.length > 0 && (
                        <div className="mt-6">
                          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                  <svg
                                    className="w-5 h-5 text-purple-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="text-lg font-bold text-foreground">
                                    Fan Prediction Accuracy
                                  </h3>
                                  <p className="text-purple-400 text-sm">
                                    How well did the community predict?
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-3xl font-bold text-purple-400">
                                  {(() => {
                                    const total =
                                      predictionSetlist.songs.length;
                                    if (total === 0) return "—";
                                    const correct = predictionSetlist.songs.filter(
                                      (s: any) => {
                                        const songTitle =
                                          typeof s === "string"
                                            ? s
                                            : s?.title;
                                        if (!songTitle) return false;
                                        return actualSongTitleSet.has(
                                          songTitle.toLowerCase().trim()
                                        );
                                      }
                                    ).length;
                                    const pct =
                                      total > 0
                                        ? Math.round((correct / total) * 100)
                                        : 0;
                                    return `${pct}%`;
                                  })()}
                                </div>
                                <div className="text-xs text-gray-400">
                                  accuracy rate
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                ) : !predictionSetlist ||
                  predictionSetlist.songs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    {catalogCount === 0 ? (
                      <>
                        <p className="text-lg font-medium">
                          Importing this artist&apos;s catalog…
                        </p>
                        <p className="text-sm mt-1">
                          We&apos;re fetching studio tracks in the background.
                          Your prediction setlist will appear here shortly.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-medium">
                          Generating a prediction setlist…
                        </p>
                        <p className="text-sm mt-1">
                          We&apos;re seeding a 5‑song set from the catalog.
                          Try again in a moment if this doesn&apos;t update.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-6 touch-manipulation">
                    {/* Setlist - Native iOS style with dividers */}
                    <div className="divide-y divide-white/5 -mx-4 sm:mx-0">
                        {(predictionSetlist.songs || [])
                          .map((s: any) =>
                            typeof s === "string" ? s : s?.title
                          )
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
                )}
              </div>
              <BorderBeam size={120} duration={10} className="opacity-20" />
            </MagicCard>
        </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-0 sm:space-y-6">
            {/* Songs Not Played - Only show after concert with actual setlist */}
            {hasActualSetlist && predictionSetlist?.songs && (() => {
              const unplayedSongs = (predictionSetlist.songs as any[])
                .map((s: any) => typeof s === "string" ? s : s?.title)
                .filter(Boolean)
                .filter((title: string) => !actualSongTitleSet.has(title.toLowerCase().trim()));
              
              if (unplayedSongs.length === 0) return null;
              
              return (
                <MagicCard className="p-0 rounded-none sm:rounded-2xl border-0 border-t border-b border-white/5 sm:border">
                  <div className="px-4 py-4 sm:p-6 bg-card">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">
                          Not Played
                        </h3>
                        <p className="text-xs text-red-400">
                          {unplayedSongs.length} fan requests missed
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {unplayedSongs.map((songTitle: string, index: number) => (
                        <UnplayedRequestRow
                          key={`unplayed-${index}`}
                          songTitle={songTitle}
                          predictionSetlistId={predictionSetlistId}
                        />
                      ))}
                    </div>
                  </div>
                  <BorderBeam size={100} duration={8} className="opacity-20" />
                </MagicCard>
              );
            })()}

            {/* Venue Details */}
            <MagicCard className="p-0 rounded-none sm:rounded-2xl border-0 border-t border-b border-white/5 sm:border">
              <div className="px-4 py-4 sm:p-6 bg-card">
                <h3 className="text-lg sm:text-xl font-bold mb-4 text-foreground">
                  Venue Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="font-medium text-foreground">
                      {show?.venue?.name}
                    </div>
                    <div className="text-sm text-gray-400">
                      {show?.venue?.city}, {show?.venue?.country}
                    </div>
                  </div>

                  {show?.venue?.capacity && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-foreground">
                        {show?.venue?.capacity?.toLocaleString()} capacity
                      </span>
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
            <MagicCard className="p-0 rounded-none sm:rounded-2xl border-0 border-t border-b border-white/5 sm:border">
              <div className="px-4 py-4 sm:p-6 bg-card">
                <h3 className="text-lg sm:text-xl font-bold mb-4 text-foreground">
                  Show Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      Songs {hasActualSetlist ? "played" : "in setlist"}
                    </span>
                    <span className="font-medium text-foreground">
                      {hasActualSetlist
                        ? actualSetlistSongs.length
                        : predictionSetlist?.songs?.length || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Catalog songs</span>
                    <span className="font-medium text-foreground">{catalogCount}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Coverage</span>
                    <span className="font-medium text-foreground">
                      {catalogCoverage}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      Studio songs available
                    </span>
                    <span className="font-medium text-foreground">
                      {songs
                        ?.filter(Boolean)
                        .filter((s) => s && !s.isLive && !s.isRemix).length || 0}
                    </span>
                  </div>

                  {predictionSetlist && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                          Total votes
                        </span>
                        <span className="font-medium text-foreground">
                          {(predictionSetlist.upvotes || 0) +
                            (predictionSetlist.downvotes || 0)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                          Setlist upvotes
                        </span>
                        <span className="font-medium text-foreground">
                          {predictionSetlist.upvotes || 0}
                        </span>
                      </div>

                      {/* Top requested songs */}
                      {predictionSetlistId && (
                        <div className="pt-3 mt-3 border-t border-white/5">
                          <TopRequestedSongs setlistId={predictionSetlistId} />
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Show status</span>
                    <span className="font-medium text-foreground capitalize">
                      {show.status}
                    </span>
                  </div>
                </div>
              </div>
              <BorderBeam size={100} duration={8} className="opacity-20" />
            </MagicCard>

            {/* Call to Action - Only for upcoming shows */}
            {!user && isUpcoming && (
              <MagicCard className="p-0 rounded-none sm:rounded-2xl border-0 border-t border-b border-white/5 sm:border">
                <div className="px-4 py-6 sm:p-6 text-center bg-card">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                      <Vote className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">
                      Join the Voting
                    </h3>
                  </div>
                  <p className="text-gray-300 mb-6">
                    Sign in to request songs and vote on setlists
                  </p>
                  <button
                    onClick={onSignInRequired}
                    className="w-full bg-primary/20 hover:bg-primary/30 text-foreground border border-primary/30 rounded-xl py-3 px-6 font-medium transition-all duration-300"
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

        {/* Removed sticky mobile CTA; tickets button shown in header */}
      </motion.div>

      {/* Auth Modal for Unauth Limits */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="bg-black border-white/10 text-foreground max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Unlock More Actions</DialogTitle>
            <DialogDescription className="text-gray-300">
              You've used your free action. Sign up to vote on more songs and
              create setlists!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthModal(false)}>
              Later
            </Button>
            <Button
              onClick={() => {
                setShowAuthModal(false);
                onSignInRequired();
              }}
            >
              Sign Up Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TopRequestedSongs({ setlistId }: { setlistId: Id<"setlists"> }) {
  const agg = useQuery(api.songVotes.getSetlistSongVotes, { setlistId });
  const top = React.useMemo(
    () => (agg || []).sort((a: any, b: any) => b.upvotes - a.upvotes).slice(0, 5),
    [agg]
  );
  if (!top.length) return null;
  return (
    <div>
      <div className="text-sm font-semibold mb-2 text-foreground">Top requested songs</div>
      <ul className="space-y-1">
        {top.map((s: any) => (
          <li key={s.songTitle} className="flex items-center justify-between text-sm">
            <span className="truncate">{s.songTitle}</span>
            <span className="opacity-70">{s.upvotes}</span>
          </li>
        ))}
      </ul>
    </div>
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
      } catch {
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
    } catch {
      toast.error("Vote failed");
    }
  };

  return (
    <div
      className="flex items-center justify-between py-4 px-4 sm:px-0 active:bg-white/10 sm:hover:bg-white/5 transition-all duration-150 active:scale-[0.98] min-h-[56px]"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Minimal status indicator */}
        {wasPlayed ? (
          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-3 h-3 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        ) : (
          <span className="text-sm text-gray-500 w-5 text-center font-semibold">
            {index + 1}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <h3
            className={`font-semibold text-base leading-tight ${
              wasPlayed ? "text-foreground" : "text-gray-300"
            } truncate`}
          >
            {songTitle}
          </h3>
          {wasPlayed && <p className="text-xs text-green-400 mt-0.5">Played</p>}
        </div>
      </div>

      {/* Reddit-style upvote icon + count below - now clickable */}
      {!wasPlayed && (
        <button
          onClick={() => {
            void handleVote();
          }}
          className={`flex flex-col items-center gap-0.5 text-base transition-all duration-150 active:scale-95 min-w-[44px] min-h-[44px] justify-center ${
            userVoted ? "text-primary" : "text-gray-500 active:text-foreground sm:hover:text-foreground"
          }`}
        >
          <ChevronUp
            className={`h-4 w-4 ${userVoted ? "fill-current" : ""}`}
          />
          <span
            className={`font-semibold text-base ${
              userVoted ? "text-primary" : "text-gray-400"
            }`}
          >
            {voteCount}
          </span>
        </button>
      )}
      {wasPlayed && (
        <div className="flex flex-col items-center gap-0.5 text-sm text-green-400">
          <ChevronUp className="h-4 w-4 fill-current" />
          <span className="font-semibold text-base">{voteCount}</span>
        </div>
      )}
    </div>
  );
}

// Actual setlist song row component - Redesigned for integrated vote display
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
  const wasRequested =
    normalizedTitle.length > 0 && predictedSongTitleSet.has(normalizedTitle);

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
      className={`flex items-center justify-between py-3 px-4 sm:px-2 transition-all duration-150 min-h-[52px] rounded-lg ${
        wasRequested ? "bg-green-500/10 border border-green-500/20" : "hover:bg-white/5"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Song number or checkmark */}
        {wasRequested ? (
          <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        ) : (
          <span className="text-sm font-bold w-7 text-center text-gray-500">
            {index + 1}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base leading-tight text-foreground truncate">
            {song.title}
          </h3>
          {song.album && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{song.album}</p>
          )}
        </div>
      </div>

      {/* Right side: badges and vote count */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {song.encore && (
          <span className="bg-yellow-500/20 text-yellow-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-yellow-500/30">
            Encore
          </span>
        )}

        {wasRequested ? (
          <div className="flex items-center gap-1.5 bg-green-500/20 px-2.5 py-1 rounded-full border border-green-500/30">
            <ChevronUp className="h-3.5 w-3.5 text-green-400 fill-current" />
            <span className="text-sm font-bold text-green-400">{voteCount}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
            surprise
          </span>
        )}
      </div>
    </div>
  );
}

// Song that was requested but NOT played - for sidebar
function UnplayedRequestRow({
  songTitle,
  predictionSetlistId,
}: {
  songTitle: string;
  predictionSetlistId?: Id<"setlists">;
}) {
  const songVotes = useQuery(
    api.songVotes.getSongVotes,
    predictionSetlistId
      ? { setlistId: predictionSetlistId, songTitle }
      : "skip"
  );

  const voteCount = songVotes?.upvotes || 0;

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <span className="text-sm text-gray-300 truncate">{songTitle}</span>
      </div>
      <div className="flex items-center gap-1 text-red-400/80 flex-shrink-0">
        <ChevronUp className="h-3 w-3" />
        <span className="text-xs font-semibold">{voteCount}</span>
      </div>
    </div>
  );
}
