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
  const baseClasses = "relative overflow-hidden touch-manipulation bg-card rounded-none sm:rounded-lg border-0 border-t border-b border-border sm:border sm:border-border flex flex-row sm:flex-col w-full active:bg-secondary sm:hover:bg-secondary transition-all duration-150 cursor-pointer active:scale-[0.99]";

  const imageClasses = "h-16 w-16 object-cover sm:h-32 sm:w-full flex-shrink-0 rounded-lg sm:rounded-none";
  const contentClasses = "px-4 py-3 flex-1 space-y-1 sm:p-4 sm:space-y-2";
  const titleClasses = "text-foreground font-bold text-base sm:text-base leading-tight line-clamp-1";
  const subtitleClasses = "text-muted-foreground text-sm line-clamp-1 sm:text-sm";

  return (
    <motion.div
      {...props}
      className={cn(baseClasses, className)}
      onClick={onClick}
      style={{
        minHeight: '72px', // 72px for premium feel on mobile
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
