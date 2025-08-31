import React from 'react'

interface PageContainerProps {
  className?: string
  children?: React.ReactNode
  variant?: 'narrow' | 'wide' | 'full'
}

// Consistent centered page container with responsive spacing and proper mobile bottom nav clearance
export function PageContainer({ className = '', children, variant = 'narrow' }: PageContainerProps) {
  const base = 'mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12'
  
  // Mobile bottom nav clearance only on small screens, normal padding on larger screens
  const bottomSpacing = 'pb-[calc(72px+env(safe-area-inset-bottom))] sm:pb-8 lg:pb-12'
  
  // Responsive max-width based on variant
  const width = variant === 'wide' 
    ? 'max-w-page-wide xl:max-w-page-full' 
    : variant === 'full'
    ? 'max-w-none'
    : 'max-w-page-narrow lg:max-w-page-wide xl:max-w-page-full'
  
  return <div className={[base, bottomSpacing, width, className].join(' ')}>{children}</div>
}


