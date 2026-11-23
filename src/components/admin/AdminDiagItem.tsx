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
            className="group relative overflow-hidden rounded-lg border border-border bg-card p-3 transition-colors duration-200 hover:border-border-strong"
            style={{
                boxShadow: "var(--surface-shadow)",
            }}
        >
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-medium">
                {label}
            </div>
            <div className="flex items-center justify-between gap-2">
                <code className="text-sm text-foreground/90 truncate font-mono">{text}</code>
                <motion.button
                    onClick={() => { void copy(); }}
                    whileTap={shouldReduce ? {} : { scale: 0.9 }}
                    className="flex-shrink-0 inline-flex items-center justify-center rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground/60 hover:text-foreground/90 hover:bg-accent transition-colors duration-150"
                    aria-label={`Copy ${label}`}
                >
                    {copied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                    ) : (
                        <Copy className="h-3.5 w-3.5" />
                    )}
                </motion.button>
            </div>
        </motion.div>
    );
}
