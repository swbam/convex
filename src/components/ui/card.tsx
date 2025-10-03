import React from 'react';
import { motion } from 'framer-motion';
import { cn } from "@/lib/utils"; // Assume utils for cn

interface CardProps {
  variant?: 'artist' | 'show';
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  imageSrc?: string;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  [key: string]: any;
}

export function Card({ 
  variant = 'artist', 
  children, 
  onClick, 
  className, 
  imageSrc, 
  title, 
  subtitle, 
  footer, 
  ...props 
}: CardProps) {
  const baseClasses = "relative overflow-hidden touch-manipulation bg-black rounded-lg border border-white/10 flex flex-row md:flex-col w-full";

  const imageClasses = "h-20 w-20 object-cover md:h-32 md:w-full flex-shrink-0";
  const contentClasses = "p-3 flex-1 space-y-1 md:p-4 md:space-y-2";
  const titleClasses = "text-white font-semibold text-sm md:text-base leading-tight line-clamp-1";
  const subtitleClasses = "text-gray-400 text-xs line-clamp-1 md:text-sm";
  const textClasses = "text-xs md:text-sm text-gray-400";

  return (
    <motion.div
      {...props}
      className={cn(baseClasses, className)}
      onClick={onClick}
      style={{
        minHeight: '80px', // Compact on mobile
      }}
    >
      {imageSrc && (
        <div className={imageClasses}>
          <img 
            src={imageSrc} 
            alt={title} 
            className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-all"
          />
        </div>
      )}
      <div className={contentClasses}>
        <div className="space-y-1 md:space-y-2">
          {title && <h3 className={titleClasses}>{title}</h3>}
          {subtitle && <p className={subtitleClasses}>{subtitle}</p>}
          {children}
        </div>
        {footer}
      </div>
    </motion.div>
  );
}
