"use client";

import React from "react";
import { cn } from "../../lib/utils";

interface MagicCardProps {
  children?: React.ReactNode;
  className?: string;
  /** Glow variant: 'default' | 'animated' | 'section' | 'sm' | 'none' */
  variant?: "default" | "animated" | "section" | "sm" | "none";
  /** Enable hover glow effect */
  hoverGlow?: boolean;
  /** Show top edge highlight */
  edgeHighlight?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

/**
 * MagicCard - Premium card component with silver gradient glow effect
 * 
 * Variants:
 * - default: Standard glow card with gradient border
 * - animated: Rotating conic gradient border animation
 * - section: Larger section container style
 * - sm: Compact card for smaller elements
 * - none: No glow, just basic card styling
 */
export function MagicCard({
  children,
  className,
  variant = "default",
  hoverGlow = true,
  edgeHighlight = false,
  onClick,
}: MagicCardProps) {
  const variantClasses = {
    default: "glow-card",
    animated: "glow-card glow-card-animated",
    section: "glow-section",
    sm: "glow-card-sm",
    none: "bg-card border border-border",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        variantClasses[variant],
        hoverGlow && variant !== "none" && "glow-card-hover",
        edgeHighlight && "glow-edge-top",
        className
      )}
      onClick={onClick}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * GlowCard - Alias for MagicCard with default glow styling
 * Use this for consistency across the app
 */
export function GlowCard({
  children,
  className,
  variant = "default",
  hoverGlow = true,
  onClick,
}: MagicCardProps) {
  return (
    <MagicCard
      variant={variant}
      hoverGlow={hoverGlow}
      className={className}
      onClick={onClick}
    >
      {children}
    </MagicCard>
  );
}

/**
 * GlowSection - For larger content sections with subtle glow
 */
export function GlowSection({
  children,
  className,
  edgeHighlight = true,
}: {
  children?: React.ReactNode;
  className?: string;
  edgeHighlight?: boolean;
}) {
  return (
    <MagicCard
      variant="section"
      hoverGlow={false}
      edgeHighlight={edgeHighlight}
      className={className}
    >
      {children}
    </MagicCard>
  );
}
