import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Mic, Calendar, TrendingUp, Activity as ActivityIcon, User } from 'lucide-react'
import { useUser } from '@clerk/clerk-react'

interface TabItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  requiresAuth?: boolean
}

interface MobileBottomNavProps {
  onMenuClick?: () => void
}

export function MobileBottomNav({ onMenuClick }: MobileBottomNavProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isSignedIn } = useUser()

  const navItems = React.useMemo<TabItem[]>(() => {
    const base: TabItem[] = [
      { to: '/', label: 'Home', icon: Home },
      { to: '/artists', label: 'Artists', icon: Mic },
      { to: '/shows', label: 'Shows', icon: Calendar },
      { to: '/trending', label: 'Trending', icon: TrendingUp },
    ]

    if (isSignedIn) {
      base.push({ to: '/activity', label: 'Activity', icon: ActivityIcon, requiresAuth: true })
    }

    return base
  }, [isSignedIn])

  const totalColumns = navItems.length + 1;
  const gridColumnsClass = totalColumns === 6 ? 'grid-cols-6' : 'grid-cols-5';
  
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border md:hidden safe-area-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className={`grid ${gridColumnsClass} relative`}>
        {navItems.map((item) => {
          const isActive = pathname === item.to || 
            (item.to !== '/' && pathname.startsWith(item.to))
          const Icon = item.icon
          
          const handleClick = () => {
            if (item.requiresAuth && !isSignedIn) {
              navigate('/signin')
            } else {
              navigate(item.to)
            }
          }
          
          return (
            <li key={item.to} className="relative">
              <button
                onClick={handleClick}
                className={[
                  'relative flex flex-col items-center justify-center w-full py-2 px-1 transition-all duration-200 touch-target',
                  'hover:bg-accent/20 active:bg-accent/30 active:scale-95',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                ].join(' ')}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute top-0 inset-x-4 h-0.5 bg-primary rounded-full animate-in slide-in-from-bottom-2 duration-300" />
                )}
                
                {/* Icon with notification badge support */}
                <div className="relative">
                  <Icon className={[
                    'h-5 w-5 transition-all duration-200',
                    isActive ? 'scale-110' : ''
                  ].join(' ')} />
                  
                  {/* Example notification badge - can be made dynamic */}
                  {item.to === '/activity' && isSignedIn && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
                  )}
                </div>
                
                {/* Label */}
                <span className={[
                  'text-[10px] mt-1 font-medium transition-all duration-200',
                  isActive ? 'text-primary' : ''
                ].join(' ')}>
                  {item.label}
                </span>
              </button>
            </li>
          )
        })}
        
        {/* User Menu Button */}
        <li className="relative">
          <button
            onClick={() => {
              if (!isSignedIn) {
                navigate('/signin')
              } else {
                // Open the mobile menu
                onMenuClick?.()
              }
            }}
            className="relative flex flex-col items-center justify-center w-full py-2 px-1 transition-all duration-200 touch-target hover:bg-accent/20 active:bg-accent/30 active:scale-95 text-muted-foreground"
            aria-label="User menu"
          >
            <div className="relative">
              <User className="h-5 w-5 transition-all duration-200" />
              {isSignedIn && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
              )}
            </div>
            <span className="text-[10px] mt-1 font-medium">
              {isSignedIn ? 'Menu' : 'Sign In'}
            </span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
