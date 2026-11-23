import React from 'react';
import { motion } from 'framer-motion';

// Theme-aware shimmer classes
const shimmerClass = "bg-gradient-to-r from-muted via-muted/60 to-muted animate-shimmer bg-[length:200%_100%]";

export function ArtistCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-shrink-0 w-72 overflow-hidden bg-card min-h-[192px] flex flex-col rounded-lg border border-border"
    >
      {/* Image skeleton */}
      <div className={`relative w-full h-32 ${shimmerClass}`} />
      
      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        <div className={`h-5 ${shimmerClass} rounded w-3/4`} />
        <div className={`h-4 ${shimmerClass} rounded w-1/2`} />
        <div className={`h-3 ${shimmerClass} rounded w-2/3`} />
      </div>
    </motion.div>
  );
}

export function ShowCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-shrink-0 w-72 overflow-hidden bg-card min-h-[192px] flex flex-col rounded-lg border border-border"
    >
      {/* Image skeleton */}
      <div className={`relative w-full h-32 ${shimmerClass}`} />
      
      {/* Content skeleton */}
      <div className="p-4 space-y-2">
        <div className={`h-5 ${shimmerClass} rounded w-4/5`} />
        <div className={`h-4 ${shimmerClass} rounded w-2/3`} />
        <div className={`h-4 ${shimmerClass} rounded w-3/4`} />
        <div className={`h-8 ${shimmerClass} rounded w-full mt-2`} />
      </div>
    </motion.div>
  );
}

export function FestivalCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-shrink-0 overflow-hidden bg-card min-h-[240px] flex flex-col rounded-xl border border-primary/10"
    >
      {/* Image skeleton */}
      <div className={`relative w-full aspect-square ${shimmerClass}`} />
      
      {/* Content skeleton */}
      <div className="p-3 space-y-2">
        <div className={`h-4 ${shimmerClass} rounded w-4/5`} />
        <div className={`h-3 ${shimmerClass} rounded w-2/3`} />
      </div>
    </motion.div>
  );
}

// Grid skeleton for page loading
export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
    >
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-xl overflow-hidden bg-card border border-border"
        >
          <div className={`aspect-square ${shimmerClass}`} />
          <div className="p-3 space-y-2">
            <div className={`h-4 ${shimmerClass} rounded w-3/4`} />
            <div className={`h-3 ${shimmerClass} rounded w-1/2`} />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// Stable, quiet placeholders that share the detail pages' header and content geometry.
export function DetailRowsSkeleton() {
  return <div role="status" aria-label="Loading content" className="space-y-2 py-2">
    <span className="sr-only">Loading content…</span>
    {Array.from({ length: 5 }, (_, i) => <div key={i} aria-hidden="true" className="flex h-14 items-center gap-4 border-b border-border/40 px-2"><span className="h-3 w-5 bg-muted/50 rounded" /><span className="h-4 w-2/3 max-w-72 bg-muted/50 rounded" /></div>)}
  </div>;
}
export function DetailPageSkeleton({ kind = "show" }: { kind?: "show" | "artist" | "venue" }) {
  return <div role="status" aria-label={`Loading ${kind}`} className="w-full" aria-busy="true">
    <span className="sr-only">Loading {kind}…</span>
    <div aria-hidden="true" className={`flex items-end bg-secondary/20 px-3 lg:px-8 pb-4 lg:pb-8 pt-5 lg:pt-20 ${kind === "artist" ? "min-h-[148px] lg:min-h-[320px]" : kind === "venue" ? "min-h-[180px]" : "min-h-[168px] lg:min-h-[280px]"}`}>
      <div className="mx-auto flex w-full max-w-6xl items-end gap-8">
        {kind !== "venue" && <div className="hidden lg:block w-40 h-40 shrink-0 rounded-[5px] bg-muted/40" />}
        <div className="flex-1 space-y-4"><div className="h-8 lg:h-12 w-3/4 max-w-xl bg-muted/40 rounded" /><div className="h-4 w-2/3 max-w-lg bg-muted/40 rounded" /><div className="h-10 w-40 bg-muted/40 rounded-[5px]" /></div>
      </div>
    </div>
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-5 sm:py-8"><DetailRowsSkeleton /></div>
  </div>;
}
