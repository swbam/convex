import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { UserCheck, Loader2 } from "lucide-react";
import { Button } from "../ui/button";

const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

interface AdminArtistClaimsSectionProps {
    pendingClaims: any[] | undefined;
    onApprove: (claim: any) => void;
    onReject: (claim: any) => void;
}

export function AdminArtistClaimsSection({
    pendingClaims,
    onApprove,
    onReject,
}: AdminArtistClaimsSectionProps) {
    const shouldReduce = useReducedMotion();

    return (
        <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-5"
        >
            {/* Header */}
            <motion.div variants={fadeUp} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-foreground tracking-tight">Artist Claims</h2>
                    <p className="text-xs text-muted-foreground/50">Review and approve artist dashboard access requests.</p>
                </div>
            </motion.div>

            {/* Content */}
            {pendingClaims === undefined ? (
                <motion.div variants={fadeUp} className="flex items-center gap-2 text-muted-foreground/50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                </motion.div>
            ) : !pendingClaims?.length ? (
                <motion.div variants={fadeUp} className="text-center py-16">
                    <UserCheck className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-muted-foreground/40 text-sm">No pending claims.</p>
                </motion.div>
            ) : (
                <motion.div variants={stagger} className="space-y-3">
                    {pendingClaims.map((c: any) => (
                        <motion.div
                            key={c._id}
                            variants={fadeUp}
                            whileHover={shouldReduce ? {} : {
                                y: -1,
                                transition: { duration: 0.15 },
                            }}
                            className="group rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 hover:border-white/[0.1] transition-colors duration-200"
                            style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.02)" }}
                        >
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="min-w-0 flex-1 space-y-2">
                                    {/* Artist name */}
                                    <div className="font-semibold text-foreground text-base">
                                        {c.artist?.name ?? "Unknown Artist"}
                                    </div>

                                    {/* Verified email badge */}
                                    {c.emailVerified ? (
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                                                ✓ Email verified
                                            </span>
                                            <span className="text-sm text-foreground/80">{c.verificationEmail}</span>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground/60 truncate">
                                            Requested by: {c.user?.email ?? c.user?.username ?? c.userId}
                                        </div>
                                    )}

                                    {/* Role & Organization */}
                                    {c.officialRole && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-muted-foreground/50">Role:</span>
                                            <span className="capitalize font-medium text-foreground/80">{c.officialRole}</span>
                                            {c.organizationName && (
                                                <span className="text-muted-foreground/50">at {c.organizationName}</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Links */}
                                    {c.officialWebsite && (
                                        <div className="text-xs">
                                            <a href={c.officialWebsite} target="_blank" rel="noopener noreferrer" className="text-blue-400/80 hover:text-blue-400 hover:underline transition-colors">
                                                {c.officialWebsite}
                                            </a>
                                        </div>
                                    )}
                                    {Array.isArray(c.socialLinks) && c.socialLinks.length > 0 && (
                                        <div className="text-xs text-muted-foreground/40">
                                            Social: {c.socialLinks.slice(0, 3).join(", ")}
                                        </div>
                                    )}
                                    {c.additionalContext && (
                                        <div className="text-xs text-muted-foreground/40 italic">
                                            "{c.additionalContext}"
                                        </div>
                                    )}

                                    {/* Metadata row */}
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground/30 pt-1">
                                        <span>Submitted: {c.submittedAt ? new Date(c.submittedAt).toLocaleString() : "Unknown"}</span>
                                        {c.spotifyUserId && <span>Spotify: {c.spotifyUserId}</span>}
                                    </div>

                                    {/* Legacy evidence */}
                                    {Array.isArray(c.evidence) && c.evidence.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-medium">Evidence</div>
                                            {c.evidence.slice(0, 5).map((e: any, idx: number) => (
                                                <div key={idx} className="text-xs text-muted-foreground/40 truncate">
                                                    {e.type}: {e.value}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-2 flex-shrink-0">
                                    <Button
                                        size="sm"
                                        onClick={() => onApprove(c)}
                                        className="bg-emerald-600/90 hover:bg-emerald-600 text-white border-0 h-8"
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onReject(c)}
                                        className="border-white/[0.08] bg-white/[0.02] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 h-8"
                                    >
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </motion.div>
    );
}
