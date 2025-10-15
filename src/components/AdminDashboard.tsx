import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ShimmerButton } from "./ui/shimmer-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Activity, TrendingUp, Users, Music, Calendar, Flag, Database, Mic, CheckCircle, AlertCircle, Loader2, Shield, Lock, Search, Trash2, RefreshCw, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user: clerkUser } = useUser();
  const isAdmin = useQuery(api.admin.isCurrentUserAdmin);
  const stats = useQuery(api.admin.getAdminStats);
  const health = useQuery(api.admin.getSystemHealth);
  const flagged = useQuery(api.admin.getFlaggedContent, {});
  const users = useQuery(api.admin.getAllUsers, { limit: 50 });
  const verifySetlist = useMutation(api.admin.verifySetlist);
  const bulkDeleteFlagged = useMutation(api.admin.bulkDeleteFlagged); // New mutation
  const updateUserRole = useMutation(api.admin.updateUserRole); // New for roles
  
  // Trending sync actions
  const syncTrending = useAction(api.admin.syncTrending);
  const syncTrendingArtists = useAction(api.admin.syncTrendingArtists);
  const syncTrendingShows = useAction(api.admin.syncTrendingShows);
  
  // Setlist sync actions
  const triggerSetlistSync = useAction(api.admin.testTriggerSetlistSync);
  const cleanupSongs = useAction(api.admin.testCleanupNonStudioSongs);
  
  // Loading state
  const [trendingSyncing, setTrendingSyncing] = useState(false);
  const [artistSyncing, setArtistSyncing] = useState(false);
  const [showSyncing, setShowSyncing] = useState(false);
  const [setlistSyncing, setSetlistSyncing] = useState(false);
  const [cleanupSyncing, setCleanupSyncing] = useState(false);

  const pendingFlags = useMemo(() => (flagged || []).filter(f => f.status === "pending"), [flagged]);

  const [tab, setTab] = useState('stats');
  const [selectedFlagged, setSelectedFlagged] = useState<Set<Id<'contentFlags'>>>(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<Id<'users'>>>(new Set());

  // Filtered flagged
  const filteredFlagged = useMemo(() => 
    flagged?.filter(f => f.reason.toLowerCase().includes(userSearch.toLowerCase())) || []
  , [flagged, userSearch]);

  // Filtered users
  const filteredUsers = useMemo(() => 
    users?.filter(u => u.email?.toLowerCase().includes(userSearch.toLowerCase())) || []
  , [users, userSearch]);

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

  const handleCleanupSongs = async () => {
    setCleanupSyncing(true);
    try {
      const res = await cleanupSongs();
      if (res.success) {
        toast.success(`${res.message} (${res.cleanedCount} songs removed)`);
      } else {
        toast.error(res.message);
      }
    } finally {
      setCleanupSyncing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFlagged.size === 0) return;
    try {
      await bulkDeleteFlagged({ ids: Array.from(selectedFlagged) });
      toast.success("Flagged content deleted");
      setSelectedFlagged(new Set());
    } catch (e) {
      toast.error("Bulk delete failed");
    }
  };

  const handleRoleUpdate = async (userId: Id<'users'>, role: string) => {
    try {
      await updateUserRole({ userId, role });
      toast.success("Role updated");
    } catch (e) {
      toast.error("Role update failed");
    }
  };

  if (isAdmin === undefined) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-gray-400">Checking access...</p>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <MagicCard className="relative overflow-hidden rounded-2xl p-0 border border-red-500/20 bg-black">
          <div className="relative z-10 p-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-gray-400 mb-6">You don't have permission to access the admin dashboard.</p>
            <Button onClick={() => navigate('/')} variant="outline">
              Return to Home
            </Button>
          </div>
          <BorderBeam size={150} duration={12} className="opacity-30" />
        </MagicCard>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        <Button onClick={() => navigate('/')} variant="outline">Home</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-5 gap-2">
          <TabsTrigger value="stats" className="w-full justify-center">Stats</TabsTrigger>
          <TabsTrigger value="users" className="w-full justify-center">Users</TabsTrigger>
          <TabsTrigger value="flagged" className="w-full justify-center">Flagged</TabsTrigger>
          <TabsTrigger value="syncs" className="w-full justify-center">Syncs</TabsTrigger>
          <TabsTrigger value="logs" className="w-full justify-center">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-6">
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
          <MagicCard className="p-0 rounded-2xl border border-white/10 bg-black">
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

          {/* Health */}
          <MagicCard className="p-0 rounded-2xl border border-white/10 bg-black">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">System Health</h2>
              </div>

              {!health ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-white/5 rounded-lg p-3 h-16" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <div className="text-sm text-gray-400">Database</div>
                      <div className="text-lg font-semibold text-white">{health.database.totalRecords.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">{health.database.orphanedRecords} orphaned</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <div className="text-sm text-gray-400">Sync Status</div>
                      <div className="text-lg font-semibold text-white">{health.sync.artistsNeedingSync}</div>
                      <div className="text-xs text-gray-500">artists need sync</div>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <div className="text-sm text-gray-400">API Status</div>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-xs px-2 py-1 rounded ${health.api.spotifyConfigured ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          Spotify
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${health.api.ticketmasterConfigured ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          TM
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${health.api.setlistfmConfigured ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          Setlist.fm
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="flex gap-2 mb-4">
            <Input 
              placeholder="Search users by email..." 
              value={userSearch} 
              onChange={(e) => setUserSearch(e.target.value)}
              className="max-w-sm" 
            />
          </div>
          <div className="space-y-4">
            {filteredUsers.map(user => (
              <div key={user._id} className="flex items-center justify-between p-4 bg-white/5 rounded">
                <div>
                  <p className="text-white font-medium">{user.email}</p>
                  <p className="text-gray-400 text-sm">ID: {user._id}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleRoleUpdate(user._id, "admin")}>Admin</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleRoleUpdate(user._id, "user")}>User</Button>
                  {/* Checkbox for bulk if needed */}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="flagged" className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Flagged Content ({filteredFlagged.length})</h2>
            <Button onClick={handleBulkDelete} disabled={selectedFlagged.size === 0} variant="destructive">
              Delete Selected ({selectedFlagged.size})
            </Button>
          </div>
          <div className="space-y-4">
            {filteredFlagged.map(flag => (
              <div key={flag._id} className="flex gap-2 items-start p-4 bg-white/5 rounded">
                <Checkbox 
                  id={flag._id}
                  checked={selectedFlagged.has(flag._id)}
                  onCheckedChange={(checked) => {
                    const newSelected = new Set(selectedFlagged);
                    if (checked) newSelected.add(flag._id);
                    else newSelected.delete(flag._id);
                    setSelectedFlagged(newSelected);
                  }}
                />
                <div className="flex-1">
                  <p className="text-white">Flag: {flag.reason}</p>
                  <p className="text-gray-400 text-sm">Reporter: {flag.reporterId}, Date: {new Date(flag.createdAt).toLocaleString()}</p>
                  <p className="text-gray-400 text-sm">Content: {flag.contentType} - {flag.contentId}</p>
                </div>
                <Button size="sm" onClick={() => toast.info("Flag review coming soon")}>Review</Button>
                <Button size="sm" variant="destructive" onClick={() => toast.info("Flag deletion coming soon")}>Delete</Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="syncs" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <ShimmerButton
              onClick={handleCleanupSongs}
              disabled={cleanupSyncing}
              className="w-full bg-gradient-to-r from-red-500/20 to-orange-500/20 hover:from-red-500/30 hover:to-orange-500/30 text-white border-white/20"
              shimmerColor="#ef4444"
            >
              {cleanupSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cleaning Songs
                </>
              ) : (
                <>Clean Non-Studio</>
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
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <MagicCard className="p-0 rounded-2xl border border-white/10 bg-black">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
              </div>

              {(() => {
                const recentActivity = useQuery(api.admin.getRecentActivity, { limit: 50 });
                
                if (!recentActivity) {
                  return (
                    <div className="space-y-3">
                      {[...Array(10)].map((_, i) => (
                        <div key={i} className="animate-pulse bg-white/5 rounded-lg p-4 h-16" />
                      ))}
                    </div>
                  );
                }
                
                if (recentActivity.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <Activity className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                      <p className="text-gray-400">No recent activity</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-2">
                    {recentActivity.map((activity: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          {activity.type === 'vote' && <TrendingUp className="h-4 w-4 text-green-400" />}
                          {activity.type === 'setlist' && <Music className="h-4 w-4 text-blue-400" />}
                          {activity.type === 'user' && <UserCheck className="h-4 w-4 text-purple-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm">{activity.description}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(activity.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                            {activity.user && ` • ${activity.user}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>
        </TabsContent>
      </Tabs>
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
