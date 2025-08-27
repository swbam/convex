import React from 'react'
import { Id } from '../../convex/_generated/dataModel'

interface Show {
  _id: Id<'shows'>
  artistId: Id<'artists'>
  venueId: Id<'venues'>
  date: string
  time?: string
  status: 'upcoming' | 'completed' | 'cancelled'
  ticketmasterUrl?: string
  artist?: {
    name: string
    images?: string[]
  }
  venue?: {
    name: string
    city: string
    state: string
    country: string
  }
  setlistCount?: number
  voteCount?: number
}

interface ShowCardProps {
  show: Show
  onClick: (showId: Id<'shows'>) => void
  showArtist?: boolean
  compact?: boolean
}

export function ShowCard({ 
  show, 
  onClick, 
  showArtist = true, 
  compact = false 
}: ShowCardProps) {
  const handleClick = () => {
    onClick(show._id)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (timeString?: string) => {
    if (!timeString) return null
    try {
      const time = new Date(`2000-01-01T${timeString}`)
      return time.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return timeString
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    }
  }

  if (compact) {
    return (
      <div 
        className="group cursor-pointer bg-zinc-900/50 border border-zinc-800 rounded-lg hover:bg-zinc-800/50 transition-all duration-200 p-3"
        onClick={handleClick}
      >
        <div className="flex items-center gap-3">
          {showArtist && show.artist && (
            <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-700 flex items-center justify-center">
              {show.artist.images?.[0] ? (
                <img 
                  src={show.artist.images[0]} 
                  alt={show.artist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-sm font-medium">
                  {show.artist.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            {showArtist && show.artist && (
              <p className="font-medium text-white text-sm truncate group-hover:text-zinc-300 transition-colors">
                {show.artist.name}
              </p>
            )}
            
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>📅</span>
              <span>{formatDate(show.date)}</span>
              
              {show.venue && (
                <>
                  <span>•</span>
                  <span>📍</span>
                  <span className="truncate">{show.venue.name}</span>
                </>
              )}
            </div>
          </div>
          
          <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(show.status)}`}>
            {show.status}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="group cursor-pointer bg-zinc-900/50 border border-zinc-800 rounded-lg hover:bg-zinc-800/50 transition-all duration-200 hover:scale-[1.01]"
      onClick={handleClick}
    >
      <div className="p-6 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {showArtist && show.artist && (
              <div className="w-12 h-12 rounded-full ring-2 ring-zinc-700 group-hover:ring-zinc-600 transition-colors overflow-hidden bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                {show.artist.images?.[0] ? (
                  <img 
                    src={show.artist.images[0]} 
                    alt={show.artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-medium">
                    {show.artist.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            )}
            
            <div>
              {showArtist && show.artist && (
                <h3 className="font-semibold text-white text-lg group-hover:text-zinc-300 transition-colors">
                  {show.artist.name}
                </h3>
              )}
              
              {show.venue && (
                <p className="text-zinc-400 text-sm">
                  {show.venue.name} • {show.venue.city}, {show.venue.state}
                </p>
              )}
            </div>
          </div>
          
          <span className={`px-2 py-1 rounded border text-sm ${getStatusColor(show.status)}`}>
            {show.status}
          </span>
        </div>
      </div>
      
      <div className="px-6 pb-6">
        <div className="flex items-center gap-4 text-sm text-zinc-400 mb-4">
          <div className="flex items-center gap-1">
            <span>📅</span>
            <span>{formatDate(show.date)}</span>
          </div>
          
          {show.time && (
            <div className="flex items-center gap-1">
              <span>🕒</span>
              <span>{formatTime(show.time)}</span>
            </div>
          )}
          
          {show.venue && (
            <div className="flex items-center gap-1">
              <span>📍</span>
              <span className="truncate">{show.venue.city}, {show.venue.state}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            {show.setlistCount !== undefined && (
              <div className="flex items-center gap-1">
                <span>🎵</span>
                <span>{show.setlistCount} setlist{show.setlistCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            
            {show.voteCount !== undefined && show.voteCount > 0 && (
              <div className="flex items-center gap-1">
                <span>⭐</span>
                <span>{show.voteCount} vote{show.voteCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          
          {show.ticketmasterUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.open(show.ticketmasterUrl, '_blank')
              }}
              className="border border-zinc-600 text-zinc-300 hover:border-zinc-500 hover:text-zinc-200 px-3 py-1 rounded text-sm font-medium transition-colors bg-transparent"
            >
              Tickets
            </button>
          )}
        </div>
      </div>
    </div>
  )
}