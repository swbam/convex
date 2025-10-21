"use client";

import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import React, { useCallback, useEffect, useRef } from "react";

import { cn } from "../../lib/utils";

interface MagicCardProps {
  children?: React.ReactNode;
  className?: string;
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
  gradientFrom?: string;
  gradientTo?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function MagicCard({
  children,
  className,
  gradientSize = 0, // DISABLED: Set to 0 to remove spotlight effect
  gradientColor = "#262626",
  gradientOpacity = 0, // DISABLED: Set to 0 to remove spotlight effect
  gradientFrom = "#ffffff",
  gradientTo = "#ffffff",
  onClick,
}: MagicCardProps) {
  // DISABLED: Removed all mouse tracking for spotlight effect
  // Cards now have clean borders without cursor-following spotlight

  return (
    <div
      className={cn("group relative rounded-[inherit]", className)}
      onClick={onClick}
    >
      {/* Simple border - no animated gradient */}
      <div className="absolute inset-0 rounded-[inherit] bg-border" />
      <div className="absolute inset-px rounded-[inherit] bg-background" />
      <div className="relative">{children}</div>
    </div>
  );
}
