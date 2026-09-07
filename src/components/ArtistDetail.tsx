import React, { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Calendar, ChevronRight, Users, Music, Plus, Loader2, Heart, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { AddToSetlistModal } from "./AddToSetlistModal";
import { SEOHead } from "./SEOHead";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { motion } from "framer-motion";
import { useAction } from "convex/react";
import { formatLocation, formatTimeCompact, parseShowCalendarDate } from "../lib/utils";
import { DetailPageSkeleton } from "./LoadingSkeleton";
import { capture, captureException } from "../lib/analytics";

interface ArtistDetailProps {
  artistId: Id<"artists">;
  onBack: () => void;
  onShowClick: (showId: Id<"shows">, slug?: string) => void;
  onSignInRequired: () => void;
}

export function ArtistDetail({ artistId, onBack, onShowClick, onSignInRequired }: ArtistDetailProps) {
  const artist = useQuery(api.artists.getById, { id: artistId });
  const shows = useQuery(api.shows.getByArtist, { artistId, limit: 50 });
  // This surface only renders a short top-songs list. Avoid hydrating the
  // entire catalog here; the show voting picker requests the full set.
  const songs = useQuery(api.songs.getByArtist, { artistId, limit: 25 });
  const catalogSongCount = useQuery(api.songs.countByArtistPublic, { artistId });
  const isFollowing = useQuery(api.artists.isFollowing, { artistId });
  const user = useQuery(api.auth.loggedInUser);
  // Media selection via backend (Ticketmaster hero, Spotify avatar)
  const getArtistImages = useAction(api.media.getArtistImages);
  const [heroImage, setHeroImage] = React.useState<string | undefined>(undefined);
  const [avatarImage, setAvatarImage] = React.useState<string | undefined>(undefined);
  const [spotifyLink, setSpotifyLink] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (!artistId) return;
    void (async () => {
      try {
        const res = await getArtistImages({ artistId });
        if (res) {
          setHeroImage(res.heroUrl || undefined);
          setAvatarImage(res.avatarUrl || undefined);
          setSpotifyLink(res.spotifyUrl || undefined);
        }
      } catch {
        // ignore
      }
    })();
  }, [artistId, getArtistImages]);

  // If this artist's setlist.fm history was never imported (backlog artists
  // predating the feature), trigger it on first view — the backend skips
  // anything synced within the last 6h, so repeat visits are free.
  const requestHistoryImport = useAction((api as any).setlistfmHistory.requestArtistHistoryImport);
  const historyRequestedRef = React.useRef(false);
  React.useEffect(() => {
    if (!artist || historyRequestedRef.current) return;
    if ((artist as any).lastSetlistfmHistorySyncAt) return;
    historyRequestedRef.current = true;
    void requestHistoryImport({ artistId }).catch(() => {
      // non-critical background trigger
    });
  }, [artist, artistId, requestHistoryImport]);

  const [anonymousActions, setAnonymousActions] = useState(0);
  const [addToSetlistModal, setAddToSetlistModal] = useState<{ isOpen: boolean; songTitle: string }>({ isOpen: false, songTitle: "" });
  const followArtist = useMutation(api.artists.followArtist);
  const trackedArtistId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (
      !artist ||
      shows === undefined ||
      songs === undefined ||
      catalogSongCount === undefined ||
      user === undefined ||
      trackedArtistId.current === artist._id
    ) return;
    trackedArtistId.current = artist._id;
    capture("artist_viewed", {
      artist_id: artist._id,
      artist_slug: artist.slug,
      artist_name: artist.name,
      genre: artist.genres?.[0],
      follower_count: artist.followers,
      upcoming_show_count: shows?.filter((show) => show.status === "upcoming").length ?? 0,
      recent_show_count: shows?.filter((show) => show.status === "completed").length ?? 0,
      catalog_song_count: catalogSongCount ?? songs?.length ?? 0,
      auth_state: user ? "authenticated" : "anonymous",
    });
  }, [artist, catalogSongCount, shows, songs?.length, user]);

  // Loading state
  const isLoading = !artist;

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
        capture("artist_follow_changed", {
          artist_id: artistId,
          artist_name: artist?.name,
          action: following ? "followed" : "unfollowed",
          auth_state: "authenticated",
        });
        toast.success(following ? `Following ${artist?.name}` : `Unfollowed ${artist?.name}`);
      } else {
        capture("artist_follow_changed", {
          artist_id: artistId,
          artist_name: artist?.name,
          action: "interest_added",
          auth_state: "anonymous",
        });
        toast.success(`Added ${artist?.name} to your interests`);
      }
    } catch (error) {
      captureException(error, { operation: "artist_follow", artist_id: artistId });
      toast.error("Failed to follow artist");
    }
  };

  const handleAddToSetlist = (songTitle: string) => {
    setAddToSetlistModal({ isOpen: true, songTitle });
  };

  // NEW: Handle null artist (404 or not found)
  if (artist === null) {
    return (
      <div className="container mx-auto px-4 py-8 text-center min-h-screen flex flex-col items-center justify-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Artist Not Found</h1>
          <p className="text-muted-foreground">The artist could not be found in our database. Try searching for them.</p>
          <Link to="/search">
            <Button className="w-full">
              Search Artists
            </Button>
          </Link>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  const upcomingShows = shows?.filter(show => show.status === "upcoming") || [];
  const recentShows = shows?.filter(show => show.status === "completed") || [];

  // Progressive loading states
  const isImportingShows = artist && !artist.syncStatus?.showsImported && artist.syncStatus?.phase === "shows";
  const isImportingCatalog = artist?.syncStatus?.phase === "catalog";
  const hasImportError = artist?.syncStatus?.error;

  return (
    <>
      <SEOHead />
      <div className="space-y-4 sm:space-y-8 relative z-10">
        {/* Hero Header - Apple Music/Spotify-inspired immersive design */}
        <div className="relative w-full overflow-hidden min-h-[176px] sm:min-h-[260px] lg:min-h-[320px]">
          {/* Background Image Layer - Full bleed, high quality */}
          <div className="absolute inset-0 z-0">
            {heroImage ? (
              <img
                src={heroImage}
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
            <div className="w-full px-4 sm:px-6 lg:px-8 pb-5 sm:pb-8 lg:pb-10 pt-12 sm:pt-20">
              <div className="flex flex-row items-end gap-3.5 sm:gap-6 lg:gap-8 max-w-6xl mx-auto">
                {/* Artist Image - Premium shadow and border treatment */}
                <div className="flex-shrink-0">
                  <a
                    href={spotifyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={spotifyLink ? "View artist on Spotify" : undefined}
                    className="relative block w-[72px] h-[72px] sm:w-28 sm:h-28 lg:w-36 lg:h-36 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 dark:ring-white/20"
                  >
                    {(avatarImage || heroImage) ? (
                      <img
                        src={(avatarImage || heroImage)!}
                        alt={artist.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <span className="text-xl sm:text-2xl font-bold text-muted-foreground">
                          {artist.name?.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </a>
                </div>

                {/* Info - Text with enhanced contrast */}
                <div className="flex-1 min-w-0 pb-1">
                  {/* Artist Name - Bold, clear typography */}
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight tracking-tight line-clamp-2 drop-shadow-sm">
                    {artist.name}
                  </h1>

                  {/* Meta Info - single muted line */}
                  <p className="mt-1 sm:mt-2 text-xs sm:text-sm font-medium text-foreground/75 truncate">
                    {artist.followers ? `${formatFollowerCount(artist.followers)} followers · ` : ""}
                    {upcomingShows.length} upcoming
                    {artist.genres && artist.genres.length > 0 && (
                      <span className="hidden sm:inline"> · {artist.genres[0]}</span>
                    )}
                  </p>

                  {/* Follow button - compact outlined pill */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => void handleFollow()}
                    aria-pressed={!!isFollowing}
                    className={`mt-2.5 sm:mt-4 inline-flex items-center gap-1.5 rounded-full border px-4 min-h-[40px] text-xs sm:text-sm font-semibold transition-colors ${
                      isFollowing
                        ? "border-border bg-secondary text-foreground"
                        : "border-foreground/30 bg-background/50 text-foreground backdrop-blur-sm hover:bg-secondary/70 active:bg-secondary/70"
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Following
                      </>
                    ) : (
                      <>
                        <Heart className="h-3.5 w-3.5" />
                        Follow
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 sm:px-6 pb-4 sm:pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Shows - Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="upcoming" className="w-full">
                {/* Sticky tab bar - stays under the fixed app header while scrolling */}
                <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 py-2 mb-2 bg-background/95 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground">Shows</h2>
                    <TabsList className="inline-flex bg-secondary/50 rounded-lg p-0.5 gap-0.5 h-auto">
                      <TabsTrigger value="upcoming" className="data-[state=active]:bg-background px-3 py-1.5 min-h-[36px] text-xs rounded-md">
                        Upcoming
                      </TabsTrigger>
                      <TabsTrigger value="past" className="data-[state=active]:bg-background px-3 py-1.5 min-h-[36px] text-xs rounded-md">
                        Past
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

            <MagicCard className="p-0 rounded-xl border border-border bg-card">
              <div className="px-2 py-1.5 sm:px-3 sm:py-2">

                <TabsContent value="upcoming" className="mt-0">
                  {!shows ? (
                    <ShowRowsSkeleton />
                  ) : isImportingShows ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="mt-4 text-base font-medium text-foreground">Fetching Shows</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Importing {artist.name}'s tour dates from Ticketmaster...
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">Usually takes 3-5 seconds</p>
                    </div>
                  ) : hasImportError ? (
                    <div className="text-center py-10 px-4 space-y-3">
                      <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                        <Music className="h-6 w-6 text-red-400" />
                      </div>
                      <p className="text-red-400 font-medium text-sm">{hasImportError}</p>
                      <p className="text-sm text-muted-foreground">There was an issue importing show data.</p>
                      <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                        Retry Import
                      </Button>
                    </div>
                  ) : upcomingShows.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No upcoming shows scheduled</p>
                      <p className="text-sm mt-1">Check back later for tour announcements</p>
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-border/50">
                      {upcomingShows.map((show) => (
                        <ArtistShowRow
                          key={show._id}
                          show={show}
                          onClick={() => onShowClick(show._id, (show as any).slug)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="past" className="mt-0">
                  {!shows ? (
                    <ShowRowsSkeleton />
                  ) : recentShows.length === 0 ? (
                    // lastSetlistfmHistorySyncAt is an optional field being added by the
                    // setlist.fm history import; absent (undefined) means the first import
                    // hasn't completed yet. Cast in case generated types lag the schema.
                    !(artist as any).lastSetlistfmHistorySyncAt ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Loader2 className="h-12 w-12 mx-auto mb-4 opacity-50 animate-spin" />
                        <p>Importing recent setlists from setlist.fm</p>
                        <p className="text-sm mt-1">Check back in a minute</p>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No recent setlists found on setlist.fm for this artist</p>
                        <p className="text-sm mt-1">Past shows will appear here after they happen</p>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col divide-y divide-border/50">
                      {recentShows.map((show) => (
                        <ArtistShowRow
                          key={show._id}
                          show={show}
                          past
                          onClick={() => onShowClick(show._id, (show as any).slug)}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </div>
              <BorderBeam size={120} duration={10} className="opacity-20" />
            </MagicCard>
          </Tabs>
        </div>

        {/* Top Songs - Right Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          <MagicCard className="p-0 rounded-xl border border-border bg-card">
            <div className="px-4 py-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                  <Music className="h-4 w-4 text-foreground" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground">Top Songs</h3>
              </div>
            
            {!songs ? (
              <div className="space-y-1">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 min-h-[44px] animate-pulse">
                    <div className="w-4 h-4 bg-secondary rounded"></div>
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-secondary rounded w-3/4"></div>
                      <div className="h-2.5 bg-secondary rounded w-1/2"></div>
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
              <div className="space-y-1">
                {songs.filter(Boolean).filter(song => song && !song.isLive && !song.isRemix).slice(0, 10).map((song, index) => {
                  if (!song) return null;
                  return (
                    <div
                      key={song._id}
                      className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50 active:bg-secondary transition-all duration-150 active:scale-[0.98] min-h-[44px]"
                    >
                      <div className="w-4 text-center text-xs text-muted-foreground">
                        {index + 1}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate leading-tight">{song.title}</h4>
                        {song.album && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {song.album}
                          </p>
                        )}
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToSetlist(song.title);
                        }}
                        className="flex items-center justify-center w-9 h-9 -mr-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        aria-label={user ? `Add ${song.title} to setlist` : `Add ${song.title} to prediction`}
                        title={user ? "Add to setlist" : "Add to prediction"}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
            <BorderBeam size={100} duration={8} className="opacity-20" />
          </MagicCard>

          {/* Artist Stats */}
          <MagicCard className="p-0 rounded-xl border border-border bg-card">
            <div className="px-4 py-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                  <Users className="h-4 w-4 text-foreground" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground">Artist Stats</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Upcoming shows</span>
                  <span className="font-medium text-foreground">{upcomingShows.length}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total songs</span>
                  <span className="font-medium text-foreground">{catalogSongCount ?? 0}</span>
                </div>
                
                {artist.followers && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Followers</span>
                    <span className="font-medium text-foreground">{artist.followers.toLocaleString()}</span>
                  </div>
                )}
                
                {artist.popularity && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Popularity</span>
                    <span className="font-medium text-foreground">{artist.popularity}%</span>
                  </div>
                )}
              </div>
            </div>
            <BorderBeam size={100} duration={8} className="opacity-20" />
          </MagicCard>
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
  </>
  );
}

function formatFollowerCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return count.toLocaleString();
}

/** Dense, tappable show row: date block · venue/location · status/chevron */
function ArtistShowRow({
  show,
  past = false,
  onClick,
}: {
  show: any;
  past?: boolean;
  onClick: () => void;
}) {
  const date = parseShowCalendarDate(show.date);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const year = date.getFullYear();
  const isTonight = !past && date.toDateString() === new Date().toDateString();
  const time = !past ? formatTimeCompact(show.startTime) : null;
  const hasSetlist = past && show.importStatus === "completed";

  const metaParts: string[] = [formatLocation(show.venue?.city, show.venue?.state)];
  if (past) {
    if (year !== new Date().getFullYear()) metaParts.push(String(year));
  } else {
    metaParts.push(weekday);
    if (time) metaParts.push(time);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-1.5 sm:px-2 py-2 min-h-[64px] text-left rounded-lg transition-colors duration-150 hover:bg-secondary/40 active:bg-secondary/50 touch-manipulation"
    >
      {/* Compact date block */}
      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-secondary ring-1 ring-border flex flex-col items-center justify-center">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-none">
          {month}
        </span>
        <span className="text-lg font-bold text-foreground leading-none mt-0.5">
          {day}
        </span>
      </div>

      {/* Venue + location */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-foreground leading-tight truncate">
          {show.venue?.name || "Venue TBA"}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {metaParts.filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* Status + chevron */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isTonight && (
          <span className="text-[11px] font-semibold text-foreground border border-foreground/50 rounded-full px-2 py-0.5">
            Tonight
          </span>
        )}
        {past && (
          hasSetlist ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-green-500 bg-green-500/10 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
              Setlist
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Awaiting setlist</span>
          )
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

/** Loading skeleton matching ArtistShowRow dimensions */
function ShowRowsSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border/50">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-1.5 sm:px-2 py-2 min-h-[64px] animate-pulse">
          <div className="w-12 h-12 rounded-lg bg-secondary flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-secondary rounded w-3/4" />
            <div className="h-3 bg-secondary rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
