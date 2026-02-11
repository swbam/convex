import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SentryTestButton, SentryCaptureTestButton } from "./SentryTestButton";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
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
import {
  BarChart3, Users, UserCheck, RefreshCw, Activity,
  Shield, ChevronLeft, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";

// Sub-components
import { AdminStatsSection } from "./admin/AdminStatsSection";
import { AdminUsersSection } from "./admin/AdminUsersSection";
import { AdminArtistClaimsSection } from "./admin/AdminArtistClaimsSection";
import { AdminSyncSection } from "./admin/AdminSyncSection";
import { AdminLogsSection } from "./admin/AdminLogsSection";

/* ════════════════════════════════════════
   Navigation items
   ════════════════════════════════════════ */
const NAV_ITEMS = [
  { id: "stats", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "artistClaims", label: "Artist Claims", icon: UserCheck },
  { id: "syncs", label: "Sync & Tools", icon: RefreshCw },
  { id: "logs", label: "Logs", icon: Activity },
] as const;

type SectionId = (typeof NAV_ITEMS)[number]["id"];

/* ════════════════════════════════════════
   Crossfade variants for AnimatePresence
   ════════════════════════════════════════ */
const sectionMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15, ease: "easeIn" } },
};

/* ════════════════════════════════════════
   Admin Dashboard — Shell
   ════════════════════════════════════════ */
export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<SectionId>("stats");

  /* ─── Queries ─── */
  const stats = useQuery(api.admin.getAdminStats);
  const users = useQuery(api.admin.getAllUsers);
  const pendingClaims = useQuery(api.admin.getPendingArtistClaims);
  const recentActivity = useQuery(api.admin.getRecentActivity);
  const auditLogs = useQuery(api.admin.getAuditLogs);
  const logged = useQuery(api.admin.getLoggedInUserInfo);
  const analytics = useQuery(api.admin.getAdminAnalytics);
  const health = useQuery(api.admin.getSystemHealth);
  const activeSyncJobs = useQuery(api.admin.getActiveSyncJobs);
  const cronSettings = useQuery(api.admin.getCronSettings);
  const errorStats = useQuery(api.admin.getErrorStats);
  const recentErrors = useQuery(api.admin.getRecentUnresolvedErrors);

  /* ─── Mutations ─── */
  const updateRole = useMutation(api.admin.updateUserRole);
  const approveClaim = useMutation(api.admin.approveArtistClaim);
  const rejectClaim = useMutation(api.admin.rejectArtistClaim);
  const updateCron = useMutation(api.admin.updateCronSetting);
  const requestCronRunNow = useMutation(api.admin.requestCronRunNow);
  const promoteByEmail = useMutation(api.admin.promoteToAdminByEmail);

  /* ─── Actions ─── */
  const syncTrending = useAction(api.trending.syncAllTrending);
  const syncArtists = useAction(api.trending.updateArtistTrendingRankings);
  const syncShows = useAction(api.trending.updateShowTrendingRankings);
  const syncSetlists = useAction(api.setlistImport.importAllSetlists);
  const cleanupSongs = useAction(api.maintenance.cleanNonStudioSongs);
  const backfillSetlists = useAction(api.maintenance.backfillInitialSetlists);
  const resyncCatalogs = useAction(api.bulkCatalogSync.startBulkCatalogSync);
  const importTrending = useAction(api.admin.importTrendingArtists);
  const bootstrapFests = useAction(api.festivalBootstrap.bootstrapAllFestivals);
  const updateFestImages = useAction(api.festivalBootstrap.updateFestivalImages);
  const testSpotify = useAction(api.spotifyAuth.testSpotifyCredentials);
  const setClerkRoleByEmail = useAction(api.admin.setClerkRoleByEmail);
  const recomputeEngagement = useAction(api.maintenance.recomputeEngagementCounts);
  const forceCatalogSync = useAction(api.bulkCatalogSync.forceCatalogSync);

  /* ─── Local UI State ─── */
  const [userSearch, setUserSearch] = useState("");
  const [trendingSyncing, setTrendingSyncing] = useState(false);
  const [artistSyncing, setArtistSyncing] = useState(false);
  const [showSyncing, setShowSyncing] = useState(false);
  const [setlistSyncing, setSetlistSyncing] = useState(false);
  const [cleanupSyncing, setCleanupSyncing] = useState(false);
  const [backfillSyncing, setBackfillSyncing] = useState(false);
  const [catalogSyncing, setCatalogSyncing] = useState(false);
  const [importSyncing, setImportSyncing] = useState(false);
  const [festivalSyncing, setFestivalSyncing] = useState(false);
  const [festivalImageSyncing, setFestivalImageSyncing] = useState(false);
  const [spotifyTesting, setSpotifyTesting] = useState(false);
  const [engagementRunning, setEngagementRunning] = useState(false);
  const [forceCatalogRunning, setForceCatalogRunning] = useState(false);
  const [forceArtistId, setForceArtistId] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");

  /* ═══════ Action handlers ═══════ */
  const wrap = (fn: () => Promise<any>, setSyncing: (v: boolean) => void, label: string) => async () => {
    setSyncing(true);
    try {
      const result = await fn();
      if (result?.success !== undefined) {
        result.success ? toast.success(result.message) : toast.error(result.message || `${label} failed`);
      } else {
        toast.success(`${label} complete`);
      }
    } catch (e: any) {
      toast.error(e?.message || `${label} failed`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncTrending = wrap(() => syncTrending(), setTrendingSyncing, "Trending sync");
  const handleSyncArtists = wrap(() => syncArtists(), setArtistSyncing, "Artist rankings");
  const handleSyncShows = wrap(() => syncShows(), setShowSyncing, "Show rankings");
  const handleSyncSetlists = wrap(() => syncSetlists(), setSetlistSyncing, "Setlist import");
  const handleCleanupSongs = wrap(() => cleanupSongs(), setCleanupSyncing, "Song cleanup");
  const handleBackfill = wrap(() => backfillSetlists(), setBackfillSyncing, "Setlist backfill");
  const handleResyncCatalogs = wrap(() => resyncCatalogs(), setCatalogSyncing, "Catalog sync");
  const handleImportTrending = wrap(() => importTrending(), setImportSyncing, "Trending import");
  const handleBootstrapFests = wrap(() => bootstrapFests(), setFestivalSyncing, "Festival bootstrap");
  const handleUpdateFestImages = wrap(() => updateFestImages(), setFestivalImageSyncing, "Festival images");
  const handleRecomputeEngagement = wrap(() => recomputeEngagement(), setEngagementRunning, "Engagement recompute");

  const handleTestSpotify = async () => {
    setSpotifyTesting(true);
    try {
      const r = await testSpotify();
      r.success ? toast.success(r.message || "Spotify OK") : toast.error(r.message || "Spotify test failed");
    } catch (e: any) {
      toast.error(e?.message || "Test failed");
    } finally {
      setSpotifyTesting(false);
    }
  };

  const handleForceCatalog = async () => {
    if (!forceArtistId) return;
    setForceCatalogRunning(true);
    try {
      await forceCatalogSync({ artistId: forceArtistId as Id<"artists"> });
      toast.success("Force catalog sync started");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setForceCatalogRunning(false);
    }
  };

  const handleRoleUpdate = async (userId: Id<"users">, role: "user" | "admin") => {
    try {
      await updateRole({ userId, role });
      toast.success("Role updated");
    } catch (e: any) {
      toast.error(e?.message || "Role update failed");
    }
  };

  const handleApproveClaim = async (claim: any) => {
    try {
      await approveClaim({ claimId: claim._id });
      toast.success("Claim approved");
    } catch (e: any) {
      toast.error(e?.message || "Approval failed");
    }
  };

  const handleRejectClaim = async (claim: any) => {
    try {
      await rejectClaim({ claimId: claim._id, reason: "Rejected by admin" });
      toast.success("Claim rejected");
    } catch (e: any) {
      toast.error(e?.message || "Rejection failed");
    }
  };

  const handleCronUpdate = async (name: string, intervalMs: number, enabled: boolean) => {
    try {
      await updateCron({ name, intervalMs, enabled });
      toast.success("Cron updated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleCronRunNow = async (name: string) => {
    try {
      await requestCronRunNow({ name });
      toast.success("Run-now requested");
    } catch {
      toast.error("Failed");
    }
  };

  const handlePromoteAdmin = async () => {
    if (!newAdminEmail) return;
    try {
      const res = await promoteByEmail({ email: newAdminEmail });
      if (res.promoted) toast.success("User promoted in database");
      else toast.info("No matching user; user must sign in first");

      const r2 = await setClerkRoleByEmail({ email: newAdminEmail, role: "admin" });
      if (r2.clerkUpdated) toast.success("Clerk role updated");
      else toast.message(r2.message || "Clerk not updated");
    } catch (e: any) {
      toast.error(e?.message || "Promotion failed");
    } finally {
      setNewAdminEmail("");
    }
  };

  /* ═══════ Pending count badge ═══════ */
  const pendingCount = pendingClaims?.length ?? 0;

  /* ═══════ Render ═══════ */
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full">
        {/* ──── Sidebar ──── */}
        <Sidebar className="border-r border-white/[0.06]">
          <SidebarHeader className="px-4 py-5 border-b border-white/[0.06]">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground/50 hover:text-foreground/80 transition-colors mb-3 text-xs">
              <ChevronLeft className="h-3.5 w-3.5" />
              Back to app
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                <Shield className="h-4 w-4 text-foreground/60" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-foreground tracking-tight">Admin</h1>
                <p className="text-[10px] text-muted-foreground/40 font-mono">setlists.live</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/30 px-4">
                Sections
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeSection === item.id}
                        onClick={() => setActiveSection(item.id)}
                        className="transition-all duration-150"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        {item.id === "artistClaims" && pendingCount > 0 && (
                          <span className="ml-auto text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full font-semibold border border-amber-500/20 tabular-nums">
                            {pendingCount}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-white/[0.06]">
            <div className="flex flex-col gap-2">
              <SentryTestButton />
              <SentryCaptureTestButton />
            </div>
            <p className="text-[10px] text-muted-foreground/20 mt-3 text-center font-mono">
              {logged?.appUser?.email ?? "admin"}
            </p>
          </SidebarFooter>
        </Sidebar>

        {/* ──── Main Content ──── */}
        <SidebarInset className="flex-1 overflow-auto">
          {/* Mobile trigger + breadcrumb */}
          <div className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
            <SidebarTrigger />
            <span className="text-xs text-muted-foreground/40 font-medium uppercase tracking-widest">
              {NAV_ITEMS.find((n) => n.id === activeSection)?.label}
            </span>
          </div>

          {/* Section content with crossfade */}
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div key={activeSection} {...sectionMotion}>
                {activeSection === "stats" && (
                  <AdminStatsSection
                    stats={stats}
                    analytics={analytics}
                    health={health}
                    logged={logged}
                    activeSyncJobs={activeSyncJobs}
                    errorStats={errorStats}
                    recentErrors={recentErrors}
                    spotifyTesting={spotifyTesting}
                    onTestSpotify={handleTestSpotify}
                  />
                )}

                {activeSection === "users" && (
                  <AdminUsersSection
                    users={users}
                    userSearch={userSearch}
                    onUserSearchChange={setUserSearch}
                    onRoleUpdate={handleRoleUpdate}
                  />
                )}

                {activeSection === "artistClaims" && (
                  <AdminArtistClaimsSection
                    pendingClaims={pendingClaims}
                    onApprove={handleApproveClaim}
                    onReject={handleRejectClaim}
                  />
                )}

                {activeSection === "syncs" && (
                  <AdminSyncSection
                    trendingSyncing={trendingSyncing}
                    artistSyncing={artistSyncing}
                    showSyncing={showSyncing}
                    setlistSyncing={setlistSyncing}
                    cleanupSyncing={cleanupSyncing}
                    backfillSyncing={backfillSyncing}
                    catalogSyncing={catalogSyncing}
                    importSyncing={importSyncing}
                    festivalSyncing={festivalSyncing}
                    festivalImageSyncing={festivalImageSyncing}
                    engagementRunning={engagementRunning}
                    forceCatalogRunning={forceCatalogRunning}
                    forceArtistId={forceArtistId}
                    newAdminEmail={newAdminEmail}
                    onSyncTrending={handleSyncTrending}
                    onSyncArtists={handleSyncArtists}
                    onSyncShows={handleSyncShows}
                    onSyncSetlists={handleSyncSetlists}
                    onCleanupSongs={handleCleanupSongs}
                    onBackfillSetlists={handleBackfill}
                    onResyncCatalogs={handleResyncCatalogs}
                    onImportTrending={handleImportTrending}
                    onBootstrapFestivals={handleBootstrapFests}
                    onUpdateFestivalImages={handleUpdateFestImages}
                    onRecomputeEngagement={handleRecomputeEngagement}
                    onForceCatalog={handleForceCatalog}
                    onForceArtistIdChange={setForceArtistId}
                    onNewAdminEmailChange={setNewAdminEmail}
                    onPromoteAdmin={handlePromoteAdmin}
                    activeSyncJobs={activeSyncJobs}
                    cronSettings={cronSettings}
                    onCronUpdate={handleCronUpdate}
                    onCronRunNow={handleCronRunNow}
                  />
                )}

                {activeSection === "logs" && (
                  <AdminLogsSection
                    recentActivity={recentActivity}
                    auditLogs={auditLogs}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
