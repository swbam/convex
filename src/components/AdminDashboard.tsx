import React, { useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export function AdminDashboard() {
  const stats = useQuery(api.admin.getAdminStats);
  const flagged = useQuery(api.admin.getFlaggedContent, {});
  const users = useQuery(api.admin.getAllUsers, { limit: 50 });
  const verifySetlist = useMutation(api.admin.verifySetlist);

  const pendingFlags = useMemo(() => (flagged || []).filter(f => f.status === "pending"), [flagged]);

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      <div className="dashboard-card">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

        {!stats ? (
          <div className="animate-pulse h-16 bg-muted rounded" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Stat label="Users" value={stats.totalUsers} />
            <Stat label="Artists" value={stats.totalArtists} />
            <Stat label="Shows" value={stats.totalShows} />
            <Stat label="Setlists" value={stats.totalSetlists} />
            <Stat label="Votes" value={stats.totalVotes} />
            <Stat label="Pending Flags" value={stats.pendingFlags} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Flagged Content */}
        <div className="dashboard-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Flagged Content</h2>
            <div className="text-sm text-muted-foreground">{pendingFlags.length} pending</div>
          </div>

          <div className="space-y-3">
            {(pendingFlags || []).map((flag) => (
              <div key={flag._id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-muted-foreground">{flag.contentType}</div>
                  <div className="text-xs text-muted-foreground">{new Date(flag._creationTime).toLocaleString()}</div>
                </div>
                <div className="text-sm break-all mb-2">Content ID: {flag.contentId}</div>
                <div className="text-sm text-muted-foreground mb-3">Reason: {flag.reason}</div>
                {flag.contentType === "setlist" && (
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-2 rounded border text-sm hover:bg-accent"
                      onClick={() => verifySetlist({ setlistId: flag.contentId as unknown as Id<"setlists">, verified: true })}
                    >
                      Verify setlist
                    </button>
                    <button className="px-3 py-2 rounded border text-sm hover:bg-accent">Dismiss</button>
                  </div>
                )}
              </div>
            ))}
            {pendingFlags.length === 0 && (
              <div className="text-sm text-muted-foreground">No pending flags</div>
            )}
          </div>
        </div>

        {/* Users */}
        <div className="dashboard-card">
          <h2 className="text-xl font-semibold mb-4">Users</h2>
          <div className="space-y-2">
            {(users || []).map((u) => (
              <div key={u._id} className="flex items-center justify-between border rounded p-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.name || u.email || u.username}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                <div className="text-xs text-muted-foreground uppercase">{u.role}</div>
              </div>
            ))}
            {!users && (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-xl p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}


