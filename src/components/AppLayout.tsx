import React, { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { SearchBar } from '@/components/SearchBar'
import { DashboardGrid } from '@/components/DashboardGrid'
import { Toaster } from '@/components/ui/sonner'

interface AppLayoutProps {
  children?: React.ReactNode
}

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: '🏠' },
  { name: 'Artists', href: '/artists', icon: '🎤' },
  { name: 'Shows', href: '/shows', icon: '🎵' },
  { name: 'Venues', href: '/venues', icon: '🏛️' },
]

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const trendingArtists = useQuery(api.artists.getTrending, { limit: 5 })
  
  const handleSignOut = () => {
    // TODO: Implement sign out
    console.log('Sign out clicked')
  }
  
  const handleSignUp = () => {
    void navigate('/signup')
  }

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <a href="/" className="flex items-center space-x-2" onClick={(e) => { e.preventDefault(); void navigate('/') }}>
            <span className="text-xl font-bold">MySetlist</span>
          </a>
          <button 
            className="lg:hidden p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href))
            
            return (
              <a
                key={item.name}
                href={item.href}
                className={`
                  flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-white text-black' 
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                  }
                `}
                onClick={(e) => {
                   e.preventDefault()
                   void navigate(item.href)
                   setSidebarOpen(false)
                 }}
              >
                <span className="mr-3">{item.icon}</span>
                {item.name}
              </a>
            )
          })}
        </nav>
        
        {/* Trending Artists */}
        {trendingArtists && trendingArtists.length > 0 && (
          <div className="px-4 py-6 border-t border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Trending Artists</h3>
            <div className="space-y-2">
              {trendingArtists.map((artist: any) => (
                <a
                  key={artist._id}
                  href={`/artists/${artist._id}`}
                  className="block px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                  onClick={(e) => {
                     e.preventDefault()
                     void navigate(`/artists/${artist._id}`)
                     setSidebarOpen(false)
                   }}
                >
                  {artist.name}
                </a>
              ))}
            </div>
          </div>
        )}
        
        {/* User Section */}
        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-sm font-medium">
              U
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">User</p>
              <p className="text-xs text-zinc-400 truncate">user@example.com</p>
            </div>
          </div>
          <div className="space-y-2">
            <button 
              onClick={handleSignOut}
              className="w-full px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors text-left"
            >
              Sign Out
            </button>
            <button 
              onClick={handleSignUp}
              className="w-full px-3 py-2 text-sm bg-white text-black hover:bg-zinc-200 rounded-md transition-colors"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Top Header */}
        <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <button 
              className="lg:hidden p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            
            <div className="flex-1 max-w-lg mx-4">
              <SearchBar onResultClick={(type: string, id: string) => {
                 if (type === 'artist') {
                   void navigate(`/artists/${id}`)
                 } else if (type === 'show') {
                   void navigate(`/shows/${id}`)
                 }
               }} />
            </div>
            
            <div className="flex items-center space-x-4">
              <button className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800">
                ⚙️
              </button>
            </div>
          </div>
        </header>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-black">
          <div className="p-6">
            {location.pathname === '/' ? (
              <DashboardGrid onViewChange={(view: string, id?: string) => {
                 if (view === 'artist' && id) {
                   void navigate(`/artists/${id}`)
                 } else if (view === 'show' && id) {
                   void navigate(`/shows/${id}`)
                 }
               }} />
            ) : (
              children
            )}
          </div>
        </main>
      </div>
      
      <div style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 9999 }}>
         {React.createElement(Toaster as any)}
       </div>
    </div>
  )
}