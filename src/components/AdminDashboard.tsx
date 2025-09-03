import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ShimmerButton } from "./ui/shimmer-button";
import { TrendingUp, Users, Music, Calendar, Flag, Database, Mic, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AdminDashboard() {
  const stats = useQuery(api.admin.getAdminStats);
  const flagged = useQuery(api.admin.getFlaggedContent, {});
  const users = useQuery(api.admin.getAllUsers, { limit: 50 });
  const verifySetlist = useMutation(api.admin.verifySetlist);
  
  // Trending sync actions
  const syncTrending = useAction(api.admin.syncTrending);
  const syncTrendingArtists = useAction(api.admin.syncTrendingArtists);
  const syncTrendingShows = useAction(api.admin.syncTrendingShows);
  
  // Setlist sync actions
  const triggerSetlistSync = useAction(api.admin.testTriggerSetlistSync);
  
  // Loading state
  const [trendingSyncing, setTrendingSyncing] = useState(false);
  const [artistSyncing, setArtistSyncing] = useState(false);
  const [showSyncing, setShowSyncing] = useState(false);
  const [setlistSyncing, setSetlistSyncing] = useState(false);

  const pendingFlags = useMemo(() => (flagged || []).filter(f => f.status === "pending"), [flagged]);

  const handleSyncTrending = async () => {
    setTrendingSyncing(true);
    try {
      const result = await syncTrending();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error("Trending sync failed", {
          description: result.message
        });
      }
    } catch (error) {
      toast.error("Trending sync failed", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setTrendingSyncing(false);
    }
  };

  const handleSyncArtists = async () => {
    setArtistSyncing(true);
    try {
      const res = await syncTrendingArtists();
      res.success ? toast.success(res.message) : toast.error(res.message);
    } finally {
      setArtistSyncing(false);
    }
  };

  const handleSyncShows = async () => {
    setShowSyncing(true);
    try {
      const res = await syncTrendingShows();
      res.success ? toast.success(res.message) : toast.error(res.message);
    } finally {
      setShowSyncing(false);
    }
  };

  const handleSyncSetlists = async () => {
    setSetlistSyncing(true);
    try {
      const res = await triggerSetlistSync();
      res.success ? toast.success(res.message) : toast.error(res.message);
    } finally {
      setSetlistSyncing(false);
    }
  };



  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
      {/* Header */}
      <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0 bg-black">
        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Database className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-gray-300 text-sm sm:text-base">System management and data synchronization</p>
            </div>
          </div>
        </div>
        <BorderBeam size={150} duration={12} className="opacity-30" />
      </MagicCard>

      {/* Stats Overview */}
      <MagicCard className="p-0 rounded-2xl border-0 bg-black">
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Platform Statistics</h2>
          </div>

          {!stats ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse bg-white/5 rounded-xl p-4 h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard icon={<Users className="h-5 w-5" />} label="Users" value={stats.totalUsers} />
              <StatCard icon={<Mic className="h-5 w-5" />} label="Artists" value={stats.totalArtists} />
              <StatCard icon={<Calendar className="h-5 w-5" />} label="Shows" value={stats.totalShows} />
              <StatCard icon={<Music className="h-5 w-5" />} label="Setlists" value={stats.totalSetlists} />
              <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Votes" value={stats.totalVotes} />
              <StatCard icon={<Flag className="h-5 w-5" />} label="Pending Flags" value={pendingFlags.length} />
            </div>
          )}
        </div>
        <BorderBeam size={120} duration={8} className="opacity-20" />
      </MagicCard>

      {/* Trending Data Sync Controls */}
      <MagicCard className="p-0 rounded-2xl border-0 bg-black">
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-green-500/20 rounded-xl flex items-center justify-center">
              <Database className="h-4 w-4 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Trending Data Sync</h2>
          </div>

          <div className="space-y-4">
            {/* Simplified Trending Sync */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Update Trending Rankings</h3>
                    <p className="text-xs text-gray-400">Recalculates trending scores and updates top 20 rankings</p>
                  </div>
                </div>
              </div>
              <ShimmerButton
                onClick={handleSyncTrending}
                disabled={trendingSyncing}
                className="w-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 text-white border-white/20"
                shimmerColor="#8b5cf6"
              >
                {trendingSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating Rankings...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Update Trending Data
                  </>
                )}
              </ShimmerButton>
            </div>

            {/* Separate buttons for artist/show trending */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ShimmerButton
                onClick={handleSyncArtists}
                disabled={artistSyncing}
                className="w-full bg-gradient-to-r from-emerald-500/20 to-green-500/20 hover:from-emerald-500/30 hover:to-green-500/30 text-white border-white/20"
                shimmerColor="#10b981"
              >
                {artistSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sync Artists
                  </>
                ) : (
                  <>Sync Trending Artists</>
                )}
              </ShimmerButton>
              <ShimmerButton
                onClick={handleSyncShows}
                disabled={showSyncing}
                className="w-full bg-gradient-to-r from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30 text-white border-white/20"
                shimmerColor="#0ea5e9"
              >
                {showSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sync Shows
                  </>
                ) : (
                  <>Sync Trending Shows</>
                )}
              </ShimmerButton>
              <ShimmerButton
                onClick={handleSyncSetlists}
                disabled={setlistSyncing}
                className="w-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-white border-white/20"
                shimmerColor="#a855f7"
              >
                {setlistSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sync Setlists
                  </>
                ) : (
                  <>Sync Setlists</>
                )}
              </ShimmerButton>
            </div>
            
            <div className="text-sm text-gray-400 px-2">
              <p className="mb-1">🔄 Trending rankings are automatically updated every 4 hours</p>
              <p>📊 Rankings are based on: popularity, followers, upcoming shows, and recent activity</p>
            </div>

            {/* Status Info */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Sync Status</h3>
                  <p className="text-xs text-gray-400">Last operation</p>
                </div>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="h-3 w-3" />
                  <span>System ready</span>
                </div>
                <p className="text-xs text-gray-500">Manual triggers available</p>
              </div>
            </div>
          </div>
        </div>
        <BorderBeam size={120} duration={8} className="opacity-20" />
      </MagicCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flagged Content */}
        <MagicCard className="p-0 rounded-2xl border-0 bg-black">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-500/20 rounded-xl flex items-center justify-center">
                  <Flag className="h-4 w-4 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Flagged Content</h2>
              </div>
              <div className="text-sm text-gray-400">{pendingFlags.length} pending</div>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {(pendingFlags || []).map((flag) => (
                <div key={flag._id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-300 capitalize">{flag.contentType}</div>
                    <div className="text-xs text-gray-500">{new Date(flag._creationTime).toLocaleDateString()}</div>
                  </div>
                  <div className="text-sm text-gray-400 mb-2 font-mono">{flag.contentId.slice(0, 12)}...</div>
                  <div className="text-sm text-gray-300 mb-3">Reason: {flag.reason}</div>
                  {flag.contentType === "setlist" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => verifySetlist({ setlistId: flag.contentId as unknown as Id<"setlists">, verified: true })}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verify
                      </Button>
                      <Button size="sm" variant="secondary">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {pendingFlags.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Flag className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No pending flags</p>
                </div>
              )}
            </div>
          </div>
          <BorderBeam size={80} duration={8} className="opacity-20" />
        </MagicCard>

        {/* Users */}
        <MagicCard className="p-0 rounded-2xl border-0 bg-black">
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Recent Users</h2>
            </div>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(users || []).map((u) => (
                <div key={u._id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white truncate">{u.name || u.username}</div>
                    <div className="text-xs text-gray-400 truncate">{u.email}</div>
                  </div>
                  <Badge variant={u.role === 'admin' ? 'destructive' : u.role === 'banned' ? 'secondary' : 'default'}>
                    {u.role.toUpperCase()}
                  </Badge>
                </div>
              ))}
              {!users && (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
                  ))}
                </div>
              )}
            </div>
          </div>
          <BorderBeam size={80} duration={8} className="opacity-20" />
        </MagicCard>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
      <div className="flex items-center justify-center mb-2 text-white/60">
        {icon}
      </div>
      <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}


