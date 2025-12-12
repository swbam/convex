import React from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'

interface PageContainerProps {
  className?: string
  children?: React.ReactNode
  variant?: 'narrow' | 'wide' | 'full'
  noPadding?: boolean
}

// Page transition animation config - subtle fade with no layout shift
const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { 
    duration: 0.2,
    ease: [0.25, 0.1, 0.25, 1] 
  }
}

// Consistent centered page container with responsive spacing and proper mobile bottom nav clearance
export function PageContainer({ className = '', children, variant = 'narrow', noPadding = false }: PageContainerProps) {
  const location = useLocation()
  
  // Base container classes with responsive padding
  const base = noPadding 
    ? 'mx-auto w-full' 
    : 'mx-auto w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 safe-area-x'
  
  // Mobile bottom nav clearance only on small screens, normal padding on larger screens
  // Adjusted for better mobile experience with the new nav height
  const bottomSpacing = noPadding 
    ? '' 
    : 'pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-8 lg:pb-12'
  
  // Top spacing for consistent vertical rhythm
  const topSpacing = noPadding ? '' : 'pt-4 md:pt-6 lg:pt-8'
  
  // Responsive max-width based on variant with smooth transitions
  const width = variant === 'wide' 
    ? 'max-w-page-wide xl:max-w-page-full transition-all duration-300' 
    : variant === 'full'
    ? 'max-w-none'
    : 'max-w-page-narrow md:max-w-page-wide lg:max-w-page-wide xl:max-w-page-full transition-all duration-300'
  
  return (
    <motion.div 
      key={location.pathname}
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransition.transition}
      className={[base, topSpacing, bottomSpacing, width, className].filter(Boolean).join(' ')}
    >
      {children}
    </motion.div>
  )
}


