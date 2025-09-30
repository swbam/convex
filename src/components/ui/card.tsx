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
  const baseClasses = "relative overflow-hidden touch-manipulation bg-black min-h-[192px] flex flex-col"; // h-48

  const variantClasses = variant === 'artist' ? "space-y-2 p-4" : "p-4 space-y-2";
  const imageHeight = variant === 'artist' ? 'h-32' : 'h-32'; // Consistent h-32

  return (
    <motion.div
      {...props}
      className={cn(baseClasses, className)}
      onClick={onClick}
      style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {imageSrc && (
        <div className={`${imageHeight} relative w-full overflow-hidden flex-shrink-0`}>
          <img 
            src={imageSrc} 
            alt={title} 
            className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-all"
          />
        </div>
      )}
      <div className={`${variantClasses} flex-1 flex flex-col justify-between`}>
        <div className="space-y-2">
          {title && <h3 className="text-white font-semibold text-base leading-tight line-clamp-1">{title}</h3>}
          {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
          {children}
        </div>
        {footer}
      </div>
    </motion.div>
  );
}
