import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppLayout } from "../components/AppLayout";
import { MagicCard } from "../components/ui/magic-card";
import { Button } from "../components/ui/button";
import { Loader2, Music, ShieldCheck, Mic2, Users } from "lucide-react";

function hasSpotifyConnected(clerkUser: any): boolean {
  const accounts = clerkUser?.externalAccounts ?? [];
  return accounts.some(
    (a: any) => a?.provider === "spotify" || a?.provider === "oauth_spotify"
  );
}

export function ForArtistsPage() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useAuth();

  // Check artist access
  const access = useQuery(
    (api as any).artistAccess.getMyArtistAccess,
    isSignedIn ? {} : "skip"
  );

  // Auto-join mutation for Spotify ID matches
  const autoJoin = useMutation((api as any).artistAccess.autoJoinAsOwner);
  const [autoJoining, setAutoJoining] = React.useState(false);

  const spotifyConnected = isSignedIn && user ? hasSpotifyConnected(user) : false;

  // Auto-redirect if user has access to exactly one artist
  useEffect(() => {
    if (access?.hasAccess && access.artists?.length === 1) {
      const artistId = access.artists[0].artist._id;
      navigate(`/for-artists/${artistId}`, { replace: true });
    }
  }, [access, navigate]);

  // Handle auto-join when Spotify ID matches but no membership exists yet
  useEffect(() => {
    async function tryAutoJoin() {
      if (
        access?.hasAccess &&
        access.artists?.length &&
        !autoJoining
      ) {
        // Check if any artist needs membership creation
        const needsJoin = access.artists.some(
          (a: any) => a.role === "owner" && !a._id
        );
        if (needsJoin) {
          setAutoJoining(true);
          try {
            const result = await autoJoin({});
            if (result.success && result.artistId) {
              navigate(`/for-artists/${result.artistId}`, { replace: true });
            }
          } catch (e) {
            console.error("Auto-join failed:", e);
          }
          setAutoJoining(false);
        }
      }
    }
    tryAutoJoin();
  }, [access, autoJoin, autoJoining, navigate]);

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
            <h2 className="text-2xl font-bold mb-2">Sign in with Spotify</h2>
            <p className="text-muted-foreground mb-6">
              Use your official Spotify artist account to access your dashboard.
            </p>
            <Button
              onClick={() => navigate("/signin")}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-white"
              size="lg"
            >
              Sign in with Spotify
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Only verified Spotify artists can access this portal.
            </p>
          </MagicCard>

          <div className="max-w-3xl mx-auto mt-16 grid md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Verified Access</h3>
              <p className="text-sm text-muted-foreground">
                Automatic verification through your Spotify artist account.
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
              Connect your Spotify artist account to access your dashboard.
            </p>
            <Button
              onClick={() => navigate("/spotify-connect")}
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
  if (access === undefined || autoJoining) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {autoJoining ? "Setting up your dashboard…" : "Checking access…"}
          </p>
        </div>
      </AppLayout>
    );
  }

  // Has access to multiple artists - show selection
  if (access.hasAccess && access.artists && access.artists.length > 1) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-10">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Your Artists</h1>
            <p className="text-muted-foreground mb-8">
              Select an artist to view their demand dashboard.
            </p>

            <div className="space-y-3">
              {access.artists.map((item: any) => {
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
          </div>
        </div>
      </AppLayout>
    );
  }

  // No access - not an artist
  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-16">
        <MagicCard className="p-8 max-w-lg mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Artist Access Only</h1>
          <p className="text-muted-foreground mb-6">
            This portal is for verified Spotify artists. Your Spotify account
            isn't linked to any artist profiles in our system.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              If you're an artist or team member, make sure you're signed in
              with the correct Spotify account, or ask the artist owner to
              invite you.
            </p>
            <div className="flex gap-3 justify-center pt-4">
              <Button variant="outline" onClick={() => navigate("/")}>
                Go Home
              </Button>
              <Button
                variant="ghost"
                onClick={() => signOut({ redirectUrl: "/for-artists" })}
              >
                Try Different Account
              </Button>
            </div>
          </div>
        </MagicCard>
      </div>
    </AppLayout>
  );
}
