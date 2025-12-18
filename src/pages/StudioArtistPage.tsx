import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppLayout } from "../components/AppLayout";
import { AuthGuard } from "../components/AuthGuard";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { MagicCard } from "../components/ui/magic-card";
import { Button } from "../components/ui/button";
import { Calendar, ChevronRight, Loader2, Music, ArrowLeft } from "lucide-react";

export function StudioArtistPage() {
  const navigate = useNavigate();
  const params = useParams();
  const artistId = params.artistId as string | undefined;

  const data = useQuery(
    (api as any).artistDashboard.getArtistHome,
    artistId ? { artistId } : "skip",
  );

  return (
    <ErrorBoundary>
      <AuthGuard>
        <AppLayout>
          <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button variant="ghost" onClick={() => void navigate("/studio")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>

            {!artistId ? (
              <MagicCard className="p-8 text-center">
                <p className="text-muted-foreground">Missing artist id.</p>
              </MagicCard>
            ) : data === undefined ? (
              <div className="text-center py-10">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading dashboard…</p>
              </div>
            ) : (
              <>
                <MagicCard className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-secondary overflow-hidden flex items-center justify-center">
                      {data.artist?.images?.[0] ? (
                        <img
                          src={data.artist.images[0]}
                          alt={data.artist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl font-bold truncate">{data.artist?.name}</h1>
                      <p className="text-sm text-muted-foreground truncate">
                        Upcoming shows: {Array.isArray(data.shows) ? data.shows.length : 0}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => void navigate(`/artists/${data.artist?.slug ?? artistId}`)}>
                      Public Page
                    </Button>
                  </div>
                </MagicCard>

                <MagicCard className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Upcoming Shows</h2>
                      <p className="text-sm text-muted-foreground">Open a show to see what fans want tonight.</p>
                    </div>
                  </div>

                  {Array.isArray(data.shows) && data.shows.length ? (
                    <div className="space-y-2">
                      {data.shows.map((s: any) => (
                        <button
                          key={s._id}
                          className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-4 hover:bg-card/60 transition-colors text-left"
                          onClick={() => void navigate(`/studio/${artistId}/shows/${s._id}`)}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">
                              {s.venue?.name ?? "Venue"} — {s.venue?.city ?? ""}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {s.date} • votes: {s.voteCount ?? 0} • setlists: {s.setlistCount ?? 0}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No upcoming shows found yet.</p>
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

