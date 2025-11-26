import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SentryTestButton, SentryCaptureTestButton } from "./SentryTestButton";
import { Id } from "../../convex/_generated/dataModel";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Activity, TrendingUp, Users, Music, Calendar, Database, Mic, CheckCircle, AlertCircle, Loader2, Shield, Lock, RefreshCw, BarChart3, FileText, Copy, Trash2, UserCheck } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "./ui/sidebar";

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user: _clerkUser } = useUser();
  
  // CRITICAL: Check admin status FIRST - this query doesn't require admin access
  const isAdmin = useQuery((api as any).admin.isCurrentUserAdmin);
  const logged = useQuery((api as any).auth.loggedInUser);
  
  // CRITICAL: Only fetch admin data AFTER confirming user is admin
  // Use "skip" to conditionally run these queries
  const stats = useQuery(
    (api as any).admin.getAdminStats,
    isAdmin === true ? {} : "skip"
  );
  const health = useQuery(
    (api as any).admin.getSystemHealth,
    isAdmin === true ? {} : "skip"
  );
  const users = useQuery(
    (api as any).admin.getAllUsers,
    isAdmin === true ? { limit: 50 } : "skip"
  );
  const cronSettings = useQuery(
    (api as any).cronSettings.list,
    isAdmin === true ? {} : "skip"
  );
  const recentActivity = useQuery(
    (api as any).admin.getRecentActivity,
    isAdmin === true ? { limit: 50 } : "skip"
  );
  const updateUserRole = useMutation((api as any).admin.updateUserRole);
  const recomputeEngagementCounts = useAction((api as any).admin.recomputeEngagementCounts);
  const forceCatalogSync = useAction((api as any).admin.forceArtistCatalogSync);
  
  // Trending sync actions
  const syncTrending = useAction((api as any).admin.syncTrending);
  const syncTrendingArtists = useAction((api as any).admin.syncTrendingArtists);
  const syncTrendingShows = useAction((api as any).admin.syncTrendingShows);
  const activeSyncJobs = useQuery(
    (api as any).syncJobs.getActive,
    isAdmin === true ? {} : "skip"
  );
  const recentErrors = useQuery(
    (api as any).admin.errorMonitoring.getRecentErrors,
    isAdmin === true ? { limit: 5, onlyUnresolved: true } : "skip"
  );
  const errorStats = useQuery(
    (api as any).admin.errorMonitoring.getErrorStats,
    isAdmin === true ? {} : "skip"
  );
  
  // Setlist sync actions
  const triggerSetlistSync = useAction((api as any).admin.testTriggerSetlistSync);
  const cleanupSongs = useAction((api as any).admin.testCleanupNonStudioSongs);
  const backfillSetlists = useAction((api as any).admin.testBackfillMissingSetlists);
  const resyncCatalogs = useAction((api as any).admin.resyncArtistCatalogs);
  const importTrending = useAction((api as any).admin.testImportTrendingFromTicketmaster);
  const updateCron = useMutation((api as any).cronSettings.update);
  const promoteByEmail = useMutation((api as any).admin.promoteUserByEmail);
  const setClerkRoleByEmail = useAction((api as any).admin.setClerkRoleByEmail);
  const testSpotifyClient = useAction((api as any).admin.testSpotifyClientCredentials);
  
  // Loading state
  const [trendingSyncing, setTrendingSyncing] = useState(false);
  const [artistSyncing, setArtistSyncing] = useState(false);
  const [showSyncing, setShowSyncing] = useState(false);
  const [setlistSyncing, setSetlistSyncing] = useState(false);
  const [cleanupSyncing, setCleanupSyncing] = useState(false);
  const [backfillSyncing, setBackfillSyncing] = useState(false);
  const [catalogSyncing, setCatalogSyncing] = useState(false);
  const [importSyncing, setImportSyncing] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [spotifyTesting, setSpotifyTesting] = useState(false);
  const [forceArtistId, setForceArtistId] = useState("");
  const [forceCatalogRunning, setForceCatalogRunning] = useState(false);
  const [engagementRunning, setEngagementRunning] = useState(false);

  const [activeSection, setActiveSection] = useState('stats');
  const [userSearch, setUserSearch] = useState('');
  // removed unused selectedUsers state

  // Filtered users
  const filteredUsers = useMemo(() => 
    users?.filter((u: any) => u.email?.toLowerCase().includes(userSearch.toLowerCase())) || []
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
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } finally {
      setArtistSyncing(false);
    }
  };

  const handleSyncShows = async () => {
    setShowSyncing(true);
    try {
      const res = await syncTrendingShows();
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } finally {
      setShowSyncing(false);
    }
  };

  const handleSyncSetlists = async () => {
    setSetlistSyncing(true);
    try {
      const res = await triggerSetlistSync();
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
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

  const handleBackfillSetlists = async () => {
    setBackfillSyncing(true);
    try {
      const res = await backfillSetlists({ limit: 500 });
      if (res.success) {
        toast.success(`Backfill: ${res.scheduled} setlist generations scheduled`);
      } else {
        toast.error(res.message);
      }
    } finally {
      setBackfillSyncing(false);
    }
  };

  const handleResyncCatalogs = async () => {
    setCatalogSyncing(true);
    try {
      const res = await resyncCatalogs({ limit: 50 });
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } finally {
      setCatalogSyncing(false);
    }
  };

  const handleImportTrending = async () => {
    setImportSyncing(true);
    try {
      const res = await importTrending();
      toast.success(`Imported ${res.artistsImported} new trending artists`);
    } finally {
      setImportSyncing(false);
    }
  };

  const handleRoleUpdate = async (userId: Id<'users'>, role: "user" | "admin") => {
    try {
      await updateUserRole({ userId, role });
      toast.success("Role updated");
    } catch {
      toast.error("Role update failed");
    }
  };


  const handleForceCatalog = async () => {
    if (!forceArtistId) {
      toast.error("Enter an artist ID");
      return;
    }
    setForceCatalogRunning(true);
    try {
      const res = await forceCatalogSync({ artistId: forceArtistId as any });
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Force sync failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setForceCatalogRunning(false);
    }
  };

  const handleRecomputeEngagement = async () => {
    setEngagementRunning(true);
    try {
      await recomputeEngagementCounts();
      toast.success("Engagement backfill queued");
    } catch (error) {
      toast.error("Failed to recompute engagement", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setEngagementRunning(false);
    }
  };

  if (isAdmin === undefined) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Checking access...</p>
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <MagicCard className="relative overflow-hidden rounded-2xl p-0 border border-red-500/20 bg-card">
          <div className="relative z-10 p-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">You don't have permission to access the admin dashboard.</p>
            <Button onClick={() => { void navigate('/'); }} variant="outline">
              Return to Home
            </Button>
          </div>
          <BorderBeam size={150} duration={12} className="opacity-30" />
        </MagicCard>
      </div>
    );
  }
  
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        {/* Left Sidebar */}
        <Sidebar className="border-r border-border">
          <SidebarHeader className="border-b border-border p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h2 className="font-semibold text-lg">Admin</h2>
            </div>
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={activeSection === 'stats'}
                      onClick={() => setActiveSection('stats')}
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span>Statistics</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={activeSection === 'users'}
                      onClick={() => setActiveSection('users')}
                    >
                      <Users className="h-4 w-4" />
                      <span>Users</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={activeSection === 'syncs'}
                      onClick={() => setActiveSection('syncs')}
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Sync Tools</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={activeSection === 'logs'}
                      onClick={() => setActiveSection('logs')}
                    >
                      <FileText className="h-4 w-4" />
                      <span>System Logs</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-border p-4">
            <Button onClick={() => { void navigate('/'); }} variant="outline" className="w-full">
              Back to Home
            </Button>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <SidebarInset className="flex-1">
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2 flex-1">
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            </div>
          </header>

          <div className="flex-1 p-6 space-y-6">
            {activeSection === 'stats' && (
              <div className="space-y-6">
          {/* Header */}
          <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0 bg-card">
            <div className="relative z-10 p-4 sm:p-6 lg:p-8">
              <div className="flex items-center gap-4 justify-between flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Database className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Admin Dashboard</h1>
                  <p className="text-muted-foreground text-sm sm:text-base">System management and data synchronization</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <SentryCaptureTestButton />
                  <SentryTestButton />
                </div>
              </div>
            </div>
            <BorderBeam size={150} duration={12} className="opacity-30" />
          </MagicCard>

          {/* Stats Overview */}
          <MagicCard className="p-0 rounded-2xl border border-border bg-card">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Platform Statistics</h2>
              </div>

              {!stats ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-secondary rounded-xl p-4 h-20" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCard icon={<Users className="h-5 w-5" />} label="Users" value={stats.totalUsers} />
                  <StatCard icon={<Mic className="h-5 w-5" />} label="Artists" value={stats.totalArtists} />
                  <StatCard icon={<Calendar className="h-5 w-5" />} label="Shows" value={stats.totalShows} />
                  <StatCard icon={<Music className="h-5 w-5" />} label="Setlists" value={stats.totalSetlists} />
                  <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Votes" value={stats.totalVotes} />
                  <StatCard icon={<Activity className="h-5 w-5" />} label="Active Jobs" value={activeSyncJobs?.length || 0} />
                </div>
              )}
            </div>
            <BorderBeam size={120} duration={8} className="opacity-20" />
          </MagicCard>

          {/* Auth Diagnostics */}
          <MagicCard className="p-0 rounded-2xl border border-border bg-card">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-primary/20 rounded-xl flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Auth Diagnostics</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <DiagItem label="Clerk subject" value={logged?.identity?.subject} />
                <DiagItem label="JWT issuer" value={logged?.identity?.issuer} />
                <DiagItem label="JWT audience" value={logged?.identity?.audience} />
                <DiagItem label="App user id" value={logged?.appUser?._id} />
                <DiagItem label="App user role" value={logged?.appUser?.role || 'user'} />
                <DiagItem label="Has Spotify ID" value={logged?.appUser?.spotifyId ? 'yes' : 'no'} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={spotifyTesting}
                  onClick={() => {
                    setSpotifyTesting(true);
                    void (async () => {
                      try {
                        const result = await testSpotifyClient();
                        if (result.success) {
                          toast.success(result.message);
                        } else {
                          toast.error("Spotify client test failed", {
                            description: result.message,
                          });
                        }
                      } catch (e) {
                        toast.error("Spotify client test failed", {
                          description:
                            e instanceof Error ? e.message : "Unknown error",
                        });
                      } finally {
                        setSpotifyTesting(false);
                      }
                    })();
                  }}
                  className="flex items-center gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${spotifyTesting ? "animate-spin" : ""}`}
                  />
                  <span>Test Spotify client credentials</span>
                </Button>
              </div>
            </div>
            <BorderBeam size={80} duration={8} className="opacity-10" />
          </MagicCard>

          {/* Health */}
          <MagicCard className="p-0 rounded-2xl border border-border bg-card">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">System Health</h2>
              </div>

              {!health ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-secondary rounded-lg p-3 h-16" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-secondary border border-border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Database</div>
                      <div className="text-lg font-semibold text-foreground">{health.database.totalRecords.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{health.database.orphanedRecords} orphaned</div>
                    </div>
                    <div className="bg-secondary border border-border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Sync Status</div>
                      <div className="text-lg font-semibold text-foreground">{health.sync.artistsNeedingSync}</div>
                      <div className="text-xs text-muted-foreground">artists need sync</div>
                    </div>
                    <div className="bg-secondary border border-border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">API Status</div>
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

          <div className="bg-secondary rounded-2xl border border-border p-4 space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              <div>
                <h3 className="text-foreground font-semibold">Error Monitoring</h3>
                <p className="text-xs text-muted-foreground">Pulled from admin/errorMonitoring</p>
              </div>
            </div>
            {!errorStats ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 bg-secondary rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-muted-foreground">
                <div className="p-3 bg-secondary rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-foreground font-semibold">{errorStats.total}</div>
                </div>
                <div className="p-3 bg-secondary rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground">Unresolved</div>
                  <div className="text-foreground font-semibold">{errorStats.unresolved}</div>
                </div>
                <div className="p-3 bg-secondary rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground">Last 24h</div>
                  <div className="text-foreground font-semibold">{errorStats.last24Hours}</div>
                </div>
                <div className="p-3 bg-secondary rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground">Errors</div>
                  <div className="text-foreground font-semibold">{errorStats.bySeverity.error}</div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {!recentErrors ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />
                  ))}
                </div>
              ) : recentErrors.length === 0 ? (
                <p className="text-muted-foreground text-sm">No unresolved errors 🎉</p>
              ) : recentErrors.map((err: any) => (
                <div key={err._id} className="p-3 bg-secondary rounded-lg border border-border">
                  <div className="flex justify-between text-sm text-foreground">
                    <span>{err.operation}</span>
                    <span className="text-xs text-muted-foreground">{new Date(err.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{err.error}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Severity: {err.severity} • Resolved: {err.resolved ? "yes" : "no"}</p>
                </div>
              ))}
            </div>
          </div>
              </div>
            )}

            {activeSection === 'users' && (
              <div className="space-y-6">
          <div className="flex gap-2 mb-4">
            <Input 
              placeholder="Search users by email..." 
              value={userSearch} 
              onChange={(e) => setUserSearch(e.target.value)}
              className="max-w-sm" 
            />
          </div>
          <div className="space-y-4">
            {filteredUsers.map((user: any) => (
              <div key={user._id} className="flex items-center justify-between p-4 bg-secondary rounded">
                <div>
                  <p className="text-foreground font-medium">{user.email}</p>
                  <p className="text-muted-foreground text-sm">ID: {user._id}</p>
                </div>
                <div className="flex gap-2">
                <Button size="sm" onClick={() => { void handleRoleUpdate(user._id, "admin"); }}>Admin</Button>
                  <Button size="sm" variant="destructive" onClick={() => { void handleRoleUpdate(user._id, "user"); }}>User</Button>
                  {/* Checkbox for bulk if needed */}
                </div>
              </div>
            ))}
          </div>
              </div>
            )}

            {activeSection === 'syncs' && (
              <div className="space-y-6">
          {/* Trending & Rankings Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trending & Rankings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={() => { void handleSyncTrending(); }}
                disabled={trendingSyncing}
                variant="outline"
                className="w-full border-gray-600 hover:border-gray-500 bg-transparent hover:bg-secondary text-foreground"
              >
                {trendingSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Update All Trending
                  </>
                )}
              </Button>
              <Button
                onClick={() => { void handleSyncArtists(); }}
                disabled={artistSyncing}
                variant="outline"
                className="w-full border-gray-600 hover:border-gray-500 bg-transparent hover:bg-secondary text-foreground"
              >
                {artistSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Artist Rankings
                  </>
                )}
              </Button>
              <Button
                onClick={() => { void handleSyncShows(); }}
                disabled={showSyncing}
                variant="outline"
                className="w-full border-gray-600 hover:border-gray-500 bg-transparent hover:bg-secondary text-foreground"
              >
                {showSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Show Rankings
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Setlist Generation Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Music className="h-5 w-5" />
              Setlist Generation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={() => { void handleBackfillSetlists(); }}
                disabled={backfillSyncing}
                variant="outline"
                className="w-full border-gray-600 hover:border-gray-500 bg-transparent hover:bg-secondary text-foreground"
              >
                {backfillSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Music className="h-4 w-4 mr-2" />
                    Generate Initial Setlists
                  </>
                )}
              </Button>
              <Button
                onClick={() => { void handleSyncSetlists(); }}
                disabled={setlistSyncing}
                variant="outline"
                className="w-full border-gray-600 hover:border-gray-500 bg-transparent hover:bg-secondary text-foreground"
              >
                {setlistSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Import from Setlist.fm
                  </>
                )}
              </Button>
              <Button
                onClick={() => { void handleResyncCatalogs(); }}
                disabled={catalogSyncing}
                variant="outline"
                className="w-full border-gray-600 hover:border-gray-500 bg-transparent hover:bg-secondary text-foreground"
              >
                {catalogSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Import Artist Catalogs
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Data Import Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-secondary rounded-xl space-y-2">
              <p className="text-sm text-muted-foreground">Force catalog sync by Artist ID</p>
              <div className="flex gap-2">
                <Input 
                  placeholder="Artist ID" 
                  value={forceArtistId} 
                  onChange={(e) => setForceArtistId(e.target.value)} 
                />
                <Button onClick={() => { void handleForceCatalog(); }} disabled={forceCatalogRunning}>
                  {forceCatalogRunning ? "Syncing..." : "Force Sync"}
                </Button>
              </div>
            </div>
            <div className="p-4 bg-secondary rounded-xl space-y-2">
              <p className="text-sm text-muted-foreground">One-time engagement backfill</p>
              <Button onClick={() => { void handleRecomputeEngagement(); }} disabled={engagementRunning}>
                {engagementRunning ? "Recomputing..." : "Recompute counts"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Import & Cleanup
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => { void handleImportTrending(); }}
                disabled={importSyncing}
                variant="outline"
                className="w-full border-gray-600 hover:border-gray-500 bg-transparent hover:bg-secondary text-foreground"
              >
                {importSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Import Trending Artists
                  </>
                )}
              </Button>
              <Button
                onClick={() => { void handleCleanupSongs(); }}
                disabled={cleanupSyncing}
                variant="outline"
                className="w-full border-gray-600 hover:border-gray-500 bg-transparent hover:bg-secondary text-foreground"
              >
                {cleanupSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clean Non-Studio Songs
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Admin Users */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin Users
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-secondary border border-border rounded-xl p-4">
                <div className="text-sm text-muted-foreground mb-2">Promote user by email</div>
                <div className="flex gap-2">
                  <Input
                    placeholder="user@example.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => { void (async () => {
                      if (!newAdminEmail) return;
                      try {
                        const res = await promoteByEmail({ email: newAdminEmail });
                        if (res.promoted) {
                          toast.success("User promoted in database");
                        } else {
                          toast.info("No matching user; user must sign in first");
                        }
                        const r2 = await setClerkRoleByEmail({ email: newAdminEmail, role: "admin" });
                        if (r2.clerkUpdated) {
                          toast.success("Clerk role updated");
                        } else {
                          toast.message(r2.message || "Clerk not updated");
                        }
                      } catch (e: any) {
                        toast.error(e?.message || "Promotion failed");
                      } finally {
                        setNewAdminEmail("");
                      }
                    })(); }}
                  >
                    Promote
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Note: Clerk role update requires CLERK_SECRET_KEY configured.
                </p>
              </div>
            </div>
          </div>

          {/* Cron Settings */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Active Sync Jobs
            </h3>
            {!activeSyncJobs ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />
                ))}
              </div>
            ) : activeSyncJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No running sync jobs.</p>
            ) : (
              <div className="space-y-2">
                {activeSyncJobs.map((job: any) => (
                  <div key={job._id} className="flex justify-between items-center bg-secondary border border-border rounded-xl p-3">
                    <div>
                      <div className="text-sm text-foreground font-medium">{job.type}</div>
                      <div className="text-xs text-muted-foreground">Step: {job.currentStep || "n/a"}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {job.progressPercentage ?? 0}% • Retries: {job.retryCount}/{job.maxRetries}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cron Settings */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Cron Schedules
            </h3>
            {!cronSettings ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-secondary animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {cronSettings.map((c: any) => (
                  <div key={c._id} className="flex items-center gap-3 bg-secondary border border-border rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Last run: {c.lastRunAt ? new Date(c.lastRunAt).toLocaleString() : "never"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        defaultValue={Math.max(1, Math.round((c.intervalMs || 60000) / 60000))}
                        className="w-24"
                        onBlur={(e) => { void (async () => {
                          const minutes = Math.max(1, Number(e.currentTarget.value || 1));
                          try {
                            await updateCron({ name: c.name, intervalMs: minutes * 60000, enabled: c.enabled !== false });
                            toast.success("Interval updated");
                          } catch {
                            toast.error("Failed to update");
                          }
                        })(); }}
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                      <Checkbox
                        checked={c.enabled !== false}
                        onCheckedChange={(checked) => { void (async () => {
                          try {
                            await updateCron({ name: c.name, intervalMs: c.intervalMs || 60000, enabled: Boolean(checked) });
                            toast.success("Cron " + (checked ? "enabled" : "disabled"));
                          } catch {
                            toast.error("Failed to update");
                          }
                        })(); }}
                      />
                      <span className="text-xs text-muted-foreground">Enabled</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Orchestrator checks every 5 min; jobs adhere to these intervals.
            </p>
          </div>

          <div className="text-sm text-muted-foreground px-2">
            <p className="mb-1">🔄 Trending rankings are automatically updated every 4 hours</p>
            <p>📊 Rankings are based on: popularity, followers, upcoming shows, and recent activity</p>
          </div>

          {/* Status Info */}
          <div className="bg-secondary rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Sync Status</h3>
                <p className="text-xs text-muted-foreground">Last operation</p>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="h-3 w-3" />
                <span>System ready</span>
              </div>
              <p className="text-xs text-muted-foreground">Manual triggers available</p>
            </div>
          </div>
              </div>
            )}

            {activeSection === 'logs' && (
              <div className="space-y-6">
          <MagicCard className="p-0 rounded-2xl border border-border bg-card">
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Recent Activity</h2>
              </div>

              {!recentActivity ? (
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-secondary rounded-lg p-4 h-16" />
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentActivity.map((activity: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-secondary rounded-lg hover:bg-secondary transition-colors">
                      <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        {activity.type === 'vote' && <TrendingUp className="h-4 w-4 text-green-400" />}
                        {activity.type === 'setlist' && <Music className="h-4 w-4 text-blue-400" />}
                        {activity.type === 'user' && <UserCheck className="h-4 w-4 text-purple-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground text-sm">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
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
              )}
            </div>
            <BorderBeam size={80} duration={8} className="opacity-20" />
          </MagicCard>
              </div>
            )}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function StatCard({ icon, label, value }: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
}) {
  return (
    <div className="bg-secondary border border-border rounded-xl p-4 text-center">
      <div className="flex items-center justify-center mb-2 text-foreground/60">
        {icon}
      </div>
      <div className="text-2xl font-bold text-foreground">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function DiagItem({ label, value }: { label: string; value: any }) {
  const text = value === undefined || value === null ? "—" : String(value);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      // optional toast
    } catch {
      // ignore
    }
  };
  return (
    <div className="bg-secondary border border-border rounded-lg p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <code className="text-sm text-foreground/90 truncate">{text}</code>
        <button
          onClick={() => { void copy(); }}
          className="inline-flex items-center justify-center rounded-md border border-border px-2 py-1 text-xs text-foreground/80 hover:bg-secondary"
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
