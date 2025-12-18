import React from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppLayout } from "../components/AppLayout";
import { AuthGuard } from "../components/AuthGuard";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { MagicCard } from "../components/ui/magic-card";
import { Button } from "../components/ui/button";
import { Loader2, Music, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";

function hasSpotifyConnected(clerkUser: any): boolean {
  const accounts = clerkUser?.externalAccounts ?? [];
  return accounts.some((a: any) => a?.provider === "spotify" || a?.provider === "oauth_spotify");
}

export function StudioLandingPage() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, user } = useUser();

  const appUser = useQuery(api.auth.loggedInUser);

  const myArtists = useQuery((api as any).artistAccess.getMyArtists, isSignedIn ? {} : "skip");
  const myClaims = useQuery((api as any).artistClaims.getMyClaims, isSignedIn ? {} : "skip");
  const spotifyArtists = useQuery(
    (api as any).spotifyAuthQueries.getUserSpotifyArtistsForClaim,
    isSignedIn ? { limit: 50 } : "skip",
  );

  const createClaim = useMutation((api as any).artistClaims.create);

  const [selectedArtistId, setSelectedArtistId] = React.useState<string>("");
  const [claiming, setClaiming] = React.useState(false);

  const spotifyConnected = isSignedIn && user ? hasSpotifyConnected(user) : false;

  if (!isLoaded) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-10 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </AppLayout>
    );
  }

  if (!isSignedIn) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-10">
          <MagicCard className="p-8 max-w-xl mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Artist Studio</h1>
            <p className="text-muted-foreground mb-6">
              Sign in to access your artist dashboard and see what fans want to hear on tour.
            </p>
            <Button onClick={() => void navigate("/signin")} className="w-full">
              Sign In
            </Button>
          </MagicCard>
        </div>
      </AppLayout>
    );
  }

  if (!spotifyConnected) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-10">
          <MagicCard className="p-8 max-w-xl mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#1DB954]/15 flex items-center justify-center mx-auto mb-4">
              <Music className="h-7 w-7 text-[#1DB954]" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Connect Spotify to Continue</h1>
            <p className="text-muted-foreground mb-6">
              Artist Studio requires Spotify sign-in so we can link your account and let you claim your artist profile.
            </p>
            <Button
              onClick={() => void navigate("/spotify-connect")}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-foreground"
            >
              Connect Spotify
            </Button>
          </MagicCard>
        </div>
      </AppLayout>
    );
  }

  const pendingClaims = Array.isArray(myClaims) ? myClaims.filter((c: any) => c?.status === "pending") : [];
  const approvedClaims = Array.isArray(myClaims) ? myClaims.filter((c: any) => c?.status === "approved") : [];

  return (
    <ErrorBoundary>
      <AuthGuard>
        <AppLayout>
          <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold">Artist Studio</h1>
                <p className="text-muted-foreground">
                  Demand analytics powered by fan votes and your upcoming shows.
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {appUser?.appUser?.email ? `Signed in as ${appUser.appUser.email}` : ""}
              </div>
            </div>

            <MagicCard className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Your Artist Dashboards</h2>
                  <p className="text-sm text-muted-foreground">Open an artist to see upcoming shows and demand.</p>
                </div>
              </div>

              {myArtists === undefined ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : myArtists?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myArtists.map((row: any) => {
                    const artist = row.artist;
                    const img = Array.isArray(artist?.images) ? artist.images[0] : undefined;
                    return (
                      <div
                        key={artist._id}
                        className="flex items-center gap-4 rounded-xl border border-border bg-card/40 p-4"
                      >
                        <div className="w-12 h-12 rounded-xl bg-secondary overflow-hidden flex items-center justify-center">
                          {img ? (
                            <img src={img} alt={artist.name} className="w-full h-full object-cover" />
                          ) : (
                            <Music className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{artist.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            Role: {row.role}
                          </div>
                        </div>
                        <Button onClick={() => void navigate(`/studio/${artist._id}`)} variant="outline">
                          Open
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">No artist dashboards yet. Claim your artist below.</p>
              )}
            </MagicCard>

            <MagicCard className="p-6">
              <h2 className="text-xl font-semibold mb-2">Claim Your Artist</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Select an artist from your Spotify profile. Your claim will be reviewed.
              </p>

              {spotifyArtists === undefined ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your Spotify artists…
                </div>
              ) : spotifyArtists?.length ? (
                <div className="flex flex-col md:flex-row gap-3">
                  <select
                    value={selectedArtistId}
                    onChange={(e) => setSelectedArtistId(e.target.value)}
                    className="flex-1 h-10 rounded-lg bg-secondary border border-border px-3 text-sm text-foreground"
                  >
                    <option value="">Select an artist…</option>
                    {spotifyArtists.map((row: any) => (
                      <option key={row.artist._id} value={row.artist._id}>
                        {row.artist.name}
                        {row.isTopArtist ? " (Top)" : row.isFollowed ? " (Followed)" : ""}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={!selectedArtistId || claiming}
                    onClick={async () => {
                      if (!selectedArtistId) return;
                      setClaiming(true);
                      try {
                        const res = await createClaim({ artistId: selectedArtistId });
                        if (res?.status === "already_member") {
                          toast.info("You already have access to this artist.");
                          void navigate(`/studio/${selectedArtistId}`);
                          return;
                        }
                        toast.success("Claim submitted", {
                          description: "We’ll review your request and notify you when it’s approved.",
                        });
                      } catch (e: any) {
                        toast.error("Claim failed", { description: e?.message || "Unknown error" });
                      } finally {
                        setClaiming(false);
                      }
                    }}
                    className="md:w-40"
                  >
                    {claiming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Submitting…
                      </>
                    ) : (
                      "Claim"
                    )}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No Spotify artists imported yet. Reconnect Spotify or try again from your profile.
                </p>
              )}

              {!!pendingClaims.length && (
                <div className="mt-6 rounded-xl border border-border bg-card/40 p-4">
                  <div className="font-semibold mb-2">Pending Claims</div>
                  <div className="space-y-2">
                    {pendingClaims.map((c: any) => (
                      <div key={c._id} className="flex items-center justify-between gap-3">
                        <div className="text-sm">
                          {c.artist?.name ?? "Unknown artist"}
                          <span className="text-xs text-muted-foreground ml-2">(pending)</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.submittedAt ? new Date(c.submittedAt).toLocaleDateString() : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!!approvedClaims.length && (
                <div className="mt-6 rounded-xl border border-border bg-card/40 p-4">
                  <div className="font-semibold mb-2">Recently Approved</div>
                  <div className="space-y-2">
                    {approvedClaims.slice(0, 3).map((c: any) => (
                      <div key={c._id} className="flex items-center justify-between gap-3">
                        <div className="text-sm">{c.artist?.name ?? "Unknown artist"}</div>
                        <Button size="sm" variant="outline" onClick={() => void navigate(`/studio/${c.artistId}`)}>
                          Open
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </MagicCard>
          </div>
        </AppLayout>
      </AuthGuard>
    </ErrorBoundary>
  );
}

