import React from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { ArtistCard } from './ArtistCard'
import { ShowCard } from './ShowCard'
import { Id } from '../../convex/_generated/dataModel'

interface DashboardGridProps {
  onViewChange: (view: string, id?: Id<'artists'> | Id<'shows'>, slug?: string) => void
}

// Type for enriched show data from Convex queries
type EnrichedShow = {
  _id: Id<'shows'>
  artistId: Id<'artists'>
  venueId: Id<'venues'>
  date: string
  startTime?: string
  status: 'upcoming' | 'completed' | 'cancelled'
  ticketmasterId?: string
  ticketUrl?: string
  artist: {
    _id: Id<'artists'>
    name: string
    images?: string[]
    genres?: string[]
    followers?: number
    popularity?: number
  } | null
  venue: {
    _id: Id<'venues'>
    name: string
    city: string
    state: string
    country: string
  } | null
}

export function DashboardGrid({ onViewChange }: DashboardGridProps) {
  const stats = useQuery(api.dashboard.getStats)
  const trendingArtists = useQuery(api.artists.getTrending, { limit: 6 })
  const upcomingShows = useQuery(api.shows.getUpcoming, { limit: 6 })
  const recentShows = useQuery(api.shows.getRecent, { limit: 4 })

  const handleArtistClick = (artistId: Id<'artists'>, slug?: string) => {
    onViewChange('artist', artistId, slug)
  }

  const handleShowClick = (showId: Id<'shows'>, slug?: string) => {
    onViewChange('show', showId, slug)
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-zinc-800/50 via-zinc-700/30 to-transparent border border-zinc-700 p-8">
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome to TheSet
          </h1>
          <p className="text-xl text-zinc-300 mb-6">
            Discover, predict, and vote on concert setlists from your favorite artists
          </p>
          <div className="flex items-center gap-4">
            <button 
              className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              onClick={() => onViewChange('search')}
            >
              🎵 Explore Artists
            </button>
            <button 
              className="px-6 py-3 border border-zinc-600 text-zinc-300 hover:bg-zinc-800 rounded-lg font-medium transition-colors flex items-center gap-2"
              onClick={() => onViewChange('shows')}
            >
              📅 Browse Shows
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-zinc-500/10 rounded-full blur-2xl" />
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-700/50 rounded-lg">
                <span className="text-zinc-300">🎵</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.totalArtists.toLocaleString()}
                </p>
                <p className="text-sm text-zinc-400">Artists</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-700/50 rounded-lg">
                <span className="text-zinc-300">📅</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.totalShows.toLocaleString()}
                </p>
                <p className="text-sm text-zinc-400">Shows</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-700/50 rounded-lg">
                <span className="text-zinc-300">⭐</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.totalSetlists.toLocaleString()}
                </p>
                <p className="text-sm text-zinc-400">Setlists</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-700/50 rounded-lg">
                <span className="text-zinc-300">👥</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.activeUsers.toLocaleString()}
                </p>
                <p className="text-sm text-zinc-400">Users</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trending Artists */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-white text-lg font-semibold">
                  🔥 Trending Artists
                </h3>
                <button 
                  onClick={() => onViewChange('artists')}
                  className="text-zinc-400 hover:text-white text-sm flex items-center gap-1 bg-transparent border-none cursor-pointer"
                >
                  View All →
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trendingArtists?.slice(0, 4).map((artist) => (
                  <ArtistCard
                    key={artist._id}
                    artist={artist}
                    onClick={handleArtistClick}
                    showFollowButton={false}
                  />
                )) || (
                  <div className="col-span-2 text-center text-zinc-400 py-8">
                    Loading trending artists...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Shows */}
        <div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg">
            <div className="p-6 border-b border-zinc-800">
              <h3 className="flex items-center gap-2 text-white text-lg font-semibold">
                🕒 Recent Shows
              </h3>
            </div>
            <div className="p-6">
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-3">
                  {recentShows?.map((show, index) => (
                    <div key={show._id}>
                      <ShowCard
                        show={show as any}
                        onClick={handleShowClick}
                        compact={true}
                      />
                      {index < (recentShows.length - 1) && (
                        <div className="bg-zinc-800 my-3 h-px" />
                      )}
                    </div>
                  )) || (
                    <div className="text-center text-zinc-400 py-8">
                      Loading recent shows...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Shows */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-white text-lg font-semibold">
              📅 Upcoming Shows
            </h3>
            <button 
              onClick={() => onViewChange('shows')}
              className="text-zinc-400 hover:text-white text-sm flex items-center gap-1 bg-transparent border-none cursor-pointer"
            >
              View All →
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingShows?.slice(0, 6).map((show) => (
              <ShowCard
                key={show._id}
                show={show as any}
                onClick={handleShowClick}
                compact={false}
              />
            )) || (
              <div className="col-span-full text-center text-zinc-400 py-8">
                Loading upcoming shows...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}