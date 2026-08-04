import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
    TrendingUp, Music, Calendar, Database, Mic, RefreshCw, Loader2,
    Shield, AlertCircle, CheckCircle, Sparkles, ImageIcon, Trash2, Activity,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { toast } from "sonner";

const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const fadeUp = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

/* ─── Reusable sync button ─── */
function SyncButton({
    label,
    loadingLabel,
    icon: Icon,
    loading,
    onClick,
    variant = "default",
}: {
    label: string;
    loadingLabel: string;
    icon: React.ElementType;
    loading: boolean;
    onClick: () => void;
    variant?: "default" | "danger";
}) {
    const shouldReduce = useReducedMotion();

    return (
        <motion.div whileHover={shouldReduce ? {} : { y: -1, transition: { duration: 0.15 } }}>
            <Button
                onClick={onClick}
                disabled={loading}
                variant="outline"
                className={`w-full justify-start h-11 border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-foreground/80 ${variant === "danger" ? "hover:border-red-500/20 hover:text-red-400" : "hover:border-white/[0.12]"
                    }`}
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 mr-2.5 animate-spin flex-shrink-0" />
                ) : (
                    <Icon className="h-4 w-4 mr-2.5 flex-shrink-0" />
                )}
                <span className="truncate">{loading ? loadingLabel : label}</span>
            </Button>
        </motion.div>
    );
}

/* ─── Section title ─── */
function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
    return (
        <motion.h3 variants={fadeUp} className="text-sm font-semibold text-foreground/80 flex items-center gap-2 uppercase tracking-wider">
            <Icon className="h-4 w-4 text-muted-foreground/50" />
            {children}
        </motion.h3>
    );
}

/* ─── Setlist.fm import health ─── */
const IMPORT_STATUS_META = [
    { key: "completed", label: "Completed", chip: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", alwaysShow: true },
    { key: "not_found", label: "Not found", chip: "bg-amber-500/10 text-amber-400 border-amber-500/20", alwaysShow: true },
    { key: "failed", label: "Failed", chip: "bg-red-500/10 text-red-400 border-red-500/20", alwaysShow: true },
    { key: "pending", label: "Pending", chip: "bg-white/[0.04] text-muted-foreground/70 border-white/[0.08]", alwaysShow: false },
    { key: "importing", label: "Importing", chip: "bg-white/[0.04] text-muted-foreground/70 border-white/[0.08]", alwaysShow: false },
    { key: "unset", label: "No status", chip: "bg-white/[0.04] text-muted-foreground/70 border-white/[0.08]", alwaysShow: false },
] as const;

function ImportHealthCard() {
    const importStats = useQuery(api.setlistfm.getImportStats);

    // Loading — skeleton matching neighboring sections
    if (importStats === undefined) {
        return <div className="h-28 rounded-xl bg-white/[0.02] animate-pulse" />;
    }

    // Non-admin — hide the card entirely
    if (importStats === null) return null;

    const recent = importStats.recentBreakdown ?? {};
    const global = importStats.globalCounts ?? {};
    const formatGlobal = (value: number) =>
        value === importStats.globalCountsCappedAt ? `${value.toLocaleString()}+` : value.toLocaleString();

    const globalParts = IMPORT_STATUS_META
        .map((m) => ({ label: m.label, value: global[m.key] ?? 0 }))
        .filter((p) => p.value > 0);

    return (
        <motion.div variants={fadeUp} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Activity className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground text-sm">Setlist.fm Import Health</h3>
                    <p className="text-[11px] text-muted-foreground/40">
                        Completed shows from the last {importStats.windowDays} days by import status
                    </p>
                </div>
                <span className="text-xs text-muted-foreground/40 font-mono tabular-nums flex-shrink-0">
                    {importStats.recentCompletedShows.toLocaleString()} shows
                </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {IMPORT_STATUS_META
                    .filter((m) => m.alwaysShow || (recent[m.key] ?? 0) > 0)
                    .map((m) => (
                        <span
                            key={m.key}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${m.chip}`}
                        >
                            {m.label}
                            <span className="font-semibold tabular-nums">{(recent[m.key] ?? 0).toLocaleString()}</span>
                        </span>
                    ))}
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground/30">
                All-time:{" "}
                {globalParts.length === 0
                    ? "no import records yet"
                    : globalParts.map((p) => `${p.label} ${formatGlobal(p.value)}`).join(" · ")}
            </p>
        </motion.div>
    );
}

/* ─── Setlist.fm history import (manual trigger) ─── */
function ImportSetlistHistoryCard() {
    const [artistId, setArtistId] = React.useState("");
    const [running, setRunning] = React.useState(false);
    // api.admin.importSetlistHistoryForArtist is added by the backend concurrently;
    // cast keeps this compiling if generated types lag the new action.
    const importSetlistHistory = useAction((api as any).admin.importSetlistHistoryForArtist);

    const handleImport = async () => {
        const id = artistId.trim();
        if (!id) {
            toast.error("Enter an artist ID");
            return;
        }
        setRunning(true);
        try {
            await importSetlistHistory({ artistId: id as any });
            toast.success("Setlist history import started");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to import setlist history");
        } finally {
            setRunning(false);
        }
    };

    return (
        <motion.div variants={fadeUp} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">Import setlist history by Artist ID</p>
            <div className="flex gap-2">
                <Input
                    placeholder="artistId"
                    value={artistId}
                    onChange={(e) => setArtistId(e.target.value)}
                    className="border-white/[0.08] bg-white/[0.02] placeholder:text-muted-foreground/30"
                />
                <Button
                    onClick={() => void handleImport()}
                    disabled={running}
                    variant="outline"
                    className="border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] whitespace-nowrap"
                >
                    {running ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {running ? "Importing..." : "Import setlist history"}
                </Button>
            </div>
        </motion.div>
    );
}

interface AdminSyncSectionProps {
    // Sync states
    trendingSyncing: boolean;
    artistSyncing: boolean;
    showSyncing: boolean;
    setlistSyncing: boolean;
    cleanupSyncing: boolean;
    backfillSyncing: boolean;
    catalogSyncing: boolean;
    importSyncing: boolean;
    festivalSyncing: boolean;
    festivalImageSyncing: boolean;
    engagementRunning: boolean;
    forceCatalogRunning: boolean;
    forceArtistId: string;
    newAdminEmail: string;
    // Handlers
    onSyncTrending: () => void;
    onSyncArtists: () => void;
    onSyncShows: () => void;
    onSyncSetlists: () => void;
    onCleanupSongs: () => void;
    onBackfillSetlists: () => void;
    onResyncCatalogs: () => void;
    onImportTrending: () => void;
    onBootstrapFestivals: () => void;
    onUpdateFestivalImages: () => void;
    onRecomputeEngagement: () => void;
    onForceCatalog: () => void;
    onForceArtistIdChange: (v: string) => void;
    onNewAdminEmailChange: (v: string) => void;
    onPromoteAdmin: () => void;
    // Data
    activeSyncJobs: any;
    cronSettings: any;
    onCronUpdate: (name: string, intervalMs: number, enabled: boolean) => void;
    onCronRunNow: (name: string) => void;
}

export function AdminSyncSection(props: AdminSyncSectionProps) {
    const shouldReduce = useReducedMotion();

    return (
        <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-8"
        >
            {/* ─── Trending & Rankings ─── */}
            <div className="space-y-3">
                <SectionTitle icon={TrendingUp}>Trending & Rankings</SectionTitle>
                <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <SyncButton icon={TrendingUp} label="Update All Trending" loadingLabel="Updating..." loading={props.trendingSyncing} onClick={props.onSyncTrending} />
                    <SyncButton icon={Mic} label="Artist Rankings" loadingLabel="Syncing..." loading={props.artistSyncing} onClick={props.onSyncArtists} />
                    <SyncButton icon={Calendar} label="Show Rankings" loadingLabel="Syncing..." loading={props.showSyncing} onClick={props.onSyncShows} />
                </motion.div>
            </div>

            {/* ─── Setlist Generation ─── */}
            <div className="space-y-3">
                <SectionTitle icon={Music}>Setlist Generation</SectionTitle>
                <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <SyncButton icon={Music} label="Generate Initial Setlists" loadingLabel="Generating..." loading={props.backfillSyncing} onClick={props.onBackfillSetlists} />
                    <SyncButton icon={RefreshCw} label="Import from Setlist.fm" loadingLabel="Importing..." loading={props.setlistSyncing} onClick={props.onSyncSetlists} />
                    <SyncButton icon={Database} label="Import Artist Catalogs" loadingLabel="Syncing..." loading={props.catalogSyncing} onClick={props.onResyncCatalogs} />
                </motion.div>
                <ImportSetlistHistoryCard />
                <ImportHealthCard />
            </div>

            {/* ─── Force Sync & Engagement ─── */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2.5">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">Force catalog sync by Artist ID</p>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Artist ID"
                            value={props.forceArtistId}
                            onChange={(e) => props.onForceArtistIdChange(e.target.value)}
                            className="border-white/[0.08] bg-white/[0.02] placeholder:text-muted-foreground/30"
                        />
                        <Button
                            onClick={props.onForceCatalog}
                            disabled={props.forceCatalogRunning}
                            variant="outline"
                            className="border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] whitespace-nowrap"
                        >
                            {props.forceCatalogRunning ? "Syncing..." : "Force Sync"}
                        </Button>
                    </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2.5">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">One-time engagement backfill</p>
                    <Button
                        onClick={props.onRecomputeEngagement}
                        disabled={props.engagementRunning}
                        variant="outline"
                        className="border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                    >
                        {props.engagementRunning ? "Recomputing..." : "Recompute counts"}
                    </Button>
                </div>
            </motion.div>

            {/* ─── Data Import & Cleanup ─── */}
            <div className="space-y-3">
                <SectionTitle icon={Database}>Data Import & Cleanup</SectionTitle>
                <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <SyncButton icon={TrendingUp} label="Import Trending Artists" loadingLabel="Importing..." loading={props.importSyncing} onClick={props.onImportTrending} />
                    <SyncButton icon={Trash2} label="Clean Non-Studio Songs" loadingLabel="Cleaning..." loading={props.cleanupSyncing} onClick={props.onCleanupSongs} variant="danger" />
                    <SyncButton icon={Sparkles} label="Bootstrap Festivals" loadingLabel="Importing..." loading={props.festivalSyncing} onClick={props.onBootstrapFestivals} />
                    <SyncButton icon={ImageIcon} label="Update Festival Images" loadingLabel="Fetching..." loading={props.festivalImageSyncing} onClick={props.onUpdateFestivalImages} />
                </motion.div>
            </div>

            {/* ─── Admin Users / Promote ─── */}
            <div className="space-y-3">
                <SectionTitle icon={Shield}>Admin Users</SectionTitle>
                <motion.div variants={fadeUp} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium mb-2.5">Promote user by email</div>
                    <div className="flex gap-2">
                        <Input
                            placeholder="user@example.com"
                            value={props.newAdminEmail}
                            onChange={(e) => props.onNewAdminEmailChange(e.target.value)}
                            className="flex-1 border-white/[0.08] bg-white/[0.02] placeholder:text-muted-foreground/30"
                        />
                        <Button
                            onClick={props.onPromoteAdmin}
                            variant="outline"
                            className="border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                        >
                            Promote
                        </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground/30 mt-2">
                        Note: Clerk role update requires CLERK_SECRET_KEY configured.
                    </p>
                </motion.div>
            </div>

            {/* ─── Active Sync Jobs ─── */}
            <div className="space-y-3">
                <SectionTitle icon={RefreshCw}>Active Sync Jobs</SectionTitle>
                {!props.activeSyncJobs ? (
                    <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-14 rounded-xl bg-white/[0.02] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                        ))}
                    </div>
                ) : props.activeSyncJobs.length === 0 ? (
                    <motion.p variants={fadeUp} className="text-sm text-muted-foreground/40">No running sync jobs.</motion.p>
                ) : (
                    <motion.div variants={stagger} className="space-y-2">
                        {props.activeSyncJobs.map((job: any) => (
                            <motion.div
                                key={job._id}
                                variants={fadeUp}
                                className="flex justify-between items-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5"
                            >
                                <div>
                                    <div className="text-sm text-foreground font-medium">{job.type}</div>
                                    <div className="text-xs text-muted-foreground/40">Step: {job.currentStep || "n/a"}</div>
                                </div>
                                <div className="text-xs text-muted-foreground/40 font-mono">
                                    {job.progressPercentage ?? 0}% • Retries: {job.retryCount}/{job.maxRetries}
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>

            {/* ─── Cron Schedules ─── */}
            <div className="space-y-3">
                <SectionTitle icon={Calendar}>Cron Schedules</SectionTitle>
                {!props.cronSettings ? (
                    <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-14 rounded-xl bg-white/[0.02] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                        ))}
                    </div>
                ) : (
                    <motion.div variants={stagger} className="space-y-2">
                        {props.cronSettings.map((c: any) => (
                            <motion.div
                                key={c._id}
                                variants={fadeUp}
                                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-foreground font-medium truncate">{c.name}</div>
                                    <div className="text-[11px] text-muted-foreground/40">
                                        Last run: {c.lastRunAt ? new Date(c.lastRunAt).toLocaleString() : "never"}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground/30">
                                        Last success: {c.lastSuccessAt ? new Date(c.lastSuccessAt).toLocaleString() : "—"}
                                        {c.lastFailureAt ? ` • Last failure: ${new Date(c.lastFailureAt).toLocaleString()}` : ""}
                                    </div>
                                    {c.lastError && (
                                        <div className="text-[11px] text-red-400/70 truncate">Error: {c.lastError}</div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Input
                                        type="number"
                                        min={1}
                                        defaultValue={Math.max(1, Math.round((c.intervalMs || 60000) / 60000))}
                                        className="w-20 h-8 text-xs border-white/[0.08] bg-white/[0.02]"
                                        onBlur={(e) => {
                                            const minutes = Math.max(1, Number(e.currentTarget.value || 1));
                                            props.onCronUpdate(c.name, minutes * 60000, c.enabled !== false);
                                        }}
                                    />
                                    <span className="text-[10px] text-muted-foreground/40">min</span>
                                    <Checkbox
                                        checked={c.enabled !== false}
                                        onCheckedChange={(checked) => {
                                            props.onCronUpdate(c.name, c.intervalMs || 60000, Boolean(checked));
                                        }}
                                    />
                                    <span className="text-[10px] text-muted-foreground/40">On</span>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => props.onCronRunNow(c.name)}
                                        className="h-7 text-xs border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                                    >
                                        Run now
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
                <motion.p variants={fadeUp} className="text-[11px] text-muted-foreground/30">
                    Orchestrator checks every 5 min; jobs adhere to these intervals.
                </motion.p>
            </div>

            {/* ─── Status ─── */}
            <motion.div variants={fadeUp} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <AlertCircle className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground text-sm">Sync Status</h3>
                        <p className="text-[11px] text-muted-foreground/30">Last operation</p>
                    </div>
                </div>
                <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2 text-emerald-400/80">
                        <CheckCircle className="h-3 w-3" />
                        <span>System ready</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/30">
                        🔄 Trending updated every 4h • 📊 Rankings: popularity, followers, shows, activity
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
}
