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
  Clock,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
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
import { motion } from "framer-motion";
import { SongCombobox } from "./SongCombobox";
import { formatLocation, parseShowCalendarDate } from "../lib/utils";
import { DetailPageSkeleton } from "./LoadingSkeleton";
import { capture, captureException } from "../lib/analytics";
import { ShowShareButton } from "./ShowShareButton";

interface ShowDetailProps {
  showId: Id<"shows">;
  onBack: () => void;
  onArtistClick: (artistId: Id<"artists">) => void;
  onSignInRequired: () => void;
}

const ANON_FREE_VOTES = 2;
const ANON_FREE_ADDS = 2;

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
          // The production catalog can exceed 200 songs (Chris Brown currently
          // has 266). SongCombobox virtualizes large lists, so expose the full
          // launch-sized catalog instead of silently truncating the picker.
          limit: 500,
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

  // Per-show free-action budget for anonymous users (kept in sync with the
  // server-side anonymous limits in songVotes/setlists).
  const votedKey = `voteCount_${showId}`;
  const addedKey = `addCount_${showId}`;

  const [voteActionCount, setVoteActionCount] = useState(() => {
    if (typeof window !== "undefined") {
      return parseInt(localStorage.getItem(votedKey) || "0", 10) || 0;
    }
    return 0;
  });

  const [addActionCount, setAddActionCount] = useState(() => {
    if (typeof window !== "undefined") {
      return parseInt(localStorage.getItem(addedKey) || "0", 10) || 0;
    }
    return 0;
  });

  const hasAdded = addActionCount >= ANON_FREE_ADDS;

  const [showAuthModal, setShowAuthModal] = useState(false);
  const trackedShowId = React.useRef<string | null>(null);
  const trackedOfficialSetlistId = React.useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(votedKey, voteActionCount.toString());
      localStorage.setItem(addedKey, addActionCount.toString());
    }
  }, [voteActionCount, addActionCount, votedKey, addedKey]);

  useEffect(() => {
    if (!show || user === undefined || trackedShowId.current === show._id) return;
    trackedShowId.current = show._id;
    capture("show_viewed", {
      show_id: show._id,
      show_slug: show.slug,
      artist_id: show.artistId,
      artist_name: show.artist?.name,
      venue_id: show.venueId,
      venue_name: show.venue?.name,
      venue_city: show.venue?.city,
      show_date: show.date,
      show_status: show.status,
      has_ticket_link: Boolean(show.ticketUrl),
      auth_state: user ? "authenticated" : "anonymous",
    });
  }, [show, user]);


  const predictionSetlist = useMemo(() => {
    if (!setlists) return null;
    const shared = setlists.find((s: any) => !s.isOfficial && !s.userId);
    if (shared) return shared;
    return setlists.find((s: any) => !s.isOfficial) ?? null;
  }, [setlists]);

  // Fetch all song votes for the prediction setlist to enable sorting by vote count
  const predictionSetlistId = predictionSetlist?._id as Id<"setlists"> | undefined;
  const allSongVotes = useQuery(
    api.songVotes.getSetlistSongVotes,
    predictionSetlistId
      ? {
          setlistId: predictionSetlistId,
          anonId: !user ? anonId : undefined,
        }
      : "skip"
  );

  // The backend is authoritative for active anonymous upvotes. Reconcile the
  // local counter after load so clearing/staling UI state cannot create a
  // misleading prompt or allowance.
  useEffect(() => {
    if (user || !allSongVotes) return;
    const activeVotes = (allSongVotes as any[]).filter(
      (vote) => vote?.userVoted,
    ).length;
    setVoteActionCount(activeVotes);
  }, [allSongVotes, user]);

  // Map of normalized song title -> vote count for this prediction setlist
  const songVoteCountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (allSongVotes) {
      for (const row of allSongVotes as any[]) {
        const title = (row?.songTitle || "").toString().toLowerCase().trim();
        const upvotes = typeof row?.upvotes === "number" ? row.upvotes : 0;
        if (title) map.set(title, upvotes);
      }
    }
    return map;
  }, [allSongVotes]);

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

  useEffect(() => {
    if (!actualSetlistRecord || !hasActualSetlist) return;
    if (trackedOfficialSetlistId.current === actualSetlistRecord._id) return;
    trackedOfficialSetlistId.current = actualSetlistRecord._id;
    capture("official_setlist_viewed", {
      show_id: showId,
      artist_id: show?.artistId,
      setlist_id: actualSetlistRecord._id,
      song_count: actualSetlistSongs.length,
      source: actualSetlistRecord.source || "setlistfm",
    });
  }, [actualSetlistRecord, actualSetlistSongs.length, hasActualSetlist, show?.artistId, showId]);

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

  // Sort songs by vote count (most voted first)
  const sortedPredictionSongs = useMemo(() => {
    if (!predictionSetlist?.songs) return [];
    
    // Get all song titles
    const songTitles = (predictionSetlist.songs as any[])
      .map((s: any) => typeof s === "string" ? s : s?.title)
      .filter(Boolean) as string[];
    
    // Sort by vote count (descending), then alphabetically for ties
    return [...songTitles].sort((a, b) => {
      const aVotes = songVoteCountMap.get(a.toLowerCase().trim()) || 0;
      const bVotes = songVoteCountMap.get(b.toLowerCase().trim()) || 0;
      if (bVotes !== aVotes) {
        return bVotes - aVotes;
      }
      return a.localeCompare(b);
    });
  }, [predictionSetlist?.songs, songVoteCountMap]);

  // Simple analytics
  const catalogCount = songs?.length || 0;

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
      void (async () => {
        try {
          const res = await ensureAutoSetlist({ showId });
          if (res && !res.created && res.message) {
            toast.info(res.message, { duration: 2500 });
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [showId, setlists, predictionSetlist, ensureAutoSetlist]);

  const handleVoteAction = () => {
    if (voteActionCount >= ANON_FREE_VOTES) {
      capture("anonymous_limit_reached", {
        action_type: "song_vote",
        show_id: showId,
        artist_id: show?.artistId,
        actions_used: voteActionCount,
        free_limit: ANON_FREE_VOTES,
      });
      setShowAuthModal(true);
      return false;
    }
    return true;
  };

  const recordVoteAction = (action: "added" | "removed") => {
    setVoteActionCount((count) =>
      action === "added"
        ? Math.min(ANON_FREE_VOTES, count + 1)
        : Math.max(0, count - 1),
    );
  };

  const handleAddAction = () => {
    if (addActionCount >= ANON_FREE_ADDS) {
      capture("anonymous_limit_reached", {
        action_type: "song_add",
        show_id: showId,
        artist_id: show?.artistId,
        actions_used: addActionCount,
        free_limit: ANON_FREE_ADDS,
      });
      setShowAuthModal(true);
      return false;
    }
    return true;
  };

  const handleAddSongToSharedSetlist = async (songTitle: string) => {
    if (!user && !handleAddAction()) return;

    try {
      const selectedSong = songs?.find((s) => s?.title === songTitle);
      if (!selectedSong) return;

      const result = await addSongToSetlist({
        showId,
        song: {
          title: selectedSong.title,
          album: selectedSong.album,
          duration: selectedSong.durationMs,
          songId: selectedSong._id,
        },
        ...(!user && { anonId }),
      });

      if (!result.added) {
        capture("song_add_rejected", {
          show_id: showId,
          artist_id: show?.artistId,
          song_id: selectedSong._id,
          reason: "already_added",
          auth_state: user ? "authenticated" : "anonymous",
        });
        toast.info(`"${songTitle}" is already in the setlist`);
        return;
      }

      // Adding and upvoting are separate free actions. A song request no
      // longer silently consumes one of the visitor's two upvotes.
      if (!user) setAddActionCount((count) => count + 1);

      capture("song_added", {
        show_id: showId,
        artist_id: show?.artistId,
        setlist_id: result.setlistId,
        song_id: selectedSong._id,
        song_title: selectedSong.title,
        auth_state: user ? "authenticated" : "anonymous",
        anonymous_adds_used: user ? undefined : addActionCount + 1,
        anonymous_adds_remaining: user
          ? undefined
          : Math.max(0, ANON_FREE_ADDS - addActionCount - 1),
      });

      toast.success(`Added "${songTitle}" to the setlist`);
    } catch (error) {
      captureException(error, {
        operation: "song_add",
        show_id: showId,
        artist_id: show?.artistId,
      });
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!user && message.includes("anonymous users can only add")) {
        setShowAuthModal(true);
      } else {
        toast.error("Failed to add song to setlist");
      }
    }
  };

  if (!show) {
    return <DetailPageSkeleton />;
  }

  const showDate = parseShowCalendarDate(show.date);
  const isUpcoming = show.status === "upcoming";

  // First-paint images straight from the show doc so the hero renders
  // immediately; the media action upgrades these once it resolves.
  const fallbackImage =
    (show as any)?.artist?.images?.[0] ||
    (show as any)?.artistImage ||
    (show as any)?.cachedTrending?.artistImage;
  const effectiveHero = heroImage || fallbackImage;
  const effectiveAvatar = avatarImage || heroImage || fallbackImage;

  const handleRetryImport = () => {
    capture("setlist_import_retry_requested", {
      show_id: showId,
      artist_id: show.artistId,
      prior_import_status: show.importStatus,
    });
    void triggerSetlistSync({
      showId,
      artistName: show.artist?.name || "",
      venueCity: show.venue?.city || "",
      showDate: show.date,
    });
    toast.info("Retrying setlist.fm import…");
  };

  return (
    <>
      <div className="space-y-4 sm:space-y-6 relative z-10">
        <SEOHead />

        {/* Hero Header - Apple Music/Spotify-inspired immersive design */}
        <div className="relative w-full overflow-hidden min-h-[180px] sm:min-h-[240px] lg:min-h-[280px]">
          {/* Background Image Layer - Full bleed, high quality */}
          <div className="absolute inset-0 z-0">
            {effectiveHero ? (
              <img
                src={effectiveHero}
                alt=""
                className="w-full h-full object-cover object-center scale-105"
                style={{ imageRendering: 'auto' }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 via-secondary to-background" />
            )}
          </div>
          
          {/* Multi-layer gradient system for depth - works in both light and dark mode */}
          <div className="absolute inset-0 z-[1]">
            {/* Bottom fade - ensures text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            {/* Side vignette - Apple Music style */}
            <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />
            {/* Top subtle fade */}
            <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-transparent" />
            {/* Center spotlight effect */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_40%,rgba(0,0,0,0.3)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_40%,rgba(0,0,0,0.5)_100%)]" />
          </div>

          {/* Content - Positioned at bottom for Apple Music style */}
          <div className="relative z-10 h-full flex items-end">
            <div className="w-full px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8 pt-16 sm:pt-20">
              <div className="flex flex-row items-end gap-4 sm:gap-6 lg:gap-8 max-w-6xl mx-auto">
                {/* Artist Image - Premium shadow and border treatment */}
                <div className="flex-shrink-0">
                  <a
                    href={spotifyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={spotifyLink ? "View artist on Spotify" : undefined}
                    className="relative block w-24 h-24 sm:w-32 sm:h-32 lg:w-36 lg:h-36 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 dark:ring-white/20"
                  >
                    {effectiveAvatar ? (
                      <img
                        src={effectiveAvatar}
                        alt={show?.artist?.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <span className="text-3xl font-bold text-muted-foreground">
                          {show?.artist?.name?.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </a>
                </div>

                {/* Show Info - Text with enhanced contrast */}
                <div className="flex-1 min-w-0 pb-1">
                  {/* Artist Name - Bold, clickable */}
                  <button
                    onClick={() => {
                      if (show?.artistId) onArtistClick(show.artistId);
                    }}
                    className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground hover:text-primary transition-colors leading-tight tracking-tight text-left line-clamp-2 drop-shadow-sm"
                  >
                    {show?.artist?.name}
                  </button>

                  {/* Venue & Date - Subtle but readable */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm sm:text-base text-foreground/80 mt-2 sm:mt-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 opacity-70" />
                      <span className="truncate max-w-[150px] sm:max-w-none font-medium">{show?.venue?.name}</span>
                    </div>
                    <span className="text-foreground/40 hidden sm:inline">•</span>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 opacity-70" />
                      <span className="font-medium">
                        {showDate.toLocaleDateString("en-US", { weekday: 'short', month: "short", day: "numeric", year: 'numeric' })}
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

                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
                    {/* Get Tickets - Premium button */}
                    {isUpcoming && show?.ticketUrl && (
                      <button
                        onClick={() => {
                          capture("ticket_link_clicked", {
                            show_id: show._id,
                            artist_id: show.artistId,
                            venue_id: show.venueId,
                            show_date: show.date,
                            placement: "show_hero",
                            provider: "ticketmaster",
                            affiliate: true,
                          });
                          window.open(
                            buildTicketmasterAffiliateUrl(show.ticketUrl || ""),
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }}
                        className="inline-flex items-center px-4 py-2 sm:px-5 sm:py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-sm sm:text-base transition-all shadow-lg hover:shadow-xl"
                      >
                        <Ticket className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                        Get Tickets
                      </button>
                    )}
                    <ShowShareButton
                      showId={show._id}
                      slug={show.slug}
                      artistName={show.artist?.name}
                      venueName={show.venue?.name}
                      date={show.date}
                      label={isUpcoming ? "Share voting link" : "Share setlist"}
                      mode={isUpcoming ? "voting" : "setlist"}
                      className="h-10 bg-background/45 backdrop-blur-sm sm:h-11"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="container mx-auto px-4 sm:px-6 pb-4 sm:pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            
            <MagicCard className="p-0 rounded-xl border border-border bg-card">
              <div className="px-4 py-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                      <Music className="h-4 w-4 text-foreground" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-foreground">Setlist</h2>
                  </div>
                </div>

                {/* Awaiting-import status banner — completed show, no official setlist yet */}
                {!isUpcoming && !hasActualSetlist && (() => {
                  const status = show.importStatus;
                  const isFailed = status === "failed";
                  return (
                    <div
                      className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3.5 ${
                        isFailed
                          ? "border-red-500/30 bg-red-500/10"
                          : "border-border bg-secondary/50"
                      }`}
                    >
                      {status === "importing" ? (
                        <Loader2 className="mt-0.5 h-5 w-5 flex-shrink-0 animate-spin text-primary" />
                      ) : isFailed ? (
                        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
                      ) : status === "not_found" ? (
                        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        {status === "importing" ? (
                          <>
                            <p className="text-sm font-semibold text-foreground">
                              Importing from setlist.fm…
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              Hang tight — this usually takes under a minute.
                            </p>
                          </>
                        ) : isFailed ? (
                          <>
                            <p className="text-sm font-semibold text-foreground">
                              Setlist import failed
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              We couldn&apos;t pull this show from setlist.fm.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2.5"
                              onClick={handleRetryImport}
                            >
                              Retry Import
                            </Button>
                          </>
                        ) : status === "not_found" ? (
                          <>
                            <p className="text-sm font-semibold text-foreground">
                              Not on setlist.fm yet
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              We re-check daily for two weeks.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-foreground">
                              Official setlist on the way
                            </p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              setlist.fm data usually appears 1–3 days after the show.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Mobile-only sign-in nudge - keeps the CTA in view near the voting action */}
                {!user && isUpcoming && (
                  <button
                    onClick={onSignInRequired}
                    className="lg:hidden w-full mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-left transition-colors active:bg-primary/20"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Vote className="h-4 w-4 text-primary" />
                      Sign in to vote & request songs
                    </span>
                    <span className="text-xs font-semibold text-primary">Sign in</span>
                  </button>
                )}

                {/* Song Addition: Combined Search + Dropdown */}
                {!hasActualSetlist && isUpcoming && songs && songs.length > 0 && (
                  <div className="mb-4">
                    <SongCombobox
                      disabled={false}
                      placeholder={
                        user
                          ? `Search ${songs.length} catalog songs…`
                          : hasAdded
                            ? "Sign in to add more songs"
                            : `Search ${songs.length} songs • ${ANON_FREE_ADDS - addActionCount} free adds`
                      }
                      items={songComboboxItems}
                      onOpenChange={(open) => {
                        if (!open) return;
                        capture("song_picker_opened", {
                          show_id: showId,
                          artist_id: show.artistId,
                          catalog_size: songComboboxItems.length,
                          auth_state: user ? "authenticated" : "anonymous",
                          anonymous_adds_remaining: user
                            ? undefined
                            : Math.max(0, ANON_FREE_ADDS - addActionCount),
                        });
                      }}
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
                            <h2 className="text-lg sm:text-xl font-bold text-foreground">
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
                          <div className="text-xl font-bold text-foreground">
                            {actualSetlistSongs.length}
                          </div>
                          <div className="text-xs text-muted-foreground">
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
                            predictedSongTitleSet={predictedSongTitleSet}
                            voteCount={songVoteCountMap.get((song?.title ?? "").toLowerCase().trim()) || 0}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Accuracy Summary */}
                    {predictionSetlist &&
                      predictionSetlist.songs &&
                      predictionSetlist.songs.length > 0 && (
                        <div className="mt-6">
                          <div className="p-6 bg-secondary border border-border rounded-xl">
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
                                <div className="text-xl font-bold text-purple-400">
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
                                <div className="text-xs text-muted-foreground">
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
                    {songs === undefined ? (
                      // Songs query is still loading
                      <>
                        <p className="text-lg font-medium">
                          Loading songs…
                        </p>
                        <p className="text-sm mt-1">
                          Please wait while we fetch this artist&apos;s catalog.
                        </p>
                      </>
                    ) : catalogCount === 0 ? (
                      // Songs loaded but empty - need to import
                      <>
                        <p className="text-lg font-medium">
                          No songs available yet
                        </p>
                        <p className="text-sm mt-1">
                          This artist&apos;s catalog hasn&apos;t been imported yet.
                          Check back soon!
                        </p>
                      </>
                    ) : (
                      // Songs exist but setlist not generated yet
                      <>
                        <p className="text-lg font-medium">
                          Generating prediction setlist…
                        </p>
                        <p className="text-sm mt-1">
                          We&apos;re creating an initial setlist from the catalog.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-6 touch-manipulation">
                    {/* After the show, the prediction list is a historical record */}
                    {!isUpcoming && (
                      <div className="mb-3 flex items-baseline justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Fan predictions
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          voted before the show
                        </span>
                      </div>
                    )}
                    {/* Setlist - sorted by vote count, animates on reorder */}
                    <motion.div layout className="space-y-2">
                        {sortedPredictionSongs.map((songTitle: string, index: number) => {
                          // Use pre-fetched vote data to avoid N+1 queries
                          const normalizedTitle = songTitle.toLowerCase().trim();
                          const voteData = (allSongVotes as any[] | undefined)?.find(
                            (v: any) => (v?.songTitle || "").toLowerCase().trim() === normalizedTitle
                          );
                          return (
                            <FanRequestSongRow
                              key={`setlist-song-${normalizedTitle}`}
                              songTitle={songTitle}
                              index={index}
                              predictionSetlistId={predictionSetlist._id}
                              actualSongTitleSet={actualSongTitleSet}
                              user={user}
                              voteOnSong={voteOnSong}
                              handleVoteAction={handleVoteAction}
                              recordVoteAction={recordVoteAction}
                              setShowAuthModal={setShowAuthModal}
                              anonId={anonId}
                              isUpcoming={isUpcoming}
                              preloadedVoteCount={voteData?.upvotes ?? 0}
                              preloadedUserVoted={voteData?.userVoted ?? false}
                              showId={showId}
                              artistId={show.artistId}
                              anonymousVotesUsed={voteActionCount}
                            />
                          );
                        })}
                    </motion.div>
                  </div>
                )}
              </div>
              <BorderBeam size={120} duration={10} className="opacity-20" />
            </MagicCard>
        </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-4 sm:space-y-6">
            {/* Songs Not Played - Only show after concert with actual setlist */}
            {hasActualSetlist && predictionSetlist?.songs && (() => {
              const unplayedSongs = (predictionSetlist.songs as any[])
                .map((s: any) => typeof s === "string" ? s : s?.title)
                .filter(Boolean)
                .map((t: string) => t.toString())
                .filter((title: string) => !actualSongTitleSet.has(title.toLowerCase().trim()))
                .sort((a: string, b: string) => {
                  const aVotes = songVoteCountMap.get(a.toLowerCase().trim()) || 0;
                  const bVotes = songVoteCountMap.get(b.toLowerCase().trim()) || 0;
                  if (bVotes !== aVotes) return bVotes - aVotes;
                  return a.localeCompare(b);
                });
              
              if (unplayedSongs.length === 0) return null;
              
              return (
                <MagicCard className="p-0 rounded-xl border border-border bg-card">
                  <div className="p-4 sm:p-6">
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
                          voteCount={songVoteCountMap.get(songTitle.toLowerCase().trim()) || 0}
                        />
                      ))}
                    </div>
                  </div>
                  <BorderBeam size={100} duration={8} className="opacity-20" />
                </MagicCard>
              );
            })()}

            {/* Venue Details */}
            <MagicCard className="p-0 rounded-xl border border-border bg-card">
              <div className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold mb-4 text-foreground">
                  Venue Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="font-medium text-foreground">
                      {show?.venue?.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatLocation(show?.venue?.city, show?.venue?.state)}
                    </div>
                  </div>

                  {show?.venue?.capacity && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">
                        {show?.venue?.capacity?.toLocaleString()} capacity
                      </span>
                    </div>
                  )}

                  {show?.venue?.address && (
                    <div className="text-sm text-muted-foreground">
                      {show?.venue?.address}
                    </div>
                  )}
                  {show?.venue?._id && (
                    <Link
                      to={`/venues/${(show.venue as any).slug || show.venue._id}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      View venue concerts
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
              <BorderBeam size={100} duration={8} className="opacity-20" />
            </MagicCard>

            {/* Show Stats */}
            <MagicCard className="p-0 rounded-xl border border-border bg-card">
              <div className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold mb-4 text-foreground">
                  Show Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Songs {hasActualSetlist ? "played" : "in setlist"}
                    </span>
                    <span className="font-medium text-foreground">
                      {hasActualSetlist
                        ? actualSetlistSongs.length
                        : predictionSetlist?.songs?.length || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Songs in catalog</span>
                    <span className="font-medium text-foreground">{catalogCount}</span>
                  </div>

                  {predictionSetlist && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Total votes
                        </span>
                        <span className="font-medium text-foreground">
                          {(predictionSetlist.upvotes || 0) +
                            (predictionSetlist.downvotes || 0)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Setlist upvotes
                        </span>
                        <span className="font-medium text-foreground">
                          {predictionSetlist.upvotes || 0}
                        </span>
                      </div>

                      {/* Top requested songs */}
                      {predictionSetlistId && (
                        <div className="pt-3 mt-3 border-t border-border">
                          <TopRequestedSongs setlistId={predictionSetlistId} />
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Show status</span>
                    <span className="font-medium text-foreground capitalize">
                      {show.status}
                    </span>
                  </div>
                </div>
              </div>
              <BorderBeam size={100} duration={8} className="opacity-20" />
            </MagicCard>

            {/* Call to Action - desktop sidebar only (mobile uses inline nudge above) */}
            {!user && isUpcoming && (
              <MagicCard className="hidden lg:block p-0 rounded-xl border border-border bg-card">
                <div className="p-4 sm:p-6 text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                      <Vote className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">
                      Join the Voting
                    </h3>
                  </div>
                  <p className="text-muted-foreground mb-6">
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
      </div>

      {/* Auth Modal for Unauth Limits */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="bg-background border-border text-foreground max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Unlock More Actions</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              You've hit the free limit for this show ({ANON_FREE_VOTES} votes
              and {ANON_FREE_ADDS} song adds). Sign up for unlimited voting and
              song requests!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthModal(false)}>
              Later
            </Button>
            <Button
              onClick={() => {
                capture("auth_started", {
                  source: "anonymous_limit_modal",
                  intent: "continue_voting",
                  show_id: showId,
                  artist_id: show.artistId,
                });
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
  recordVoteAction,
  setShowAuthModal,
  anonId,
  isUpcoming,
  preloadedVoteCount,
  preloadedUserVoted,
  showId,
  artistId,
  anonymousVotesUsed,
}: {
  songTitle: string;
  index: number;
  predictionSetlistId?: Id<"setlists">;
  actualSongTitleSet: Set<string>;
  user: any;
  voteOnSong: any;
  handleVoteAction: () => boolean;
  recordVoteAction: (action: "added" | "removed") => void;
  setShowAuthModal: (show: boolean) => void;
  anonId: string;
  isUpcoming: boolean;
  preloadedVoteCount?: number;
  preloadedUserVoted?: boolean;
  showId: Id<"shows">;
  artistId: Id<"artists">;
  anonymousVotesUsed: number;
}) {
  const normalizedTitle = songTitle.toLowerCase().trim();
  const wasPlayed = actualSongTitleSet.has(normalizedTitle);

  // Use preloaded data if available, otherwise fall back to individual query
  // This eliminates N+1 queries when parent provides the data
  const songVotes = useQuery(
    api.songVotes.getSongVotes,
    preloadedVoteCount === undefined && predictionSetlistId
      ? {
          setlistId: predictionSetlistId,
          songTitle,
          anonId: !user ? anonId : undefined,
        }
      : "skip"
  );

  const serverVoteCount = preloadedVoteCount ?? songVotes?.upvotes ?? 0;
  const serverUserVoted = preloadedUserVoted ?? songVotes?.userVoted ?? false;

  // Optimistic state: instant feedback on tap, self-heals when the
  // reactive server value catches up (cleared via the effect below).
  const [optimistic, setOptimistic] = useState<
    { voted: boolean; count: number } | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setOptimistic(null);
  }, [serverVoteCount, serverUserVoted]);

  const voteCount = optimistic?.count ?? serverVoteCount;
  const userVoted = optimistic?.voted ?? serverUserVoted;

  const handleVote = async () => {
    if (!predictionSetlistId || isSubmitting) return;

    // Removing an existing vote always remains available and frees a slot.
    if (!user && !userVoted && !handleVoteAction()) {
      setShowAuthModal(true);
      return;
    }

    // Optimistically flip the vote so the tap feels instant on mobile.
    const nextVoted = !userVoted;
    setOptimistic({
      voted: nextVoted,
      count: Math.max(0, voteCount + (nextVoted ? 1 : -1)),
    });
    setIsSubmitting(true);

    try {
      const result = await voteOnSong({
        setlistId: predictionSetlistId,
        songTitle,
        voteType: "upvote",
        ...(!user && { anonId }),
      });
      if (!user && result?.action) {
        recordVoteAction(result.action as "added" | "removed");
      }
      capture("song_vote_changed", {
        show_id: showId,
        artist_id: artistId,
        setlist_id: predictionSetlistId,
        song_title: songTitle,
        action: result?.action || (nextVoted ? "added" : "removed"),
        auth_state: user ? "authenticated" : "anonymous",
        vote_count_after: Math.max(0, voteCount + (nextVoted ? 1 : -1)),
        anonymous_votes_used: user
          ? undefined
          : Math.max(0, anonymousVotesUsed + (nextVoted ? 1 : -1)),
      });
    } catch (error) {
      captureException(error, {
        operation: "song_vote",
        show_id: showId,
        artist_id: artistId,
        setlist_id: predictionSetlistId,
      });
      setOptimistic(null);
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!user && message.includes("anonymous users can only vote")) {
        setShowAuthModal(true);
      } else {
        toast.error("Vote failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="flex items-center justify-between gap-2 py-2 pl-3 pr-2 sm:pl-4 rounded-lg border border-border/60 bg-secondary/40 hover:bg-secondary/70 active:bg-secondary/70 transition-colors duration-150 min-h-[56px]"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Minimal status indicator */}
        {wasPlayed ? (
          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
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
          <span className="w-6 flex-shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground/70">
            {index + 1}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm sm:text-base leading-tight text-foreground truncate">
            {songTitle}
          </h3>
          {wasPlayed && <p className="text-xs text-green-400 mt-0.5">Played</p>}
        </div>
      </div>

      {/* Fused upvote pill: chevron above count - only tappable for upcoming shows */}
      {!wasPlayed && isUpcoming && (
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            void handleVote();
          }}
          disabled={isSubmitting}
          aria-pressed={userVoted}
          aria-label={userVoted ? `Remove vote for ${songTitle}` : `Vote for ${songTitle}`}
          className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-1.5 rounded-xl border flex-shrink-0 transition-colors duration-150 disabled:opacity-70 ${
            userVoted
              ? "bg-primary border-primary text-primary-foreground"
              : "bg-secondary/60 border-border text-muted-foreground active:bg-secondary sm:hover:bg-secondary sm:hover:text-foreground"
          }`}
        >
          <motion.div
            key={userVoted ? "voted" : "unvoted"}
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 600, damping: 20 }}
          >
            <ChevronUp
              strokeWidth={2.5}
              className={`h-4 w-4 ${userVoted ? "fill-current" : ""}`}
            />
          </motion.div>
          <span className="mt-0.5 text-sm font-semibold leading-none tabular-nums">
            {voteCount}
          </span>
        </motion.button>
      )}
      {/* Show vote count (non-clickable) for completed shows or played songs */}
      {(wasPlayed || !isUpcoming) && (
        <div
          className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] flex-shrink-0 ${
            wasPlayed ? "text-green-400" : "text-muted-foreground"
          }`}
        >
          <ChevronUp className={`h-4 w-4 ${wasPlayed ? "fill-current" : ""}`} />
          <span className="mt-0.5 text-sm font-semibold leading-none tabular-nums">
            {voteCount}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// Actual setlist song row component - Redesigned for integrated vote display
function ActualSetlistSongRow({
  song,
  index,
  predictedSongTitleSet,
  voteCount,
}: {
  song: any;
  index: number;
  predictedSongTitleSet: Set<string>;
  voteCount: number;
}) {
  const normalizedTitle = (song?.title ?? "").toLowerCase().trim();
  const wasRequested =
    normalizedTitle.length > 0 && predictedSongTitleSet.has(normalizedTitle);

  return (
    <div
      className={`flex items-center justify-between py-3 px-4 sm:px-2 transition-all duration-150 min-h-[52px] rounded-lg ${
        wasRequested ? "bg-green-500/10 border border-green-500/20" : "hover:bg-secondary"
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
          <span className="text-sm font-bold w-7 text-center text-muted-foreground">
          {index + 1}
        </span>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base leading-tight text-foreground truncate">
            {song.title}
          </h3>
          {song.album && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{song.album}</p>
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
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
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
  voteCount,
}: {
  songTitle: string;
  predictionSetlistId?: Id<"setlists">;
  voteCount: number;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <span className="text-sm text-muted-foreground truncate">{songTitle}</span>
      </div>
      <div className="flex items-center gap-1 text-red-400/80 flex-shrink-0">
        <ChevronUp className="h-3 w-3" />
        <span className="text-xs font-semibold">{voteCount}</span>
      </div>
    </div>
  );
}
