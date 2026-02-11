import React, { useEffect, useState } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion";

interface AnimatedStatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    accentColor?: string; // e.g. "blue", "green", "purple", "amber"
}

/**
 * Premium stat card with glass-morphism, animated spring counter,
 * and subtle hover lift. Dark-mode first, Apple-level refinement.
 */
export function AnimatedStatCard({
    icon,
    label,
    value,
    accentColor = "blue",
}: AnimatedStatCardProps) {
    const shouldReduce = useReducedMotion();
    const [hasAppeared, setHasAppeared] = useState(false);

    // Spring-animated number counter
    const springValue = useSpring(0, {
        stiffness: 80,
        damping: 20,
        restDelta: 0.5,
    });
    const displayValue = useTransform(springValue, (v) => Math.round(v).toLocaleString());

    useEffect(() => {
        if (shouldReduce) {
            springValue.jump(value);
        } else {
            springValue.set(value);
        }
        setHasAppeared(true);
    }, [value, springValue, shouldReduce]);

    // Accent color map for icon glow
    const accentMap: Record<string, { bg: string; text: string; glow: string }> = {
        blue: { bg: "bg-blue-500/10", text: "text-blue-400", glow: "shadow-blue-500/20" },
        green: { bg: "bg-emerald-500/10", text: "text-emerald-400", glow: "shadow-emerald-500/20" },
        purple: { bg: "bg-purple-500/10", text: "text-purple-400", glow: "shadow-purple-500/20" },
        amber: { bg: "bg-amber-500/10", text: "text-amber-400", glow: "shadow-amber-500/20" },
        red: { bg: "bg-red-500/10", text: "text-red-400", glow: "shadow-red-500/20" },
        cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", glow: "shadow-cyan-500/20" },
    };

    const accent = accentMap[accentColor] || accentMap.blue;

    return (
        <motion.div
            initial={shouldReduce ? { opacity: 1 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            whileHover={shouldReduce ? {} : {
                y: -2,
                transition: { duration: 0.2, ease: "easeOut" },
            }}
            className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4"
            style={{
                boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.2)",
            }}
        >
            {/* Subtle gradient overlay on hover */}
            <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04), transparent 70%)",
                }}
            />

            <div className="relative z-10 flex flex-col items-center text-center gap-2">
                {/* Icon with accent glow */}
                <div className={`w-9 h-9 rounded-lg ${accent.bg} flex items-center justify-center ${accent.text} transition-shadow duration-200 group-hover:shadow-lg ${accent.glow}`}>
                    {icon}
                </div>

                {/* Animated number */}
                {hasAppeared ? (
                    <motion.span className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
                        {displayValue}
                    </motion.span>
                ) : (
                    <span className="text-2xl font-bold text-foreground tabular-nums tracking-tight">0</span>
                )}

                {/* Label */}
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-medium">
                    {label}
                </span>
            </div>
        </motion.div>
    );
}
