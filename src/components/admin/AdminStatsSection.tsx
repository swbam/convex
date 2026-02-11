import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
    Users, Music, Calendar, TrendingUp, Activity, Mic, Database,
    BarChart3, Shield, CheckCircle, AlertCircle, RefreshCw, Loader2,
} from "lucide-react";
import { AnimatedStatCard } from "./AnimatedStatCard";
import { AdminDiagItem } from "./AdminDiagItem";
import { Button } from "../ui/button";

// Stagger container
const stagger = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.05, delayChildren: 0.02 },
    },
};

const fadeUp = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

/* ─── Glass panel wrapper ─── */
function GlassPanel({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <motion.div
            variants={fadeUp}
            className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm ${className}`}
            style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.15)" }}
        >
            {children}
        </motion.div>
    );
}

/* ─── Skeleton loader ─── */
function Skeletons({ count, height = "h-20" }: { count: number; height?: string }) {
    return (
        <>
            {[...Array(count)].map((_, i) => (
                <div
                    key={i}
                    className={`${height} rounded-xl bg-white/[0.03] animate-pulse`}
                    style={{ animationDelay: `${i * 80}ms` }}
                />
            ))}
        </>
    );
}

/* ═══════════════════════════════════════════
   Props — all data passed from parent shell
   ═══════════════════════════════════════════ */
interface AdminStatsSectionProps {
    stats: any;
    analytics: any;
    health: any;
    logged: any;
    activeSyncJobs: any;
    errorStats: any;
    recentErrors: any;
    spotifyTesting: boolean;
    onTestSpotify: () => void;
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */
export function AdminStatsSection({
    stats,
    analytics,
    health,
    logged,
    activeSyncJobs,
    errorStats,
    recentErrors,
    spotifyTesting,
    onTestSpotify,
}: AdminStatsSectionProps) {
    const shouldReduce = useReducedMotion();

    return (
        <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-6"
        >
            {/* ─── Platform Statistics ─── */}
            <GlassPanel>
                <div className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-blue-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">Platform Statistics</h2>
                    </div>

                    {!stats ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <Skeletons count={6} />
                        </div>
                    ) : (
                        <motion.div
                            variants={stagger}
                            initial="hidden"
                            animate="show"
                            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
                        >
                            <AnimatedStatCard icon={<Users className="h-4.5 w-4.5" />} label="Users" value={stats.totalUsers} accentColor="blue" />
                            <AnimatedStatCard icon={<Mic className="h-4.5 w-4.5" />} label="Artists" value={stats.totalArtists} accentColor="purple" />
                            <AnimatedStatCard icon={<Calendar className="h-4.5 w-4.5" />} label="Shows" value={stats.totalShows} accentColor="cyan" />
                            <AnimatedStatCard icon={<Music className="h-4.5 w-4.5" />} label="Setlists" value={stats.totalSetlists} accentColor="green" />
                            <AnimatedStatCard icon={<TrendingUp className="h-4.5 w-4.5" />} label="Votes" value={stats.totalVotes} accentColor="amber" />
                            <AnimatedStatCard icon={<Activity className="h-4.5 w-4.5" />} label="Active Jobs" value={activeSyncJobs?.length || 0} accentColor="red" />
                        </motion.div>
                    )}
                </div>
            </GlassPanel>

            {/* ─── Analytics (last 30 days) ─── */}
            <GlassPanel>
                <div className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <BarChart3 className="h-4 w-4 text-purple-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">Analytics (last 30 days)</h2>
                    </div>

                    {!analytics ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Skeletons count={8} />
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <AnimatedStatCard icon={<Users className="h-4.5 w-4.5" />} label="Signups (30d)" value={analytics.signups?.total ?? 0} accentColor="blue" />
                                <AnimatedStatCard icon={<Music className="h-4.5 w-4.5" />} label="Spotify Connected" value={analytics.signups?.spotifyConnected ?? 0} accentColor="green" />
                                <AnimatedStatCard icon={<TrendingUp className="h-4.5 w-4.5" />} label="Votes (30d)" value={analytics.engagement?.votes?.total ?? 0} accentColor="amber" />
                                <AnimatedStatCard icon={<TrendingUp className="h-4.5 w-4.5" />} label="Song Votes (30d)" value={analytics.engagement?.songVotes?.total ?? 0} accentColor="purple" />
                            </motion.div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Ops health by day */}
                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                    <div className="text-xs font-semibold text-foreground/80 mb-3 uppercase tracking-wider">Ops Health (by day)</div>
                                    <div className="space-y-1.5 max-h-56 overflow-auto scrollbar-hide">
                                        {(analytics.ops?.cronRuns?.byDay || []).slice(-14).map((d: any) => (
                                            <div key={d.day} className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground font-mono">{d.day}</span>
                                                <span className="text-muted-foreground">
                                                    cron ok {d.success ?? 0} / fail {d.failure ?? 0} • errors {(() => {
                                                        const e = (analytics.ops?.errors?.byDay || []).find((x: any) => x.day === d.day);
                                                        return e ? (e.error ?? 0) : 0;
                                                    })()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Top shows */}
                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                    <div className="text-xs font-semibold text-foreground/80 mb-3 uppercase tracking-wider">Top Shows (internal rank)</div>
                                    <div className="space-y-1.5 max-h-56 overflow-auto scrollbar-hide">
                                        {(analytics.top?.shows || []).map((s: any) => (
                                            <div key={s._id} className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground truncate">
                                                    {s.artist?.name || "Unknown"} • {s.venue?.city || ""} • {s.date}
                                                </span>
                                                <span className="text-muted-foreground flex-shrink-0 font-mono">
                                                    #{s.trendingRank ?? "—"} • {s.voteCount ?? 0} votes
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </GlassPanel>

            {/* ─── Auth Diagnostics ─── */}
            <GlassPanel>
                <div className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                            <Shield className="h-4 w-4 text-foreground/60" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">Auth Diagnostics</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        <AdminDiagItem label="Clerk subject" value={logged?.identity?.subject} />
                        <AdminDiagItem label="JWT issuer" value={logged?.identity?.issuer} />
                        <AdminDiagItem label="JWT audience" value={logged?.identity?.audience} />
                        <AdminDiagItem label="App user id" value={logged?.appUser?._id} />
                        <AdminDiagItem label="App user role" value={logged?.appUser?.role || "user"} />
                        <AdminDiagItem label="Has Spotify ID" value={logged?.appUser?.spotifyId ? "yes" : "no"} />
                    </div>

                    <div className="mt-4">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={spotifyTesting}
                            onClick={onTestSpotify}
                            className="border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-foreground/80"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 mr-2 ${spotifyTesting ? "animate-spin" : ""}`} />
                            Test Spotify Credentials
                        </Button>
                    </div>
                </div>
            </GlassPanel>

            {/* ─── System Health ─── */}
            <GlassPanel>
                <div className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">System Health</h2>
                    </div>

                    {!health ? (
                        <div className="space-y-3">
                            <Skeletons count={3} height="h-16" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Database</div>
                                <div className="text-xl font-bold text-foreground tabular-nums">{health.database.totalRecords.toLocaleString()}</div>
                                <div className="text-xs text-muted-foreground/60 mt-0.5">{health.database.orphanedRecords} orphaned</div>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Sync Status</div>
                                <div className="text-xl font-bold text-foreground tabular-nums">{health.sync.artistsNeedingSync}</div>
                                <div className="text-xs text-muted-foreground/60 mt-0.5">artists need sync</div>
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">API Status</div>
                                <div className="flex gap-2 mt-2">
                                    {[
                                        { label: "Spotify", ok: health.api.spotifyConfigured },
                                        { label: "TM", ok: health.api.ticketmasterConfigured },
                                        { label: "Setlist.fm", ok: health.api.setlistfmConfigured },
                                    ].map((api) => (
                                        <span
                                            key={api.label}
                                            className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${api.ok
                                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                                                }`}
                                        >
                                            {api.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </GlassPanel>

            {/* ─── Error Monitoring ─── */}
            <GlassPanel>
                <div className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <AlertCircle className="h-4 w-4 text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-foreground tracking-tight">Error Monitoring</h2>
                            <p className="text-[11px] text-muted-foreground/50">Pulled from admin/errorMonitoring</p>
                        </div>
                    </div>

                    {/* Error stats grid */}
                    {!errorStats ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                            <Skeletons count={4} height="h-14" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                            {[
                                { label: "Total", value: errorStats.total },
                                { label: "Unresolved", value: errorStats.unresolved },
                                { label: "Last 24h", value: errorStats.last24Hours },
                                { label: "Errors", value: errorStats.bySeverity.error },
                            ].map((s) => (
                                <div key={s.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{s.label}</div>
                                    <div className="text-foreground font-bold text-lg tabular-nums">{s.value}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Recent errors */}
                    <div className="space-y-2">
                        {!recentErrors ? (
                            <Skeletons count={3} height="h-12" />
                        ) : recentErrors.length === 0 ? (
                            <p className="text-muted-foreground/60 text-sm">No unresolved errors 🎉</p>
                        ) : (
                            recentErrors.map((err: any) => (
                                <div key={err._id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                                    <div className="flex justify-between text-sm text-foreground">
                                        <span className="font-medium">{err.operation}</span>
                                        <span className="text-xs text-muted-foreground/50 font-mono">
                                            {new Date(err.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground/60 mt-1 truncate">{err.error}</p>
                                    <p className="text-[11px] text-muted-foreground/40 mt-1">
                                        Severity: {err.severity} • Resolved: {err.resolved ? "yes" : "no"}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </GlassPanel>
        </motion.div>
    );
}
