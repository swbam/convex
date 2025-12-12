import React from 'react'

interface PageContainerProps {
  className?: string
  children?: React.ReactNode
  variant?: 'narrow' | 'wide' | 'full'
  noPadding?: boolean
}

// Consistent centered page container with responsive spacing and proper mobile bottom nav clearance
// NOTE: Page transitions are handled by App.tsx AnimatePresence - do NOT add motion wrapper here
export function PageContainer({ className = '', children, variant = 'narrow', noPadding = false }: PageContainerProps) {
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
    <div className={[base, topSpacing, bottomSpacing, width, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}


