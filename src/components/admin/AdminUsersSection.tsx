import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Users, Shield } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Id } from "../../../convex/_generated/dataModel";

const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const fadeUp = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

interface AdminUsersSectionProps {
    users: any[] | undefined;
    userSearch: string;
    onUserSearchChange: (v: string) => void;
    onRoleUpdate: (userId: Id<"users">, role: "user" | "admin") => void;
}

export function AdminUsersSection({
    users,
    userSearch,
    onUserSearchChange,
    onRoleUpdate,
}: AdminUsersSectionProps) {
    const shouldReduce = useReducedMotion();

    const filteredUsers = (users || []).filter((u: any) =>
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
    );

    return (
        <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-5"
        >
            {/* Search */}
            <motion.div variants={fadeUp}>
                <Input
                    placeholder="Search users by email..."
                    value={userSearch}
                    onChange={(e) => onUserSearchChange(e.target.value)}
                    className="max-w-sm border-white/[0.08] bg-white/[0.02] placeholder:text-muted-foreground/40 focus:border-white/[0.15]"
                />
            </motion.div>

            {/* User List */}
            <motion.div variants={stagger} className="space-y-2">
                {filteredUsers.map((user: any) => (
                    <motion.div
                        key={user._id}
                        variants={fadeUp}
                        whileHover={shouldReduce ? {} : { x: 2, transition: { duration: 0.15 } }}
                        className="group flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.1] transition-colors duration-200"
                        style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.02)" }}
                    >
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                                    <Users className="h-3.5 w-3.5 text-muted-foreground/50" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-foreground font-medium text-sm truncate">{user.email}</p>
                                    <p className="text-[11px] text-muted-foreground/40 font-mono truncate">{user._id}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            {/* Current role badge */}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${user.role === "admin"
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : "bg-white/[0.04] text-muted-foreground/60 border border-white/[0.06]"
                                }`}>
                                {user.role || "user"}
                            </span>

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onRoleUpdate(user._id, "admin")}
                                className="h-7 text-xs border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] text-foreground/70"
                            >
                                <Shield className="h-3 w-3 mr-1" />
                                Admin
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onRoleUpdate(user._id, "user")}
                                className="h-7 text-xs border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400/80"
                            >
                                User
                            </Button>
                        </div>
                    </motion.div>
                ))}

                {filteredUsers.length === 0 && users !== undefined && (
                    <div className="text-center py-12 text-muted-foreground/40 text-sm">
                        No users found
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
