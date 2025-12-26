import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppLayout } from "../components/AppLayout";
import { AuthGuard } from "../components/AuthGuard";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { MagicCard } from "../components/ui/magic-card";
import { Button } from "../components/ui/button";
import { Loader2, ArrowLeft, Users, Mail, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";

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

  const inviteTeamMember = useMutation((api as any).artistAccess.inviteTeamMember);
  const removeTeamMember = useMutation((api as any).artistAccess.removeTeamMember);
  const updateTeamMemberRole = useMutation((api as any).artistAccess.updateTeamMemberRole);

  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Exclude<Role, "owner">>("manager");
  const [submitting, setSubmitting] = React.useState(false);

  if (!artistId) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-10">
          <MagicCard className="p-8 text-center">
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
            </div>

            <MagicCard className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
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
                <div className="rounded-xl border border-border bg-card/40 p-4 mb-6 flex items-start gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    Only <span className="text-foreground font-medium">owners</span> can manage team access.
                  </div>
                </div>
              )}

              {isOwner && (
                <div className="rounded-xl border border-border bg-card/40 p-4 mb-6">
                  <div className="font-semibold mb-2 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Invite a Team Member
                  </div>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@domain.com"
                      className="flex-1 h-10 rounded-lg bg-secondary border border-border px-3 text-sm text-foreground"
                      inputMode="email"
                      autoComplete="email"
                    />
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="h-10 rounded-lg bg-secondary border border-border px-3 text-sm text-foreground md:w-44"
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
                          const res = await inviteTeamMember({
                            artistId,
                            email: email.trim(),
                            role,
                          });
                          if (res?.success) {
                            toast.success("Invite sent");
                            setEmail("");
                          } else {
                            toast.error("Invite failed", { description: res?.message || "Unknown error" });
                          }
                        } catch (e: any) {
                          toast.error("Invite failed", { description: e?.message || "Unknown error" });
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Sending…
                        </>
                      ) : (
                        "Invite"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    They must already have an account with that email.
                  </p>
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
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-4"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{m.user?.name || m.user?.email || "Team member"}</div>
                          <div className="text-xs text-muted-foreground truncate">{m.user?.email || ""}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.role === "owner" ? (
                            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                              owner
                            </span>
                          ) : (
                            <select
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
                                    toast.success("Role updated");
                                  }
                                } catch (err: any) {
                                  toast.error("Role update failed", { description: err?.message || "Unknown error" });
                                }
                              }}
                              className="h-9 rounded-lg bg-secondary border border-border px-3 text-sm text-foreground"
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
                                    toast.success("Removed");
                                  }
                                } catch (err: any) {
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

