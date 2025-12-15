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

// Detail page skeleton
export function DetailPageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="container mx-auto px-4 sm:px-6 py-4 sm:py-8"
    >
      <div className="rounded-xl p-8 space-y-6 bg-card border border-border">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center gap-6">
            <div className={`w-32 h-32 sm:w-40 sm:h-40 ${shimmerClass} rounded-xl`} />
            <div className="flex-1 space-y-4">
              <div className={`h-8 sm:h-10 ${shimmerClass} rounded w-2/3`} />
              <div className={`h-4 sm:h-5 ${shimmerClass} rounded w-1/2`} />
              <div className={`h-4 sm:h-5 ${shimmerClass} rounded w-1/3`} />
            </div>
          </div>
          {/* Grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className={`h-40 sm:h-48 ${shimmerClass} rounded-xl`}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
