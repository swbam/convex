"use client";

import React from "react";
import { cn } from "../../lib/utils";

interface MagicCardProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Glow variant: 'default' | 'animated' | 'section' | 'sm' | 'none' */
  variant?: "default" | "animated" | "section" | "sm" | "none";
  /** Enable hover glow effect */
  hoverGlow?: boolean;
  /** Show top edge highlight */
  edgeHighlight?: boolean;
  /** Padding preset */
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

// Helper to strip conflicting classes that would override glow styling
function stripConflictingClasses(className: string | undefined): string {
  if (!className) return "";
  
  // Remove classes that conflict with glow system
  return className
    .split(" ")
    .filter((cls) => {
      // Keep padding, margin, width, height, flex, grid, text, etc.
      // Remove: rounded-*, border-*, bg-card, bg-secondary, bg-muted variants that override glow
      if (cls.startsWith("rounded-")) return false;
      if (cls.startsWith("border-") && !cls.includes("border-t-") && !cls.includes("border-b-") && !cls.includes("border-l-") && !cls.includes("border-r-")) return false;
      if (cls === "border") return false;
      if (cls === "bg-card") return false;
      if (cls.startsWith("bg-card/")) return false;
      if (cls.startsWith("bg-secondary/")) return false;
      if (cls.startsWith("bg-muted/")) return false;
      return true;
    })
    .join(" ");
}

const paddingClasses = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-6",
  lg: "p-6 sm:p-8",
};

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
  style,
  variant = "default",
  hoverGlow = true,
  edgeHighlight = false,
  padding = "none",
  onClick,
}: MagicCardProps) {
  const variantClasses = {
    default: "glow-card",
    animated: "glow-card glow-card-animated",
    section: "glow-section",
    sm: "glow-card-sm",
    none: "bg-card border border-border rounded-xl",
  };

  // Strip conflicting classes from user-provided className (except for 'none' variant)
  const safeClassName = variant === "none" ? className : stripConflictingClasses(className);

  return (
    <div
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        variantClasses[variant],
        hoverGlow && variant !== "none" && "glow-card-hover",
        edgeHighlight && "glow-edge-top",
        paddingClasses[padding],
        safeClassName
      )}
      onClick={onClick}
      style={style}
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
  style,
  variant = "default",
  hoverGlow = true,
  padding = "md",
  onClick,
}: MagicCardProps) {
  return (
    <MagicCard
      variant={variant}
      hoverGlow={hoverGlow}
      padding={padding}
      className={className}
      onClick={onClick}
      style={style}
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
  padding = "lg",
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  edgeHighlight?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}) {
  return (
    <MagicCard
      variant="section"
      hoverGlow={false}
      edgeHighlight={edgeHighlight}
      padding={padding}
      className={className}
    >
      {children}
    </MagicCard>
  );
}
