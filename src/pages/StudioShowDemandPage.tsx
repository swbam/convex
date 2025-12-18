import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppLayout } from "../components/AppLayout";
import { AuthGuard } from "../components/AuthGuard";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { MagicCard } from "../components/ui/magic-card";
import { Button } from "../components/ui/button";
import { ArrowLeft, ChevronUp, Loader2, Music, MapPin, Calendar } from "lucide-react";

export function StudioShowDemandPage() {
  const navigate = useNavigate();
  const params = useParams();
  const artistId = params.artistId as string | undefined;
  const showId = params.showId as string | undefined;

  const data = useQuery((api as any).artistDashboard.getShowDemand, showId ? { showId } : "skip");

  return (
    <ErrorBoundary>
      <AuthGuard>
        <AppLayout>
          <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
            <Button variant="ghost" onClick={() => void navigate(artistId ? `/studio/${artistId}` : "/studio")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {data === undefined ? (
              <div className="text-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading show demand…</p>
              </div>
            ) : (
              <>
                <MagicCard className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-secondary overflow-hidden flex items-center justify-center">
                      {data.show?.artist?.images?.[0] ? (
                        <img
                          src={data.show.artist.images[0]}
                          alt={data.show.artist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl font-bold truncate">{data.show?.artist?.name ?? "Show"}</h1>
                      <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {data.show?.date}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {data.show?.venue?.name ?? "Venue"} • {data.show?.venue?.city ?? ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </MagicCard>

                <MagicCard className="p-6">
                  <h2 className="text-xl font-semibold mb-1">Top Requested Songs</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ranked by fan upvotes on the prediction setlist.
                  </p>

                  {Array.isArray(data.songs) && data.songs.length ? (
                    <div className="space-y-2">
                      {data.songs.slice(0, 50).map((row: any) => (
                        <div
                          key={row.songKey}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-4"
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{row.songTitle}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.inPrediction ? "In prediction list" : "Not in prediction list"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-primary font-semibold">
                            <ChevronUp className="h-4 w-4 fill-current" />
                            {row.upvotes ?? 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No demand data yet for this show.</p>
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

