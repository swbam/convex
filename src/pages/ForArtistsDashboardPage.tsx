import React from "react";
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
} from "lucide-react";

export function ForArtistsDashboardPage() {
  const navigate = useNavigate();
  const params = useParams();
  const artistId = params.artistId as string | undefined;

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

  // Get team members for owner badge
  const myArtists = useQuery((api as any).artistAccess.getMyArtists, {});
  const myRole = myArtists?.find((a: any) => a.artist._id === artistId)?.role;
  const isOwner = myRole === "owner";

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
                      {Array.isArray(data.shows) ? data.shows.length : 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Upcoming Shows
                    </div>
                  </MagicCard>
                  <MagicCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {Array.isArray(data.shows)
                        ? data.shows.reduce(
                            (sum: number, s: any) => sum + (s.voteCount ?? 0),
                            0
                          )
                        : 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Votes
                    </div>
                  </MagicCard>
                  <MagicCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {Array.isArray(data.shows)
                        ? data.shows.reduce(
                            (sum: number, s: any) =>
                              sum + (s.setlistCount ?? 0),
                            0
                          )
                        : 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Setlist Predictions
                    </div>
                  </MagicCard>
                  <MagicCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {data.artist?.followers
                        ? (data.artist.followers / 1000).toFixed(1) + "K"
                        : "—"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Spotify Followers
                    </div>
                  </MagicCard>
                </div>

                {/* Upcoming Shows */}
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
              </>
            )}
          </div>
        </AppLayout>
      </AuthGuard>
    </ErrorBoundary>
  );
}
