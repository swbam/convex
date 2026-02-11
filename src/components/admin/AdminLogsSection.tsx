import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, Shield, TrendingUp, Music, UserCheck } from "lucide-react";

const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const fadeUp = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

/* ─── Glass panel ─── */
function GlassPanel({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            variants={fadeUp}
            className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm"
            style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.15)" }}
        >
            {children}
        </motion.div>
    );
}

/* ─── Activity type icon ─── */
function ActivityIcon({ type }: { type: string }) {
    const map: Record<string, React.ReactNode> = {
        vote: <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />,
        setlist: <Music className="h-3.5 w-3.5 text-blue-400" />,
        user: <UserCheck className="h-3.5 w-3.5 text-purple-400" />,
    };
    return <>{map[type] || <Activity className="h-3.5 w-3.5 text-muted-foreground/40" />}</>;
}

interface AdminLogsSectionProps {
    recentActivity: any[] | undefined;
    auditLogs: any[] | undefined;
}

export function AdminLogsSection({ recentActivity, auditLogs }: AdminLogsSectionProps) {
    const shouldReduce = useReducedMotion();

    return (
        <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-6"
        >
            {/* ─── Recent Activity ─── */}
            <GlassPanel>
                <div className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Activity className="h-4 w-4 text-blue-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">Recent Activity</h2>
                    </div>

                    {!recentActivity ? (
                        <div className="space-y-2">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="h-14 rounded-lg bg-white/[0.02] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                            ))}
                        </div>
                    ) : recentActivity.length === 0 ? (
                        <div className="text-center py-14">
                            <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground/15" />
                            <p className="text-muted-foreground/40 text-sm">No recent activity</p>
                        </div>
                    ) : (
                        <motion.div variants={stagger} className="space-y-1.5">
                            {recentActivity.map((a: any, idx: number) => (
                                <motion.div
                                    key={idx}
                                    variants={fadeUp}
                                    whileHover={shouldReduce ? {} : { x: 2, transition: { duration: 0.12 } }}
                                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors duration-150"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-white/[0.03] flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <ActivityIcon type={a.type} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-foreground/90 text-sm">{a.description}</p>
                                        <p className="text-[11px] text-muted-foreground/30 mt-0.5 font-mono">
                                            {new Date(a.timestamp).toLocaleString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                hour: "numeric",
                                                minute: "2-digit",
                                            })}
                                            {a.user && ` • ${a.user}`}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>
            </GlassPanel>

            {/* ─── Admin Audit Log ─── */}
            <GlassPanel>
                <div className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Shield className="h-4 w-4 text-purple-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">Admin Audit Log</h2>
                    </div>

                    {!auditLogs ? (
                        <div className="space-y-2">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-12 rounded-lg bg-white/[0.02] animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                            ))}
                        </div>
                    ) : auditLogs.length === 0 ? (
                        <div className="text-center py-12">
                            <Shield className="h-10 w-10 mx-auto mb-3 text-muted-foreground/15" />
                            <p className="text-muted-foreground/40 text-sm">No audit events yet</p>
                        </div>
                    ) : (
                        <motion.div variants={stagger} className="space-y-1.5">
                            {auditLogs.slice(0, 30).map((log: any) => (
                                <motion.div
                                    key={log._id}
                                    variants={fadeUp}
                                    className="flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors duration-150"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm text-foreground/90 font-medium truncate">{log.action}</p>
                                        <p className="text-[11px] text-muted-foreground/30 mt-0.5 font-mono">
                                            {new Date(log.createdAt).toLocaleString()} • {log.success ? "success" : "failed"}
                                            {log.error ? ` • ${log.error}` : ""}
                                        </p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${log.success
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                                        }`}>
                                        {log.success ? "OK" : "ERR"}
                                    </span>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>
            </GlassPanel>
        </motion.div>
    );
}
