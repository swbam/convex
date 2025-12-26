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
  ArrowLeft,
  ChevronUp,
  Loader2,
  Music,
  MapPin,
  Calendar,
  Download,
  ListMusic,
  Ticket,
} from "lucide-react";

export function ForArtistsShowDemandPage() {
  const navigate = useNavigate();
  const params = useParams();
  const artistId = params.artistId as string | undefined;
  const showId = params.showId as string | undefined;

  const data = useQuery(
    (api as any).artistDashboard.getShowDemand,
    showId ? { showId } : "skip"
  );

  // Check access
  const isMember = useQuery(
    (api as any).artistAccess.isArtistMember,
    artistId ? { artistId } : "skip"
  );

  // Export functionality
  const handleExport = () => {
    if (!data?.songs?.length) return;

    const lines = [
      `# Song Demand - ${data.show?.artist?.name}`,
      `# ${data.show?.venue?.name}, ${data.show?.venue?.city}`,
      `# ${data.show?.date}`,
      `# Generated: ${new Date().toISOString()}`,
      "",
      "Rank,Song Title,Votes,In Prediction",
    ];

    data.songs.forEach((row: any, idx: number) => {
      lines.push(
        `${idx + 1},"${row.songTitle}",${row.upvotes ?? 0},${row.inPrediction ? "Yes" : "No"}`
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demand-${data.show?.artist?.slug ?? "artist"}-${data.show?.date ?? "show"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!showId || !artistId) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-10">
          <MagicCard className="p-8 text-center">
            <p className="text-muted-foreground">Missing show or artist ID.</p>
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
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button
                variant="ghost"
                onClick={() => navigate(`/for-artists/${artistId}`)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              {data?.songs?.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              )}
            </div>

            {data === undefined || isMember === undefined ? (
              <div className="text-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading show demand…</p>
              </div>
            ) : (
              <>
                {/* Show Header */}
                <MagicCard className="p-6">
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="w-16 h-16 rounded-2xl bg-secondary overflow-hidden flex items-center justify-center flex-shrink-0">
                      {data.show?.artist?.images?.[0] ? (
                        <img
                          src={data.show.artist.images[0]}
                          alt={data.show.artist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="h-7 w-7 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl font-bold truncate">
                        {data.show?.artist?.name ?? "Show"}
                      </h1>
                      <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {data.show?.date}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {data.show?.venue?.name ?? "Venue"} •{" "}
                          {data.show?.venue?.city ?? ""}
                          {data.show?.venue?.state
                            ? `, ${data.show.venue.state}`
                            : ""}
                        </span>
                      </div>
                      {data.show?.ticketUrl && (
                        <a
                          href={data.show.ticketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                        >
                          <Ticket className="h-4 w-4" />
                          View Tickets
                        </a>
                      )}
                    </div>
                  </div>
                </MagicCard>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4">
                  <MagicCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {Array.isArray(data.songs) ? data.songs.length : 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Songs Voted
                    </div>
                  </MagicCard>
                  <MagicCard className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {Array.isArray(data.songs)
                        ? data.songs.reduce(
                            (sum: number, s: any) => sum + (s.upvotes ?? 0),
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
                      {data.show?.setlistCount ?? 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Predictions
                    </div>
                  </MagicCard>
                </div>

                {/* Song Demand List */}
                <MagicCard className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <ListMusic className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">
                        Top Requested Songs
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Ranked by fan upvotes
                      </p>
                    </div>
                  </div>

                  {Array.isArray(data.songs) && data.songs.length ? (
                    <div className="space-y-2">
                      {data.songs.slice(0, 50).map((row: any, idx: number) => (
                        <div
                          key={row.songKey}
                          className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {row.songTitle}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.inPrediction
                                ? "✓ In fan predictions"
                                : "Write-in request"}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-primary font-semibold">
                            <ChevronUp className="h-4 w-4 fill-current" />
                            <span className="text-lg">{row.upvotes ?? 0}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <ListMusic className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        No song requests yet for this show.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Fans can vote on the public show page.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() =>
                          navigate(`/shows/${data.show?.slug ?? showId}`)
                        }
                      >
                        View Public Page
                      </Button>
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
