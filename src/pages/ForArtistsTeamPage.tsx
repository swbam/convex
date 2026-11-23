import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppLayout } from "../components/AppLayout";
import { AuthGuard } from "../components/AuthGuard";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { MagicCard } from "../components/ui/magic-card";
import { Button } from "../components/ui/button";
import { Loader2, ArrowLeft, Users, Mail, Trash2, Shield, Copy, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { capture, captureException } from "../lib/analytics";

type Role = "owner" | "manager" | "viewer";

export function ForArtistsTeamPage() {
  const navigate = useNavigate();
  const params = useParams();
  const artistId = params.artistId as string | undefined;

  const myArtists = useQuery((api as any).artistAccess.getMyArtists, {});
  const myRole: Role | undefined = myArtists?.find((a: any) => a.artist?._id === artistId)?.role;

  const team = useQuery(
    (api as any).artistAccess.getTeamMembers,
    artistId ? { artistId } : "skip",
  );

  // New invite system
  const pendingInvites = useQuery(
    (api as any).artistAccess.getPendingInvites,
    artistId ? { artistId } : "skip",
  );

  const createInvite = useAction((api as any).artistInvites.createInvite);
  const revokeInvite = useMutation((api as any).artistAccess.revokeInvite);
  const removeTeamMember = useMutation((api as any).artistAccess.removeTeamMember);
  const updateTeamMemberRole = useMutation((api as any).artistAccess.updateTeamMemberRole);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "owner">>("manager");
  const [submitting, setSubmitting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const trackedTeamArtist = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (
      !artistId ||
      team === undefined ||
      pendingInvites === undefined ||
      myArtists === undefined ||
      trackedTeamArtist.current === artistId
    ) return;
    trackedTeamArtist.current = artistId;
    capture("artist_team_viewed", {
      artist_id: artistId,
      member_role: myRole,
      team_member_count: team?.length ?? 0,
      pending_invite_count: pendingInvites?.length ?? 0,
    });
  }, [artistId, myRole, pendingInvites?.length, team]);

  if (!artistId) {
    return (
      <AppLayout>
        <div className="public-page account-page">
          <MagicCard className="p-4 sm:p-6 text-center">
            <p className="text-muted-foreground">Missing artist ID.</p>
            <Button variant="outline" onClick={() => navigate("/for-artists")} className="mt-4">
              Back to Artists
            </Button>
          </MagicCard>
        </div>
      </AppLayout>
    );
  }

  const isOwner = myRole === "owner";

  return (
    <ErrorBoundary>
      <AuthGuard>
        <AppLayout>
          <div className="public-page account-page space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button
                variant="ghost"
                onClick={() => navigate(`/for-artists/${artistId}`)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </div>

            <MagicCard className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-[5px] bg-secondary flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Team</h1>
                  <p className="text-sm text-muted-foreground">
                    Invite managers and viewers so your tour team can see demand.
                  </p>
                </div>
              </div>

              {!isOwner && (
                <div className="rounded-[5px] border border-border bg-card/40 p-4 mb-6 flex items-start gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    Only <span className="text-foreground font-medium">owners</span> can manage team access.
                  </div>
                </div>
              )}

              {isOwner && (
                <div className="rounded-[5px] border border-border bg-card/40 p-4 mb-6">
                  <div className="font-semibold mb-2 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Invite a Team Member
                  </div>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input type="email" aria-label="Team member email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@domain.com"
                      className="flex-1 h-10 rounded-[5px] bg-secondary border border-border px-3 text-sm text-foreground"
                      inputMode="email"
                      autoComplete="email"
                    />
                    <select
                      aria-label="Invitation role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="h-10 rounded-[5px] bg-secondary border border-border px-3 text-sm text-foreground md:w-44"
                    >
                      <option value="manager">Manager</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <Button
                      disabled={submitting || !email.trim()}
                      onClick={async () => {
                        if (!email.trim()) return;
                        setSubmitting(true);
                        try {
                          const res = await createInvite({
                            artistId,
                            email: email.trim(),
                            role,
                          });
                          if (res?.success) {
                            capture("artist_team_invite_created", {
                              artist_id: artistId,
                              invited_role: role,
                            });
                            toast.success(res.emailSent ? "Invitation emailed" : "Invitation created", {
                              description: res.emailSent
                                ? "They can accept from the secure link in their inbox."
                                : "Email delivery is unavailable, so copy the secure link below.",
                            });
                            setEmail("");
                            if (res.inviteUrl) {
                              setLastInviteUrl(res.inviteUrl);
                            }
                          } else {
                            toast.error("Invite failed", { description: res?.message || "Unknown error" });
                          }
                        } catch (e: any) {
                          captureException(e, { operation: "artist_team_invite_create", artist_id: artistId });
                          toast.error("Invite failed", { description: e?.message || "Unknown error" });
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Creating…
                        </>
                      ) : (
                        "Create Invite"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    They'll receive a link to join the team. No account needed yet - they can sign up when accepting.
                  </p>

                  {lastInviteUrl && (
                    <div className="mt-4 p-3 rounded-[5px] bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-700 dark:text-green-500" />
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">Secure invite link</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background px-2 py-1 rounded truncate">
                          {lastInviteUrl}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await navigator.clipboard.writeText(lastInviteUrl);
                            toast.success("Link copied!");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pending Invites */}
              {isOwner && pendingInvites && pendingInvites.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">Pending Invites</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600">
                      {pendingInvites.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pendingInvites.map((invite: any) => (
                      <div
                        key={invite._id}
                        className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-3 rounded-[5px] border border-border/50 bg-card/20 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate text-sm">{invite.email}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className="capitalize">{invite.role}</span>
                            {" • "}
                            Expires in {invite.daysRemaining} {invite.daysRemaining === 1 ? "day" : "days"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Send a fresh invitation"
                            onClick={async () => {
                              try {
                                const res = await createInvite({
                                  artistId,
                                  email: invite.email,
                                  role: invite.role,
                                });
                                if (!res?.success) {
                                  toast.error("Could not resend", { description: res?.message });
                                  return;
                                }
                                if (res.inviteUrl) setLastInviteUrl(res.inviteUrl);
                                toast.success(res.emailSent ? "Fresh invitation emailed" : "Fresh link created");
                              } catch (error: any) {
                                toast.error("Could not resend", { description: error?.message });
                              }
                            }}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const ok = window.confirm("Revoke this invite?");
                              if (!ok) return;
                              try {
                                const res = await revokeInvite({
                                  artistId,
                                  inviteId: invite._id,
                                });
                                if (res?.success) {
                                  capture("artist_team_invite_revoked", {
                                    artist_id: artistId,
                                    invite_id: invite._id,
                                    invited_role: invite.role,
                                  });
                                  toast.success("Invite revoked");
                                } else {
                                  toast.error("Failed", { description: res?.message });
                                }
                              } catch (e: any) {
                                captureException(e, { operation: "artist_team_invite_revoke", artist_id: artistId });
                                toast.error("Failed", { description: e?.message });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {team === undefined ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading team…
                </div>
              ) : team?.length ? (
                <div className="space-y-2">
                  {team.map((m: any) => {
                    const canEdit = isOwner && m.role !== "owner";
                    return (
                      <div
                        key={m._id}
                        className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-3 rounded-[5px] border border-border bg-card/40 p-4"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{m.user?.name || m.user?.email || "Team member"}</div>
                          <div className="text-xs text-muted-foreground truncate">{m.user?.email || ""}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.role === "owner" ? (
                            <span className="text-xs px-2 py-1 rounded-full bg-secondary text-primary font-medium">
                              owner
                            </span>
                          ) : (
                            <select
                              aria-label={`Role for ${m.user?.name || m.user?.email || "team member"}`}
                              value={m.role}
                              disabled={!canEdit}
                              onChange={async (e) => {
                                const nextRole = e.target.value as Exclude<Role, "owner">;
                                try {
                                  const res = await updateTeamMemberRole({
                                    artistId,
                                    memberId: m._id,
                                    role: nextRole,
                                  });
                                  if (!res?.success) {
                                    toast.error("Role update failed", { description: res?.message || "Unknown error" });
                                  } else {
                                    capture("artist_team_role_changed", {
                                      artist_id: artistId,
                                      member_id: m._id,
                                      previous_role: m.role,
                                      new_role: nextRole,
                                    });
                                    toast.success("Role updated");
                                  }
                                } catch (err: any) {
                                  captureException(err, { operation: "artist_team_role_change", artist_id: artistId });
                                  toast.error("Role update failed", { description: err?.message || "Unknown error" });
                                }
                              }}
                              className="h-9 rounded-[5px] bg-secondary border border-border px-3 text-sm text-foreground"
                            >
                              <option value="manager">Manager</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          )}

                          {isOwner && m.role !== "owner" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={async () => {
                                const ok = window.confirm("Remove this team member?");
                                if (!ok) return;
                                try {
                                  const res = await removeTeamMember({
                                    artistId,
                                    memberId: m._id,
                                  });
                                  if (!res?.success) {
                                    toast.error("Remove failed", { description: res?.message || "Unknown error" });
                                  } else {
                                    capture("artist_team_member_removed", {
                                      artist_id: artistId,
                                      member_id: m._id,
                                      member_role: m.role,
                                    });
                                    toast.success("Removed");
                                  }
                                } catch (err: any) {
                                  captureException(err, { operation: "artist_team_member_remove", artist_id: artistId });
                                  toast.error("Remove failed", { description: err?.message || "Unknown error" });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">No team members yet.</p>
              )}
            </MagicCard>
          </div>
        </AppLayout>
      </AuthGuard>
    </ErrorBoundary>
  );
}
