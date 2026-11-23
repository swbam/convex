import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { motion, useReducedMotion } from 'framer-motion'
import { Calendar, Home, Search, TrendingUp, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface MobileBottomNavProps {
  menuOpen?: boolean
  searchOpen?: boolean
  onMenuClick?: () => void
  onSearchClick?: () => void
}

interface TabItem {
  key: string
  to?: string
  label: string
  icon: LucideIcon
  active: boolean
  onClick: () => void
}

export function MobileBottomNav({
  menuOpen = false,
  searchOpen = false,
  onMenuClick,
  onSearchClick,
}: MobileBottomNavProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isSignedIn } = useUser()
  const shouldReduceMotion = useReducedMotion()

  const tabs = React.useMemo<TabItem[]>(
    () => [
      {
        key: 'home',
        to: '/',
        label: 'Home',
        icon: Home,
        active: pathname === '/',
        onClick: () => void navigate('/'),
      },
      {
        key: 'search',
        label: 'Search',
        icon: Search,
        active: searchOpen || pathname === '/search',
        onClick: () => onSearchClick?.(),
      },
      {
        key: 'shows',
        to: '/shows',
        label: 'Shows',
        icon: Calendar,
        active: pathname.startsWith('/shows'),
        onClick: () => void navigate('/shows'),
      },
      {
        key: 'trending',
        to: '/trending',
        label: 'Trending',
        icon: TrendingUp,
        active: pathname.startsWith('/trending'),
        onClick: () => void navigate('/trending'),
      },
      {
        key: 'account',
        label: isSignedIn ? 'Menu' : 'Sign in',
        icon: User,
        active:
          menuOpen ||
          pathname === '/signin' ||
          pathname === '/profile' ||
          pathname === '/dashboard',
        onClick: () => {
          if (isSignedIn) onMenuClick?.()
          else void navigate('/signin')
        },
      },
    ],
    [isSignedIn, menuOpen, navigate, onMenuClick, onSearchClick, pathname, searchOpen],
  )

  return (
    <motion.nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Mobile navigation"
    >
      <motion.ul
        className="pointer-events-auto mx-auto grid h-[66px] max-w-md grid-cols-5 px-2 py-1"
        variants={{
          hidden: { opacity: 1 },
          show: {
            opacity: 1,
            transition: { staggerChildren: shouldReduceMotion ? 0 : 0.035 },
          },
        }}
        initial="hidden"
        animate="show"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <motion.li
              key={tab.key}
              className="relative min-w-0"
              variants={{
                hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 5 },
                show: { opacity: 1, y: 0 },
              }}
            >
              <motion.button
                type="button"
                onClick={tab.onClick}
                className={`relative flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg px-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  tab.active ? 'text-foreground' : 'text-muted-foreground'
                }`}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.025 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
                aria-label={tab.label}
                aria-current={tab.active && tab.to ? 'page' : undefined}
              >
                {tab.active && (
                  <motion.span
                    layoutId="mobile-navigation-active"
                    className="absolute inset-0 rounded-lg bg-accent/60"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 520, damping: 42, mass: 0.65 }
                    }
                  />
                )}
                <motion.span
                  className="relative z-10 flex h-7 items-center justify-center"
                  animate={{ y: tab.active && !shouldReduceMotion ? -1 : 0 }}
                  transition={{ duration: 0.12 }}
                >
                  <Icon className={`h-[20px] w-[20px] ${tab.active ? 'stroke-[2.35]' : 'stroke-[1.9]'}`} />
                  {tab.key === 'account' && isSignedIn && (
                    <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" />
                  )}
                </motion.span>
                <span className="relative z-10 max-w-full truncate text-[10px] font-semibold leading-none tracking-[-0.01em]">
                  {tab.label}
                </span>
              </motion.button>
            </motion.li>
          )
        })}
      </motion.ul>
    </motion.nav>
  )
}
