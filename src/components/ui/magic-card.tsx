"use client";

import React from "react";
import { cn } from "../../lib/utils";

interface MagicCardProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Glow variant: 'default' | 'animated' | 'section' | 'sm' | 'none' */
  variant?: "default" | "animated" | "section" | "sm" | "none";
  /** Opt in to interaction styling for clickable surfaces. */
  hoverGlow?: boolean;
  /** Show top edge highlight */
  edgeHighlight?: boolean;
  /** Padding preset */
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

// Keep the shared panel geometry consistent with legacy caller classes.
function stripConflictingClasses(className: string | undefined): string {
  if (!className) return "";
  
  // The panel owns its border, radius and base surface.
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
 * MagicCard - Shared panel surface with legacy variant compatibility
 * 
 * Variants:
 * - default: Standard shared panel
 * - animated: Legacy alias for the standard panel
 * - section: Section panel
 * - sm: Compact panel
 * - none: Unfiltered caller styling
 */
export function MagicCard({
  children,
  className,
  style,
  variant = "default",
  hoverGlow = false,
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

  // Preserve the existing caller API while using shared surface tokens.
  const safeClassName = variant === "none" ? className : stripConflictingClasses(className);

  return (
    <div
      className={cn(
        "app-surface relative overflow-hidden",
        variantClasses[variant],
        (hoverGlow || onClick) && "interactive-card",
        edgeHighlight && "glow-edge-top",
        paddingClasses[padding],
        safeClassName
      )}
      onClick={onClick}
      style={style}
    >
      <div className="app-surface-content relative z-10">{children}</div>
    </div>
  );
}

/**
 * GlowCard - Legacy alias for MagicCard
 * Use this for consistency across the app
 */
export function GlowCard({
  children,
  className,
  style,
  variant = "default",
  hoverGlow = false,
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
 * GlowSection - Legacy alias for a static section panel
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
