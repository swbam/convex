import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppLayout } from "../components/AppLayout";
import { AuthGuard } from "../components/AuthGuard";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { MagicCard } from "../components/ui/magic-card";
import { Button } from "../components/ui/button";
import {
  Calendar,
  ChevronRight,
  Loader2,
  Music,
  ArrowLeft,
  Users,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  BarChart3,
  MapPin,
  Flame,
  CheckCircle,
  Download,
  ListMusic,
  History,
  Repeat,
} from "lucide-react";

type DashboardTab = "overview" | "tour" | "completed" | "history";

export function ForArtistsDashboardPage() {
  const navigate = useNavigate();
  const params = useParams();
  const artistId = params.artistId as string | undefined;
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  // Check if user has access to this artist
  const isMember = useQuery(
    (api as any).artistAccess.isArtistMember,
    artistId ? { artistId } : "skip"
  );

  // Get dashboard data
  const data = useQuery(
    (api as any).artistDashboard.getArtistHome,
    artistId ? { artistId } : "skip"
  );

  // Tour insights queries
  const tourOverview = useQuery(
    (api as any).artistDashboard.getTourOverview,
    artistId ? { artistId } : "skip"
  );

  const tourTopSongs = useQuery(
    (api as any).artistDashboard.getTourTopSongs,
    artistId && activeTab === "tour" ? { artistId, limit: 20 } : "skip"
  );

  const cityDeltas = useQuery(
    (api as any).artistDashboard.getCityDeltas,
    artistId && activeTab === "tour" ? { artistId } : "skip"
  );

  const songMomentum = useQuery(
    (api as any).artistDashboard.getSongMomentum,
    artistId && activeTab === "tour" ? { artistId, limit: 5 } : "skip"
  );

  const completedShows = useQuery(
    (api as any).artistDashboard.getCompletedShows,
    artistId && activeTab === "completed" ? { artistId, limit: 20 } : "skip"
  );

  // Historical setlists
  const historicalSetlists = useQuery(
    (api as any).artistDashboard.getHistoricalSetlists,
    artistId && activeTab === "history" ? { artistId, limit: 20 } : "skip"
  );

  const songFrequency = useQuery(
    (api as any).artistDashboard.getSongFrequency,
    artistId && activeTab === "history" ? { artistId, limit: 30 } : "skip"
  );

  // Get team members for owner badge
  const myArtists = useQuery((api as any).artistAccess.getMyArtists, {});
  const myRole = myArtists?.find((a: any) => a.artist._id === artistId)?.role;
  const isOwner = myRole === "owner";

  // Export top songs as CSV
  const handleExportTopSongs = () => {
    if (!tourTopSongs?.songs) return;
    const csv = [
      ["Rank", "Song", "Total Votes", "Shows Voted", "Avg Per Show", "Recent Votes"].join(","),
      ...tourTopSongs.songs.map((s: any, i: number) => 
        [i + 1, `"${s.songTitle}"`, s.totalUpvotes, s.showCount, s.avgPerShow, s.recentVotes].join(",")
      )
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data?.artist?.name || "artist"}-top-songs.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!artistId) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-10">
          <MagicCard className="p-8 text-center">
            <p className="text-muted-foreground">Missing artist ID.</p>
            <Button
              variant="outline"
              onClick={() => navigate("/for-artists")}
              className="mt-4"
            >
              Back to Artists
            </Button>
          </MagicCard>
        </div>
      </AppLayout>
    );
  }

  // Check access
  if (isMember === false) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-10">
          <MagicCard className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              You don't have access to this artist dashboard.
            </p>
            <Button variant="outline" onClick={() => navigate("/for-artists")}>
              Back to Artists
            </Button>
          </MagicCard>
        </div>
      </AppLayout>
    );
  }

  return (
    <ErrorBoundary>
      <AuthGuard>
        <AppLayout>
          <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button
                variant="ghost"
                onClick={() => navigate("/for-artists")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              {isOwner && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/for-artists/${artistId}/team`)}
                  className="gap-2"
                >
                  <Users className="h-4 w-4" />
                  Team
                </Button>
              )}
            </div>

            {data === undefined || isMember === undefined ? (
              <div className="text-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading dashboard…</p>
              </div>
            ) : (
              <>
                {/* Artist Header Card */}
                <MagicCard className="p-6">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="w-16 h-16 rounded-2xl bg-secondary overflow-hidden flex items-center justify-center flex-shrink-0">
                      {data.artist?.images?.[0] ? (
                        <img
                          src={data.artist.images[0]}
                          alt={data.artist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="h-7 w-7 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold truncate">
                          {data.artist?.name}
                        </h1>
                        {myRole && (
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                            {myRole}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {Array.isArray(data.shows)
                          ? `${data.shows.length} upcoming shows`
                          : "No upcoming shows"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(`/artists/${data.artist?.slug ?? artistId}`)
                      }
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Public Page
                    </Button>
                  </div>
                </MagicCard>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MagicCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {tourOverview?.stats?.upcomingShows ?? (Array.isArray(data.shows) ? data.shows.length : 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Upcoming Shows
                    </div>
                  </MagicCard>
                  <MagicCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {tourOverview?.stats?.totalVotes ?? 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Votes
                    </div>
                  </MagicCard>
                  <MagicCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {tourOverview?.stats?.uniqueSongsVoted ?? 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Songs Requested
                    </div>
                  </MagicCard>
                  <MagicCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {tourOverview?.stats?.completedShows ?? 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Completed Shows
                    </div>
                  </MagicCard>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 border-b border-border pb-1 overflow-x-auto">
                  {[
                    { id: "overview" as const, label: "Shows", icon: Calendar },
                    { id: "tour" as const, label: "Tour Insights", icon: BarChart3 },
                    { id: "completed" as const, label: "Past Shows", icon: CheckCircle },
                    { id: "history" as const, label: "Setlist History", icon: History },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? "bg-primary/10 text-primary border-b-2 border-primary -mb-[3px]"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {activeTab === "overview" && (
                  <MagicCard className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Upcoming Shows</h2>
                        <p className="text-sm text-muted-foreground">
                          Click a show to see what fans want to hear
                        </p>
                      </div>
                    </div>

                    {Array.isArray(data.shows) && data.shows.length ? (
                      <div className="space-y-2">
                        {data.shows.map((s: any) => (
                          <button
                            key={s._id}
                            className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-4 hover:bg-card/60 hover:border-primary/30 transition-colors text-left group"
                            onClick={() =>
                              navigate(`/for-artists/${artistId}/shows/${s._id}`)
                            }
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold truncate">
                                {s.venue?.name ?? "Venue"}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {s.venue?.city}
                                {s.venue?.state ? `, ${s.venue.state}` : ""}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm font-medium">{s.date}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 justify-end">
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  {s.voteCount ?? 0} votes
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground">
                          No upcoming shows found.
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Shows are synced from Ticketmaster automatically.
                        </p>
                      </div>
                    )}
                  </MagicCard>
                )}

                {activeTab === "tour" && (
                  <div className="space-y-6">
                    {/* Tour-wide Top Songs */}
                    <MagicCard className="p-6">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                            <ListMusic className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h2 className="text-xl font-semibold">Tour Top Songs</h2>
                            <p className="text-sm text-muted-foreground">
                              Most requested songs across all upcoming shows
                            </p>
                          </div>
                        </div>
                        {tourTopSongs?.songs?.length > 0 && (
                          <Button variant="outline" size="sm" onClick={handleExportTopSongs} className="gap-2">
                            <Download className="h-4 w-4" />
                            Export CSV
                          </Button>
                        )}
                      </div>

                      {tourTopSongs === undefined ? (
                        <div className="text-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        </div>
                      ) : tourTopSongs?.songs?.length > 0 ? (
                        <div className="space-y-2">
                          {tourTopSongs.songs.slice(0, 15).map((song: any, i: number) => (
                            <div
                              key={song.songKey}
                              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
                            >
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{song.songTitle}</div>
                                <div className="text-xs text-muted-foreground">
                                  Voted in {song.showCount} {song.showCount === 1 ? "show" : "shows"}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-primary">{song.totalUpvotes}</div>
                                <div className="text-xs text-muted-foreground">votes</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <ListMusic className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                          <p className="text-muted-foreground">No votes yet across your tour.</p>
                        </div>
                      )}
                    </MagicCard>

                    {/* Song Momentum */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <MagicCard className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                            <Flame className="h-5 w-5 text-green-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold">Trending Up</h3>
                            <p className="text-xs text-muted-foreground">
                              Songs gaining momentum this week
                            </p>
                          </div>
                        </div>

                        {songMomentum === undefined ? (
                          <div className="text-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                          </div>
                        ) : songMomentum?.trending?.length > 0 ? (
                          <div className="space-y-2">
                            {songMomentum.trending.map((song: any) => (
                              <div key={song.songKey} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-green-500/5">
                                <span className="truncate text-sm">{song.songTitle}</span>
                                <span className="text-xs font-medium text-green-600 flex items-center gap-1 shrink-0">
                                  <TrendingUp className="h-3 w-3" />
                                  +{song.momentum}%
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Not enough data yet
                          </p>
                        )}
                      </MagicCard>

                      <MagicCard className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
                            <TrendingDown className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold">Cooling Off</h3>
                            <p className="text-xs text-muted-foreground">
                              Songs losing momentum
                            </p>
                          </div>
                        </div>

                        {songMomentum === undefined ? (
                          <div className="text-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                          </div>
                        ) : songMomentum?.falling?.length > 0 ? (
                          <div className="space-y-2">
                            {songMomentum.falling.map((song: any) => (
                              <div key={song.songKey} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-orange-500/5">
                                <span className="truncate text-sm">{song.songTitle}</span>
                                <span className="text-xs font-medium text-orange-600 flex items-center gap-1 shrink-0">
                                  <TrendingDown className="h-3 w-3" />
                                  {song.momentum}%
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Not enough data yet
                          </p>
                        )}
                      </MagicCard>
                    </div>

                    {/* City Deltas */}
                    <MagicCard className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold">City Insights</h2>
                          <p className="text-sm text-muted-foreground">
                            What each city wants more (or less) than average
                          </p>
                        </div>
                      </div>

                      {cityDeltas === undefined ? (
                        <div className="text-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        </div>
                      ) : cityDeltas?.cities?.length > 0 ? (
                        <div className="space-y-4">
                          {cityDeltas.cities.map((city: any) => (
                            <div key={city.city} className="p-4 rounded-xl bg-secondary/30">
                              <div className="flex items-center justify-between mb-3">
                                <div className="font-semibold">{city.city}</div>
                                <div className="text-xs text-muted-foreground">
                                  {city.showCount} {city.showCount === 1 ? "show" : "shows"} • {city.totalVotes} votes
                                </div>
                              </div>
                              <div className="grid md:grid-cols-2 gap-3">
                                {city.overIndexed?.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium text-green-600 mb-1">🔥 Wants more:</div>
                                    <div className="space-y-1">
                                      {city.overIndexed.map((song: any) => (
                                        <div key={song.songKey} className="text-sm flex justify-between">
                                          <span className="truncate">{song.songTitle}</span>
                                          <span className="text-green-600 shrink-0">+{song.delta}%</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {city.underIndexed?.length > 0 && (
                                  <div>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">📉 Less interested:</div>
                                    <div className="space-y-1">
                                      {city.underIndexed.map((song: any) => (
                                        <div key={song.songKey} className="text-sm flex justify-between">
                                          <span className="truncate">{song.songTitle}</span>
                                          <span className="text-muted-foreground shrink-0">{song.delta}%</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <MapPin className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                          <p className="text-muted-foreground">Not enough city data yet.</p>
                        </div>
                      )}
                    </MagicCard>
                  </div>
                )}

                {activeTab === "completed" && (
                  <MagicCard className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Completed Shows</h2>
                        <p className="text-sm text-muted-foreground">
                          View post-show reports and compare predictions to actuals
                        </p>
                      </div>
                    </div>

                    {completedShows === undefined ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                      </div>
                    ) : completedShows?.shows?.length > 0 ? (
                      <div className="space-y-2">
                        {completedShows.shows.map((show: any) => (
                          <button
                            key={show._id}
                            className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-4 hover:bg-card/60 hover:border-primary/30 transition-colors text-left group"
                            onClick={() => navigate(`/for-artists/${artistId}/shows/${show._id}`)}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold truncate">
                                {show.venue?.name ?? "Venue"}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {show.venue?.city}
                                {show.venue?.state ? `, ${show.venue.state}` : ""}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm font-medium">{show.date}</div>
                              <div className="text-xs text-muted-foreground">
                                {show.hasActualSetlist ? (
                                  <span className="text-green-600 flex items-center gap-1 justify-end">
                                    <CheckCircle className="h-3 w-3" />
                                    Report available
                                  </span>
                                ) : (
                                  "No setlist yet"
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <CheckCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground">No completed shows yet.</p>
                      </div>
                    )}
                  </MagicCard>
                )}

                {activeTab === "history" && (
                  <div className="space-y-6">
                    {/* Song Frequency */}
                    <MagicCard className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
                          <Repeat className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold">Most Played Songs</h2>
                          <p className="text-sm text-muted-foreground">
                            Song frequency across your recent shows
                          </p>
                        </div>
                      </div>

                      {songFrequency === undefined ? (
                        <div className="text-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        </div>
                      ) : songFrequency?.songs?.length > 0 ? (
                        <div className="space-y-2">
                          {songFrequency.songs.slice(0, 15).map((song: any, i: number) => (
                            <div
                              key={song.songKey}
                              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30"
                            >
                              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-sm font-bold text-purple-500">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{song.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  Last played: {song.lastPlayed}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-purple-500">{song.percentage}%</div>
                                <div className="text-xs text-muted-foreground">
                                  {song.count}/{songFrequency.totalShowsAnalyzed} shows
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Repeat className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                          <p className="text-muted-foreground">No historical setlist data yet.</p>
                        </div>
                      )}
                      
                      {songFrequency?.totalShowsAnalyzed > 0 && (
                        <p className="text-xs text-muted-foreground mt-4 text-center">
                          Based on {songFrequency.totalShowsAnalyzed} shows with setlist data
                        </p>
                      )}
                    </MagicCard>

                    {/* Historical Setlists */}
                    <MagicCard className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                          <History className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold">Recent Setlists</h2>
                          <p className="text-sm text-muted-foreground">
                            Actual setlists from past shows (via setlist.fm)
                          </p>
                        </div>
                      </div>

                      {historicalSetlists === undefined ? (
                        <div className="text-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        </div>
                      ) : historicalSetlists?.setlists?.length > 0 ? (
                        <div className="space-y-3">
                          {historicalSetlists.setlists.map((setlist: any) => (
                            <details
                              key={setlist.showId}
                              className="rounded-xl border border-border bg-card/40 overflow-hidden group"
                            >
                              <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer hover:bg-card/60 transition-colors">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold truncate">
                                    {setlist.venue?.name ?? "Unknown Venue"}
                                  </div>
                                  <div className="text-sm text-muted-foreground truncate">
                                    {setlist.venue?.city}
                                    {setlist.venue?.state ? `, ${setlist.venue.state}` : ""}
                                    {" • "}
                                    {setlist.date}
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-sm font-medium text-blue-500">
                                    {setlist.songCount} songs
                                  </div>
                                </div>
                              </summary>
                              <div className="border-t border-border p-4 bg-secondary/20">
                                <ol className="space-y-1">
                                  {setlist.songs?.map((song: any, idx: number) => (
                                    <li key={idx} className="text-sm flex gap-2">
                                      <span className="text-muted-foreground w-6 text-right shrink-0">
                                        {idx + 1}.
                                      </span>
                                      <span className="flex-1">
                                        {song.title}
                                        {song.encore && (
                                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                            Encore
                                          </span>
                                        )}
                                      </span>
                                    </li>
                                  ))}
                                </ol>
                                {setlist.setlistFmUrl && (
                                  <a
                                    href={setlist.setlistFmUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
                                  >
                                    View on setlist.fm
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </details>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                          <p className="text-muted-foreground">No historical setlists found.</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Setlists are imported from setlist.fm for completed shows.
                          </p>
                        </div>
                      )}
                    </MagicCard>
                  </div>
                )}
              </>
            )}
          </div>
        </AppLayout>
      </AuthGuard>
    </ErrorBoundary>
  );
}
