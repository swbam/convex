import React from 'react'
import { Id } from '../../convex/_generated/dataModel'
import { MagicCard } from './ui/magic-card'

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
    state?: string
    country: string
  }
  setlistCount?: number
  voteCount?: number
  slug?: string
}

interface ShowCardProps {
  show: Show
  onClick: (showId: Id<'shows'>, slug?: string) => void
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
    onClick(show._id, show.slug)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
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

  const isToday = new Date(show.date).toDateString() === new Date().toDateString()

  if (compact) {
    return (
      <MagicCard
        className="cursor-pointer p-0 transition-all duration-200"
        gradientColor="#0a0a0a"
        gradientOpacity={0.05}
      >
        <div className="p-3" onClick={handleClick}>
          <div className="flex items-center gap-3">
            {showArtist && show.artist && (
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center">
                {show.artist.images?.[0] ? (
                  <img 
                    src={show.artist.images[0]} 
                    alt={show.artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-xs font-medium">
                    {show.artist.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              {showArtist && show.artist && (
                <p className="font-medium text-white text-sm truncate">
                  {show.artist.name}
                </p>
              )}
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(show.date)}</span>
                {show.venue && (
                  <>
                    <span>•</span>
                    <span className="truncate">{show.venue.name}</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <div className={`text-xs px-2 py-1 rounded border ${
                isToday ? 'border-white text-white' : 'border-zinc-700 text-zinc-400'
              }`}>
                {isToday ? 'Today' : show.status}
              </div>
            </div>
          </div>
        </div>
      </MagicCard>
    )
  }

  return (
    <MagicCard
      className="cursor-pointer p-0 transition-all duration-200 hover:scale-[1.01]"
      gradientColor="#1a1a1a"
      gradientOpacity={0.1}
    >
      <div className="p-4" onClick={handleClick}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {showArtist && show.artist && (
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-800 flex items-center justify-center">
                {show.artist.images?.[0] ? (
                  <img 
                    src={show.artist.images[0]} 
                    alt={show.artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-medium text-sm">
                    {show.artist.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              {showArtist && show.artist && (
                <h3 className="font-semibold text-white text-base truncate mb-1">
                  {show.artist.name}
                </h3>
              )}
              
              {show.venue && (
                <p className="text-muted-foreground text-sm truncate">
                  {show.venue.name}
                </p>
              )}
            </div>
          </div>
          
          <div className={`text-xs px-2 py-1 rounded border ${
            isToday ? 'border-white text-white' : 'border-zinc-700 text-zinc-400'
          }`}>
            {isToday ? 'Today' : show.status}
          </div>
        </div>
        
        {/* Event Details - Refined */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-zinc-600" />
            <span>{formatDate(show.date)}</span>
          </div>
          
          {show.time && (
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-zinc-600" />
              <span>{formatTime(show.time)}</span>
            </div>
          )}
          
          {show.venue && (
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-zinc-600" />
              <span className="truncate">{show.venue.city}</span>
            </div>
          )}
        </div>
        
        {/* Actions - Refined */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {show.setlistCount !== undefined && (
              <span>{show.setlistCount} setlist{show.setlistCount !== 1 ? 's' : ''}</span>
            )}
            
            {show.voteCount !== undefined && show.voteCount > 0 && (
              <span>{show.voteCount} vote{show.voteCount !== 1 ? 's' : ''}</span>
            )}
          </div>
          
          {show.ticketmasterUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.open(show.ticketmasterUrl, '_blank')
              }}
              className="border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white px-2 py-1 rounded text-xs font-medium transition-colors bg-transparent"
            >
              Tickets
            </button>
          )}
        </div>
      </div>
    </MagicCard>
  )
}