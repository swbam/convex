import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from 'convex/react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Calendar,
  ChevronDown,
  Home,
  Menu,
  Mic,
  Search,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  X,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { SignOutButton } from '../SignOutButton'
import { Footer } from './Footer'
import { MobileBottomNav } from './MobileBottomNav'
import { MobileThemeToggle } from './MobileThemeToggle'
import { PageContainer } from './PageContainer'
import { PublicDashboard } from './PublicDashboard'
import { SearchBar } from './SearchBar'
import { SyncProgress } from './SyncProgress'
import { ThemeToggle } from './ThemeToggle'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface AppLayoutProps {
  children?: React.ReactNode
}

interface NavItem {
  name: string
  href: string
  icon: LucideIcon
}

const primaryNavigation: NavItem[] = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Artists', href: '/artists', icon: Mic },
  { name: 'Shows', href: '/shows', icon: Calendar },
  { name: 'Trending', href: '/trending', icon: TrendingUp },
]

const discoveryNavigation: NavItem[] = [
  { name: 'Festivals', href: '/festivals', icon: Sparkles },
  { name: 'Blog', href: '/blog', icon: Activity },
]

const drawerNavigation: NavItem[] = [
  ...primaryNavigation,
  ...discoveryNavigation,
  { name: 'For Artists', href: '/for-artists', icon: Settings },
]

const isPathActive = (pathname: string, href: string) =>
  pathname === href || (href !== '/' && pathname.startsWith(href))

const easeOut = [0.22, 1, 0.36, 1] as const

function BrandMark({ compact = false }: { compact?: boolean }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.span
      className="flex items-center"
      whileHover={shouldReduceMotion ? undefined : { scale: 1.015 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
    >
      <span
        className={`whitespace-nowrap font-bold tracking-[-0.045em] text-foreground ${
          compact ? 'text-[1.2rem]' : 'text-[1.35rem]'
        }`}
      >
        setlists.live
      </span>
    </motion.span>
  )
}

function DesktopNavItem({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick: () => void
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`relative flex h-9 items-center rounded-[10px] px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.015 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      aria-current={active ? 'page' : undefined}
    >
      {active && (
        <motion.span
          layoutId="desktop-navigation-active"
          className="absolute inset-0 rounded-[10px] border border-border/80 bg-accent/80 shadow-sm"
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 }
          }
        />
      )}
      <span className="relative z-10">{item.name}</span>
    </motion.button>
  )
}

function DrawerNavItem({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.button
      variants={{
        hidden: { opacity: 0, x: shouldReduceMotion ? 0 : 10 },
        show: { opacity: 1, x: 0 },
      }}
      onClick={onClick}
      className={`group relative flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-xl px-3.5 text-left text-[15px] font-medium transition-colors ${
        active ? 'text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      }`}
      whileHover={shouldReduceMotion ? undefined : { x: 2 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
    >
      {active && (
        <motion.span
          layoutId="drawer-navigation-active"
          className="absolute inset-0 rounded-xl border border-border bg-accent/80"
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 500, damping: 42 }
          }
        />
      )}
      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background/70">
        <Icon className="h-[17px] w-[17px]" />
      </span>
      <span className="relative z-10 flex-1">{item.name}</span>
      {active && <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-primary" />}
    </motion.button>
  )
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const { user, isSignedIn } = useUser()
  const shouldReduceMotion = useReducedMotion()
  const appUser = useQuery(api.auth.loggedInUser)

  const navigateTo = React.useCallback(
    (href: string) => {
      void navigate(href)
      setMenuOpen(false)
      setMobileSearchOpen(false)
    },
    [navigate],
  )

  const handleSearchResult = React.useCallback(
    (type: string, id: string, slug?: string) => {
      if (type === 'artist') navigateTo(`/artists/${slug || id}`)
      if (type === 'show') navigateTo(`/shows/${slug || id}`)
    },
    [navigateTo],
  )

  useEffect(() => {
    setMenuOpen(false)
    setMobileSearchOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!(menuOpen || mobileSearchOpen)) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen, mobileSearchOpen])

  useEffect(() => {
    if (!(menuOpen || mobileSearchOpen)) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setMobileSearchOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [menuOpen, mobileSearchOpen])

  return (
    <div
      className="relative flex min-h-dvh w-full max-w-[100vw] bg-transparent text-foreground"
      style={{ overflowX: 'clip' }}
    >
      <AnimatePresence initial={false}>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-[120] cursor-default bg-black/65 backdrop-blur-[3px] md:hidden"
              initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: shouldReduceMotion ? 1 : 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Main menu"
              className="fixed inset-y-0 right-0 z-[130] flex w-[88vw] max-w-[370px] flex-col overflow-hidden rounded-l-[28px] border-l border-border bg-background/95 shadow-2xl backdrop-blur-2xl md:hidden"
              initial={{ x: shouldReduceMotion ? 0 : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: shouldReduceMotion ? 0 : '100%' }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.28,
                ease: easeOut,
              }}
            >
              <div className="flex items-center justify-between border-b border-border/70 px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))]">
                <button type="button" onClick={() => navigateTo('/')} aria-label="Go home">
                  <BrandMark compact />
                </button>
                <motion.button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-5">
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  Explore
                </p>
                <motion.nav
                  className="space-y-1"
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
                  {drawerNavigation.map((item) => (
                    <DrawerNavItem
                      key={item.href}
                      item={item}
                      active={isPathActive(location.pathname, item.href)}
                      onClick={() => navigateTo(item.href)}
                    />
                  ))}

                  {isSignedIn && (
                    <DrawerNavItem
                      item={{ name: 'My Dashboard', href: '/dashboard', icon: User }}
                      active={location.pathname === '/dashboard'}
                      onClick={() => navigateTo('/dashboard')}
                    />
                  )}
                  {appUser?.appUser?.role === 'admin' && (
                    <DrawerNavItem
                      item={{ name: 'Admin', href: '/admin', icon: Shield }}
                      active={location.pathname.startsWith('/admin')}
                      onClick={() => navigateTo('/admin')}
                    />
                  )}
                </motion.nav>
              </div>

              <div className="border-t border-border/70 bg-background/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {isSignedIn && user ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => navigateTo('/profile')}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3 text-left"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                        {user.firstName?.[0] || user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() || 'U'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {user.fullName || user.firstName || 'Your account'}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.emailAddresses[0]?.emailAddress}
                        </span>
                      </span>
                    </button>
                    <SignOutButton />
                  </div>
                ) : (
                  <motion.button
                    type="button"
                    onClick={() => navigateTo('/signin')}
                    className="flex h-12 w-full items-center justify-center rounded-xl bg-foreground text-sm font-semibold text-background shadow-lg"
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  >
                    Sign in to vote
                  </motion.button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {mobileSearchOpen && (
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Search artists"
            className="fixed inset-0 z-[140] flex flex-col bg-background md:hidden"
            initial={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : -6 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: easeOut }}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Find your show
                </p>
                <h2 className="mt-0.5 text-xl font-bold tracking-tight">Search setlists.live</h2>
              </div>
              <motion.button
                type="button"
                onClick={() => setMobileSearchOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary/60 text-muted-foreground"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                aria-label="Close search"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5">
              <SearchBar
                autoFocus
                placeholder="Search artists…"
                className="w-full"
                onResultClick={handleSearchResult}
              />
              <motion.div
                className="mt-8"
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: shouldReduceMotion ? 0 : 0.08, duration: 0.18 }}
              >
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  Browse instead
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Artists', href: '/artists', icon: Mic },
                    { label: 'Shows', href: '/shows', icon: Calendar },
                    { label: 'Festivals', href: '/festivals', icon: Sparkles },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <motion.button
                        key={item.href}
                        type="button"
                        onClick={() => navigateTo(item.href)}
                        className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/35 text-sm font-medium"
                        whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                      >
                        <Icon className="h-5 w-5 text-primary" />
                        {item.label}
                      </motion.button>
                    )
                  })}
                </div>
              </motion.div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <header className="fixed inset-x-0 top-0 z-[100] border-b border-border/70 bg-background/90 shadow-[0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-2xl safe-area-top">
        <div className="flex h-14 items-center px-3.5 sm:px-5 md:h-16 lg:px-7">
          <div className="mx-auto flex w-full max-w-page-full items-center gap-2.5 lg:gap-4">
            <motion.button
              type="button"
              onClick={() => navigateTo('/')}
              className="flex flex-shrink-0 items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="setlists.live home"
            >
              <BrandMark compact />
            </motion.button>

            <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary navigation">
              {primaryNavigation.map((item) => (
                <DesktopNavItem
                  key={item.href}
                  item={item}
                  active={isPathActive(location.pathname, item.href)}
                  onClick={() => navigateTo(item.href)}
                />
              ))}
              <div className="hidden 2xl:contents">
                {discoveryNavigation.map((item) => (
                  <DesktopNavItem
                    key={item.href}
                    item={item}
                    active={isPathActive(location.pathname, item.href)}
                    onClick={() => navigateTo(item.href)}
                  />
                ))}
              </div>
              <div className="2xl:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.button
                      className="flex h-9 items-center gap-1 rounded-[10px] px-3 text-sm font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                    >
                      Explore
                      <ChevronDown className="h-3.5 w-3.5" />
                    </motion.button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 rounded-xl p-1.5">
                    {discoveryNavigation.map((item) => {
                      const Icon = item.icon
                      return (
                        <DropdownMenuItem key={item.href} onClick={() => navigateTo(item.href)} className="rounded-lg">
                          <Icon className="mr-2 h-4 w-4" />
                          {item.name}
                        </DropdownMenuItem>
                      )
                    })}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigateTo('/for-artists')} className="rounded-lg">
                      <Settings className="mr-2 h-4 w-4" />
                      For Artists
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </nav>

            <div className="min-w-0 flex-1" />

            <div className="relative z-[100] hidden w-full max-w-sm lg:block xl:max-w-md">
              <SearchBar onResultClick={handleSearchResult} />
            </div>

            <div className="flex flex-shrink-0 items-center gap-1 md:gap-1.5">
              <div className="hidden md:block">
                <ThemeToggle />
              </div>

              {isSignedIn && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.button
                      className="hidden h-9 items-center gap-2 rounded-[10px] border border-border/70 bg-secondary/30 px-2.5 text-sm font-medium hover:bg-secondary/60 md:flex"
                      whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
                        {user.firstName?.[0] || user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() || 'U'}
                      </span>
                      <span className="max-w-24 truncate">{user.firstName || 'Account'}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </motion.button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
                    <DropdownMenuItem onClick={() => navigateTo('/profile')} className="rounded-lg">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateTo('/activity')} className="rounded-lg">
                      <Activity className="mr-2 h-4 w-4" />
                      My Activity
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateTo('/dashboard')} className="rounded-lg">
                      <User className="mr-2 h-4 w-4" />
                      My Dashboard
                    </DropdownMenuItem>
                    {appUser?.appUser?.role === 'admin' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigateTo('/admin')} className="rounded-lg">
                          <Shield className="mr-2 h-4 w-4" />
                          Admin Dashboard
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <SignOutButton />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="hidden items-center gap-1.5 md:flex">
                  <Button
                    variant="ghost"
                    onClick={() => navigateTo('/signin')}
                    className="h-9 rounded-[10px] px-3 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground"
                  >
                    Sign in
                  </Button>
                  <motion.div
                    whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  >
                    <Button
                      onClick={() => navigateTo('/signup')}
                      className="h-9 rounded-[10px] bg-foreground px-4 text-sm font-semibold text-background shadow-sm hover:bg-foreground/90"
                    >
                      Sign up
                    </Button>
                  </motion.div>
                </div>
              )}

              <motion.button
                type="button"
                onClick={() => setMobileSearchOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent/60 hover:text-foreground md:hidden"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </motion.button>
              <div className="md:hidden">
                <MobileThemeToggle />
              </div>
              <motion.button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-secondary/35 text-muted-foreground hover:text-foreground md:hidden"
                onClick={() => setMenuOpen(true)}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      <div
        className="flex w-full min-w-0 max-w-[100vw] flex-1 flex-col pt-14 md:pt-16"
        style={{ overflowX: 'clip' }}
      >
        <main
          className="flex w-full min-w-0 flex-1 flex-col bg-transparent pb-24 md:pb-0"
          style={{ overflowX: 'clip' }}
        >
          <div className="relative w-full max-w-[100vw] min-w-0 flex-1">
            <PageContainer
              variant={
                location.pathname.startsWith('/shows') || location.pathname.startsWith('/artists')
                  ? 'full'
                  : location.pathname === '/'
                    ? 'wide'
                    : 'narrow'
              }
              noPadding={location.pathname.startsWith('/shows') || location.pathname.startsWith('/artists')}
            >
              <SyncProgress />
              {location.pathname === '/' ? (
                <PublicDashboard
                  onArtistClick={(artistId) => navigateTo(`/artists/${artistId}`)}
                  onShowClick={(showId, slug) => navigateTo(`/shows/${slug || showId}`)}
                  onSignInRequired={() => navigateTo('/signin')}
                  navigate={navigateTo}
                />
              ) : (
                children
              )}
            </PageContainer>
          </div>

          <div className="hidden md:block">
            <Footer />
          </div>
        </main>
      </div>

      <MobileBottomNav
        menuOpen={menuOpen}
        searchOpen={mobileSearchOpen}
        onMenuClick={() => setMenuOpen(true)}
        onSearchClick={() => setMobileSearchOpen(true)}
      />
    </div>
  )
}
