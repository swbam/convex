import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { SearchBar } from './SearchBar'
import { SyncProgress } from './SyncProgress'
import { PublicDashboard } from './PublicDashboard'
import { Toaster } from './ui/sonner'
import { SignOutButton } from '../SignOutButton'
import { MagicCard } from './ui/magic-card'
import { BorderBeam } from './ui/border-beam'
import { Footer } from './Footer'
import { MobileBottomNav } from './MobileBottomNav'
import { PageContainer } from './PageContainer'
import { Home, Mic, Music, Menu, X } from 'lucide-react'

interface AppLayoutProps {
  children?: React.ReactNode
}

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Artists', href: '/artists', icon: Mic },
  { name: 'Shows', href: '/shows', icon: Music },
]

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, isSignedIn } = useUser()

  // Close sidebar on route change
  React.useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh bg-transparent text-foreground supports-[overflow:clip]:overflow-clip overflow-x-hidden relative">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden animate-in fade-in-0 duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Mobile-only Sidebar (hidden on desktop for centered layout) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[85vw] max-w-sm transform transition-transform duration-300 ease-in-out
        lg:hidden safe-area-top safe-area-bottom
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full rounded-none border-r border-white/10 bg-background/95 backdrop-blur-xl overflow-y-auto">
          {/* Sidebar Header with Magic UI */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-white/10">
            <div className="flex items-center justify-between p-4 sm:p-5">
              <button 
                onClick={(e) => { e.preventDefault(); void navigate('/'); setSidebarOpen(false); }}
                className="flex items-center space-x-2.5 group touch-target"
              >
                <div className="relative">
                  <div className="w-9 h-9 bg-foreground rounded-lg flex items-center justify-center">
                    <Music className="h-5 w-5 text-background" />
                  </div>
                  <BorderBeam size={40} duration={8} className="opacity-50 group-hover:opacity-100" />
                </div>
                <span className="text-responsive-xl font-bold text-foreground group-hover:text-primary transition-colors">TheSet</span>
              </button>
              <button 
                className="touch-target flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all active:scale-95"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Enhanced Navigation with Magic UI - Mobile Optimized */}
          <nav className="flex-1 px-3 py-4 space-y-1.5">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href))
              const IconComponent = item.icon
              
              return (
                <MagicCard
                  key={item.name}
                  className={`relative overflow-hidden rounded-xl transition-all duration-200 ${
                    isActive ? 'bg-primary/10 border-primary/20' : 'hover:bg-accent/50'
                  }`}
                  gradientSize={0}
                  gradientColor="#000000"
                  gradientOpacity={0}
                >
                  <button
                    onClick={() => {
                       void navigate(item.href)
                       setSidebarOpen(false)
                     }}
                    className={`
                      w-full flex items-center px-4 py-3.5 text-responsive-base font-medium transition-all group touch-target
                      ${isActive 
                        ? 'text-primary' 
                        : 'text-muted-foreground hover:text-foreground'
                      }
                    `}
                  >
                    <IconComponent className={`mr-3 h-5 w-5 transition-colors ${
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    }`} />
                    <span className="font-medium">{item.name}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </button>
                </MagicCard>
              )
            })}
          </nav>
          
          {/* Enhanced User Section with Magic UI */}
          <div className="p-3 border-t border-white/10 sticky bottom-0 bg-background/95 backdrop-blur-xl">
            {isSignedIn && user ? (
              <div className="space-y-3">
                <MagicCard className="p-3.5 bg-accent/20 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 bg-primary/20 border border-primary/30 rounded-full flex items-center justify-center text-responsive-sm font-semibold text-primary">
                        {user.firstName?.[0] || user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-responsive-sm font-semibold text-foreground truncate">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user.emailAddresses[0]?.emailAddress || 'User'}
                      </p>
                      <p className="text-responsive-xs text-muted-foreground truncate">
                        {user.emailAddresses[0]?.emailAddress}
                      </p>
                    </div>
                  </div>
                </MagicCard>
                
                <div className="space-y-2">
                  <SignOutButton />
                </div>
              </div>
            ) : (
              <MagicCard className="relative overflow-hidden rounded-xl bg-primary/5 border-primary/20">
                <button 
                  onClick={() => { void navigate('/signin'); setSidebarOpen(false); }}
                  className="w-full px-4 py-3.5 text-responsive-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all duration-200 relative z-10 touch-target"
                >
                  Sign In to Vote
                </button>
                <BorderBeam size={60} duration={6} className="opacity-60" />
              </MagicCard>
            )}
          </div>
        </div>
      </aside>
      
      {/* Enhanced Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 w-full">
        {/* Desktop top navigation */}
        <div className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 safe-area-top">
          <header className="px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 h-14 md:h-16 flex items-center">
            <div className="mx-auto w-full max-w-page-full flex items-center gap-2 sm:gap-3 md:gap-4">
              <button onClick={(e)=>{e.preventDefault(); void navigate('/')}} className="flex items-center gap-2 touch-target flex-shrink-0">
                <div className="w-8 h-8 md:w-9 md:h-9 bg-foreground rounded-lg flex items-center justify-center">
                  <Music className="h-4 w-4 md:h-5 md:w-5 text-background" />
                </div>
                <span className="hidden md:inline text-responsive-lg font-bold">TheSet</span>
              </button>

              <nav className="hidden md:flex items-center gap-1 lg:gap-2">
                <button onClick={()=>void navigate('/')} className={`px-3 lg:px-4 py-2 rounded-md text-responsive-sm font-medium transition-all ${location.pathname==='/'?'bg-accent text-foreground':'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>Home</button>
                <button onClick={()=>void navigate('/artists')} className={`px-3 lg:px-4 py-2 rounded-md text-responsive-sm font-medium transition-all ${location.pathname.startsWith('/artists')?'bg-accent text-foreground':'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>Artists</button>
                <button onClick={()=>void navigate('/shows')} className={`px-3 lg:px-4 py-2 rounded-md text-responsive-sm font-medium transition-all ${location.pathname.startsWith('/shows')?'bg-accent text-foreground':'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>Shows</button>
                <button onClick={()=>void navigate('/trending')} className={`px-3 lg:px-4 py-2 rounded-md text-responsive-sm font-medium transition-all ${location.pathname.startsWith('/trending')?'bg-accent text-foreground':'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>Trending</button>
              </nav>

              <div className="flex-1" />

              {/* Global search */}
              <div className="hidden lg:block w-full max-w-md xl:max-w-lg">
                <SearchBar onResultClick={(type: string, id: string, slug?: string) => {
                  if (type === 'artist') {
                    const urlParam = slug || id;
                    void navigate(`/artists/${urlParam}`)
                  } else if (type === 'show') {
                    const urlParam = slug || id;
                    void navigate(`/shows/${urlParam}`)
                  }
                }} />
              </div>

              {/* Mobile menu button */}
              <button 
                className="md:hidden touch-target flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all active:scale-95"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </header>
        </div>
        
        {/* Main Content Area with Enhanced Background */}
        <main className="flex-1 overflow-y-auto bg-transparent flex flex-col min-w-0">
          <div className="flex-1 min-w-0 relative">
            <PageContainer variant={location.pathname === '/' || location.pathname.startsWith('/shows') || location.pathname.startsWith('/artists') ? 'wide' : 'narrow'}>
              <SyncProgress />
              {location.pathname === '/' ? (
                <PublicDashboard 
                  onArtistClick={(artistId) => {
                    void navigate(`/artists/${artistId}`)
                  }}
                  onShowClick={(showId) => {
                    void navigate(`/shows/${showId}`)
                  }}
                  onSignInRequired={() => {
                    void navigate('/signin')
                  }}
                  navigate={(path: string) => { void navigate(path) }}
                />
              ) : (
                children
              )}
            </PageContainer>
          </div>

          {/* Footer (desktop only to avoid bottom-nav overlap) */}
          <div className="hidden md:block">
            <Footer />
          </div>
        </main>
      </div>
      
      <Toaster />
      <MobileBottomNav />
    </div>
  )
}