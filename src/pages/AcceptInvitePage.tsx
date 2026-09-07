import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppLayout } from "../components/AppLayout";
import { MagicCard } from "../components/ui/magic-card";
import { Button } from "../components/ui/button";
import {
  Loader2,
  Music,
  CheckCircle,
  XCircle,
  Clock,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { capture, captureException } from "../lib/analytics";

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const { token } = useParams();
  const { isLoaded, isSignedIn } = useUser();
  const [accepting, setAccepting] = useState(false);

  const getInvitePreview = useAction((api as any).artistInvites.getInvitePreview);
  const acceptInvite = useAction((api as any).artistInvites.acceptInvite);
  const [invite, setInvite] = useState<any | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (!token) {
      setInvite(null);
      return;
    }
    void getInvitePreview({ token })
      .then((result) => {
        if (active) setInvite(result);
      })
      .catch(() => {
        if (active) setInvite(null);
      });
    return () => {
      active = false;
    };
  }, [getInvitePreview, token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const result = await acceptInvite({ token });
      if (result.success) {
        capture("artist_team_invite_accepted", {
          artist_id: result.artistId,
          invited_role: invite?.role,
        });
        toast.success(result.message);
        navigate(`/for-artists/${result.artistId}`);
      } else {
        toast.error(result.message || "Failed to accept invite");
      }
    } catch (error: any) {
      captureException(error, { operation: "artist_team_invite_accept", artist_id: invite?.artistId });
      toast.error(error.message || "Failed to accept invite");
    }
    setAccepting(false);
  };

  // Loading
  if (!isLoaded || invite === undefined) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading invite...</p>
        </div>
      </AppLayout>
    );
  }

  // Invalid invite
  if (!invite) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16">
          <MagicCard className="p-8 max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Invalid Invite</h1>
            <p className="text-muted-foreground mb-6">
              This invite link is invalid or has been removed.
            </p>
            <Button onClick={() => navigate("/for-artists")}>
              Go to Artist Portal
            </Button>
          </MagicCard>
        </div>
      </AppLayout>
    );
  }

  // Expired invite
  if (invite.isExpired || invite.status === "expired") {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16">
          <MagicCard className="p-8 max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-6">
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Invite Expired</h1>
            <p className="text-muted-foreground mb-6">
              This invite has expired. Ask the team owner to send a new invite.
            </p>
            <Button onClick={() => navigate("/for-artists")}>
              Go to Artist Portal
            </Button>
          </MagicCard>
        </div>
      </AppLayout>
    );
  }

  // Already used
  if (invite.status === "accepted") {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16">
          <MagicCard className="p-8 max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Already Accepted</h1>
            <p className="text-muted-foreground mb-6">
              This invite has already been used.
            </p>
            <Button onClick={() => navigate(`/for-artists/${invite.artistId}`)}>
              Open Dashboard
            </Button>
          </MagicCard>
        </div>
      </AppLayout>
    );
  }

  // Revoked
  if (invite.status === "revoked") {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16">
          <MagicCard className="p-8 max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Invite Revoked</h1>
            <p className="text-muted-foreground mb-6">
              This invite has been revoked by the team owner.
            </p>
            <Button onClick={() => navigate("/for-artists")}>
              Go to Artist Portal
            </Button>
          </MagicCard>
        </div>
      </AppLayout>
    );
  }

  // Not signed in - prompt to sign in
  if (!isSignedIn) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16">
          <MagicCard className="p-8 max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 overflow-hidden">
              {invite.artistImage ? (
                <img
                  src={invite.artistImage}
                  alt={invite.artistName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music className="h-8 w-8 text-primary" />
              )}
            </div>
            <h1 className="text-2xl font-bold mb-2">You're invited!</h1>
            <p className="text-muted-foreground mb-2">
              {invite.invitedByName} invited you to join
            </p>
            <p className="text-xl font-semibold text-foreground mb-6">
              {invite.artistName}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Role: <span className="font-medium capitalize">{invite.role}</span>
            </p>
            <Button
              onClick={() => navigate(`/signin?returnTo=${encodeURIComponent(`/for-artists/invite/${token}`)}`)}
              className="w-full"
              size="lg"
            >
              Sign in to accept
            </Button>
          </MagicCard>
        </div>
      </AppLayout>
    );
  }

  // Valid invite - show accept UI
  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-16">
        <MagicCard className="p-8 max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 overflow-hidden">
            {invite.artistImage ? (
              <img
                src={invite.artistImage}
                alt={invite.artistName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music className="h-8 w-8 text-primary" />
            )}
          </div>
          <h1 className="text-2xl font-bold mb-2">Join the team!</h1>
          <p className="text-muted-foreground mb-2">
            {invite.invitedByName} invited you to join
          </p>
          <p className="text-xl font-semibold text-foreground mb-6">
            {invite.artistName}
          </p>
          
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
            <Users className="h-4 w-4" />
            <span>You'll be added as a <strong className="text-foreground capitalize">{invite.role}</strong></span>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full"
              size="lg"
            >
              {accepting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Accepting...
                </>
              ) : (
                "Accept Invite"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/for-artists")}
              className="w-full"
            >
              Decline
            </Button>
          </div>
        </MagicCard>
      </div>
    </AppLayout>
  );
}
