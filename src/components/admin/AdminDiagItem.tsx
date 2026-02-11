import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Copy, Check } from "lucide-react";

interface AdminDiagItemProps {
    label: string;
    value: any;
}

/**
 * Diagnostic key-value display with copy-to-clipboard and
 * subtle glass-morphism hover. Apple-refined dark mode.
 */
export function AdminDiagItem({ label, value }: AdminDiagItemProps) {
    const shouldReduce = useReducedMotion();
    const [copied, setCopied] = useState(false);
    const text = value === undefined || value === null ? "—" : String(value);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // fallback: ignore
        }
    };

    return (
        <motion.div
            whileHover={shouldReduce ? {} : {
                scale: 1.01,
                transition: { duration: 0.15, ease: "easeOut" },
            }}
            className="group relative overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 transition-colors duration-200 hover:border-white/[0.1]"
            style={{
                boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.02)",
            }}
        >
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 font-medium">
                {label}
            </div>
            <div className="flex items-center justify-between gap-2">
                <code className="text-sm text-foreground/90 truncate font-mono">{text}</code>
                <motion.button
                    onClick={() => { void copy(); }}
                    whileTap={shouldReduce ? {} : { scale: 0.9 }}
                    className="flex-shrink-0 inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs text-foreground/60 hover:text-foreground/90 hover:bg-white/[0.06] transition-colors duration-150"
                    aria-label={`Copy ${label}`}
                >
                    {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                        <Copy className="h-3.5 w-3.5" />
                    )}
                </motion.button>
            </div>
        </motion.div>
    );
}
