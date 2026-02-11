import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppLayout } from "../components/AppLayout";
import { MagicCard } from "../components/ui/magic-card";
import { Button } from "../components/ui/button";
import { Loader2, Music, ShieldCheck, Mic2, Users, Search, Zap } from "lucide-react";
import { toast } from "sonner";

function hasSpotifyConnected(clerkUser: any): boolean {
  const accounts = clerkUser?.externalAccounts ?? [];
  return accounts.some(
    (a: any) => a?.provider === "spotify" || a?.provider === "oauth_spotify"
  );
}

// Admin component to search and quick-claim any artist
function AdminArtistSearch({ 
  onClaim, 
  claiming 
}: { 
  onClaim: (artistId: string, artistName: string) => Promise<void>;
  claiming: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  const searchResults = useQuery(
    (api as any).artists.search,
    debouncedQuery.length >= 2 ? { query: debouncedQuery, limit: 10 } : "skip"
  );
  
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search any artist in the database..."
          className="w-full h-10 rounded-lg bg-background border border-primary/30 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>
      
      {searchQuery.length >= 2 && (
        <div className="rounded-lg border border-border bg-background max-h-60 overflow-y-auto">
          {searchResults === undefined ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No artists found for "{searchQuery}"
            </div>
          ) : (
            searchResults.map((artist: any) => (
              <div
                key={artist._id}
                className="flex items-center justify-between gap-3 p-3 hover:bg-secondary/50 border-b border-border last:border-b-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {artist.images?.[0] ? (
                      <img src={artist.images[0]} alt={artist.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{artist.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {artist.genres?.slice(0, 2).join(", ") || "No genres"}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onClaim(artist._id, artist.name)}
                  disabled={claiming}
                  className="shrink-0 gap-1"
                >
                  {claiming ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-3 w-3" />
                      Claim
                    </>
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ForArtistsPage() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useAuth();

  const spotifyConnected = isSignedIn && user ? hasSpotifyConnected(user) : false;

  const myArtists = useQuery((api as any).artistAccess.getMyArtists, isSignedIn ? {} : "skip");
  const myClaims = useQuery((api as any).artistClaims.getMyClaims, isSignedIn ? {} : "skip");
  const spotifyArtists = useQuery(
    (api as any).spotifyAuthQueries.getUserSpotifyArtistsForClaim,
    isSignedIn && spotifyConnected ? { limit: 50 } : "skip",
  );

  const completeSpotifyImport = useAction(api.spotifyOAuth.completeSpotifyImport);
  
  // Admin features
  const appUser = useQuery((api as any).users.getCurrentUser, isSignedIn ? {} : "skip");
  const isAdmin = appUser?.role === "admin";
  const adminQuickClaim = useMutation((api as any).artistClaims.adminQuickClaim);
  const searchArtists = useQuery(
    (api as any).artists.search,
    isAdmin ? { query: "", limit: 0 } : "skip" // Empty query to check if function exists
  );

  const [selectedArtistId, setSelectedArtistId] = useState<string>("");
  const [syncingSpotify, setSyncingSpotify] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminClaiming, setAdminClaiming] = useState(false);

  // Note: Removed auto-redirect to allow users to claim additional artists

  // Loading state
  if (!isLoaded) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </AppLayout>
    );
  }

  // Not signed in - show sign in prompt
  if (!isSignedIn) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-6">
              <Mic2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">For Artists</h1>
            <p className="text-xl text-muted-foreground">
              See what your fans want to hear on tour. Access real-time demand
              data powered by fan votes.
            </p>
          </div>

          <MagicCard className="p-8 max-w-md mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#1DB954]/15 flex items-center justify-center mx-auto mb-4">
              <Music className="h-7 w-7 text-[#1DB954]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Sign in</h2>
            <p className="text-muted-foreground mb-6">
              Connect Spotify to claim your artist page and access demand analytics.
            </p>
            <Button
              onClick={() => navigate("/signin")}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-white"
              size="lg"
            >
              Sign in with Spotify
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              If you’re on a team, ask the artist owner to invite you by email.
            </p>
          </MagicCard>

          <div className="max-w-3xl mx-auto mt-16 grid md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Verified Access</h3>
              <p className="text-sm text-muted-foreground">
                Claim your artist page with email verification and quick review.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Music className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Song Demand</h3>
              <p className="text-sm text-muted-foreground">
                See which songs fans are requesting for each show.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Team Access</h3>
              <p className="text-sm text-muted-foreground">
                Invite your team members to view demand analytics.
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Signed in but no Spotify connected
  if (!spotifyConnected) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16">
          <MagicCard className="p-8 max-w-md mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#1DB954]/15 flex items-center justify-center mx-auto mb-4">
              <Music className="h-7 w-7 text-[#1DB954]" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Connect Spotify</h1>
            <p className="text-muted-foreground mb-6">
              Connect Spotify so you can claim your artist page (or accept team invites).
            </p>
            <Button
              onClick={() => navigate("/spotify-connect?returnTo=/for-artists")}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-white"
              size="lg"
            >
              Connect Spotify
            </Button>
          </MagicCard>
        </div>
      </AppLayout>
    );
  }

  // Loading access data
  if (myArtists === undefined) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your artists…</p>
        </div>
      </AppLayout>
    );
  }

  // Has access to artists - show selection + claim option
  if (Array.isArray(myArtists) && myArtists.length >= 1) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-10">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Your Artists</h1>
            <p className="text-muted-foreground mb-8">
              Select an artist to view their demand dashboard.
            </p>

            <div className="space-y-3">
              {myArtists.map((item: any) => {
                const artist = item.artist;
                const img = Array.isArray(artist?.images)
                  ? artist.images[0]
                  : undefined;
                return (
                  <MagicCard
                    key={artist._id}
                    className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => navigate(`/for-artists/${artist._id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-secondary overflow-hidden flex items-center justify-center flex-shrink-0">
                        {img ? (
                          <img
                            src={img}
                            alt={artist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-lg truncate">
                          {artist.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.role === "owner"
                            ? "Owner"
                            : item.role === "manager"
                              ? "Manager"
                              : "Viewer"}
                        </div>
                      </div>
                      <Button variant="outline">Open</Button>
                    </div>
                  </MagicCard>
                );
              })}
            </div>

            {/* Claim another artist section */}
            <MagicCard className="mt-8 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Claim another artist</div>
                  <div className="text-sm text-muted-foreground">
                    Add access to more artists from your Spotify
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedArtistId}
                  onChange={(e) => setSelectedArtistId(e.target.value)}
                  className="flex-1 h-10 rounded-lg bg-secondary border border-border px-3 text-sm text-foreground"
                >
                  <option value="">Select an artist…</option>
                  {(spotifyArtists || []).map((row: any) => (
                    <option key={row.artist._id} value={row.artist._id}>
                      {row.artist.name}
                      {row.isTopArtist ? " (Top)" : row.isFollowed ? " (Followed)" : ""}
                    </option>
                  ))}
                </select>
                <Button
                  disabled={!selectedArtistId}
                  onClick={() => {
                    if (selectedArtistId) navigate(`/for-artists/claim/${selectedArtistId}`);
                  }}
                >
                  Claim →
                </Button>
              </div>
            </MagicCard>
          </div>
        </div>
      </AppLayout>
    );
  }

  // No access yet: show claim UI + claim status
  const inProgressClaims = Array.isArray(myClaims) ? myClaims.filter((c: any) => c?.status === "draft" || c?.status === "verifying") : [];
  const pendingClaims = Array.isArray(myClaims) ? myClaims.filter((c: any) => c?.status === "pending") : [];
  const approvedClaims = Array.isArray(myClaims) ? myClaims.filter((c: any) => c?.status === "approved") : [];

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto space-y-6">
          <MagicCard className="p-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-1">Claim your artist page</h1>
                <p className="text-muted-foreground">
                  Pick an artist from your Spotify profile. We’ll review your claim and then you’ll get access to the dashboard.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedArtistId}
                  onChange={(e) => setSelectedArtistId(e.target.value)}
                  className="flex-1 h-10 rounded-lg bg-secondary border border-border px-3 text-sm text-foreground"
                >
                  <option value="">Select an artist…</option>
                  {(spotifyArtists || []).map((row: any) => (
                    <option key={row.artist._id} value={row.artist._id}>
                      {row.artist.name}
                      {row.isTopArtist ? " (Top)" : row.isFollowed ? " (Followed)" : ""}
                    </option>
                  ))}
                </select>

                <Button
                  disabled={!selectedArtistId}
                  onClick={() => {
                    if (!selectedArtistId) return;
                    navigate(`/for-artists/claim/${selectedArtistId}`);
                  }}
                  className="sm:w-40"
                >
                  Claim →
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Not seeing your artist? Re-sync your Spotify artists.
                </p>
                <Button
                  variant="outline"
                  disabled={syncingSpotify}
                  onClick={async () => {
                    try {
                      setSyncingSpotify(true);
                      const token = await user?.getToken({ template: "spotify" });
                      if (!token) {
                        toast.error("Spotify token not available", { description: "Try reconnecting Spotify." });
                        return;
                      }
                      const result = await completeSpotifyImport({ accessToken: token });
                      toast.success("Spotify synced", {
                        description: `Imported ${result.imported} new artists, matched ${result.correlated}.`,
                      });
                    } catch (e: any) {
                      toast.error("Spotify sync failed", { description: e?.message || "Unknown error" });
                    } finally {
                      setSyncingSpotify(false);
                    }
                  }}
                >
                  {syncingSpotify ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Syncing…
                    </>
                  ) : (
                    "Sync Spotify"
                  )}
                </Button>
              </div>

              {spotifyArtists === undefined && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your Spotify artists…
                </div>
              )}
              {Array.isArray(spotifyArtists) && spotifyArtists.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No Spotify artists imported yet. If you just connected Spotify, wait a moment and refresh—otherwise hit “Sync Spotify”.
                </p>
              )}
            </div>

            {/* Admin Quick Claim */}
            {isAdmin && (
              <div className="mt-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-primary">Admin: Quick Claim Any Artist</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Bypass all verification and instantly access any artist's real data.
                </p>
                <AdminArtistSearch
                  onClaim={async (artistId: string, artistName: string) => {
                    setAdminClaiming(true);
                    try {
                      const result = await adminQuickClaim({ artistId });
                      if (result.success) {
                        toast.success(`Access granted to ${artistName}`, { 
                          description: result.message 
                        });
                        navigate(`/for-artists/${artistId}`);
                      } else {
                        toast.error("Claim failed", { description: result.message });
                      }
                    } catch (e: any) {
                      toast.error("Claim failed", { description: e?.message });
                    }
                    setAdminClaiming(false);
                  }}
                  claiming={adminClaiming}
                />
              </div>
            )}

            {!!inProgressClaims.length && (
              <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="font-semibold mb-2 text-amber-600 dark:text-amber-400">Continue your claim</div>
                <div className="space-y-2">
                  {inProgressClaims.map((c: any) => (
                    <div key={c._id} className="flex items-center justify-between gap-3">
                      <div className="text-sm">
                        {c.artist?.name ?? "Unknown artist"}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({c.status === "verifying" ? "verify email" : "in progress"})
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/for-artists/claim/${c.artistId}`)}
                      >
                        Continue
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!pendingClaims.length && (
              <div className="mt-6 rounded-xl border border-border bg-card/40 p-4">
                <div className="font-semibold mb-2">Pending review</div>
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
                <div className="font-semibold mb-2">Approved</div>
                <div className="space-y-2">
                  {approvedClaims.slice(0, 3).map((c: any) => (
                    <div key={c._id} className="flex items-center justify-between gap-3">
                      <div className="text-sm">{c.artist?.name ?? "Unknown artist"}</div>
                      {c.artistId ? (
                        <Button size="sm" variant="outline" onClick={() => void navigate(`/for-artists/${c.artistId}`)}>
                          Open
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </MagicCard>

          <MagicCard className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold">On a team?</div>
                <div className="text-sm text-muted-foreground">
                  Ask the artist owner to invite you by email (Settings → Team).
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => navigate("/")}>
                Go Home
              </Button>
              <Button variant="ghost" onClick={() => signOut({ redirectUrl: "/for-artists" })}>
                Try Different Account
              </Button>
            </div>
          </MagicCard>
        </div>
      </div>
    </AppLayout>
  );
}
