import React from 'react'
import { Id } from '../../convex/_generated/dataModel'
import { MagicCard } from './ui/magic-card'
import { MapPin, Calendar, Clock } from 'lucide-react'

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
        className="group cursor-pointer p-0 transition-all duration-300 ease-out active:scale-[0.98] relative overflow-hidden border-0 touch-manipulation"
        gradientColor="#000000"
        gradientOpacity={0}
        gradientSize={0}
      >
        {/* Background Image for Compact */}
        {showArtist && show.artist?.images?.[0] && (
          <div className="absolute inset-0 z-0">
            <img 
              src={show.artist.images[0]} 
              alt={show.artist.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-all duration-500"
            />

          </div>
        )}
        
        <div className="relative z-10 p-4" onClick={handleClick}>
          <div className="flex items-center gap-3">
            {showArtist && show.artist && (
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-accent/20 flex items-center justify-center border border-border">
                {show.artist.images?.[0] ? (
                  <img 
                    src={show.artist.images[0]} 
                    alt={show.artist.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover opacity-90"
                  />
                ) : (
                  <span className="text-foreground font-semibold text-sm">
                    {show.artist.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              {showArtist && show.artist && (
                <h3 className="font-semibold text-foreground text-sm truncate mb-1 group-hover:text-primary transition-colors">
                  {show.artist.name}
                </h3>
              )}
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(show.date)}</span>
                <span>•</span>
                <span className="truncate">{show.venue?.name}</span>
              </div>
            </div>
            
            {isToday && (
              <div className="bg-primary/20 border border-primary/40 text-primary rounded-full px-2 py-1 text-xs font-semibold">
                Tonight
              </div>
            )}
          </div>
        </div>
      </MagicCard>
    )
  }

  return (
    <MagicCard
      className="group cursor-pointer p-0 transition-all duration-300 ease-out hover:scale-[1.01] active:scale-[0.98] relative overflow-hidden border-0 touch-manipulation"
      onClick={handleClick}
      gradientColor="#000000"
      gradientOpacity={0}
      gradientSize={0}
    >
      {/* Enhanced Artist Image Background */}
      {showArtist && show.artist?.images?.[0] && (
        <div className="absolute inset-0 z-0">
          <img 
            src={show.artist.images[0]} 
            alt={show.artist.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-all duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        </div>
      )}
      
      <div className="relative z-10 p-4 sm:p-5 min-h-[200px] flex flex-col" onClick={handleClick}>
        {/* Status Badge - Top Right */}
        {isToday && (
          <div className="absolute top-4 right-4 bg-primary/20 border border-primary/40 text-primary rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            Tonight
          </div>
        )}
        
        {/* Artist Info - Enhanced */}
        <div className="mb-4 flex-1">
          {showArtist && show.artist && (
            <h3 className="font-bold text-white text-lg sm:text-xl mb-2 group-hover:text-primary transition-colors line-clamp-2">
              {show.artist.name}
            </h3>
          )}
          
          {show.venue && (
            <div className="flex items-center gap-2 text-gray-300 text-sm">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate font-medium">{show.venue.name}</span>
            </div>
          )}
        </div>
        
        {/* Event Details - Refined */}
        <div className="flex flex-col gap-2 text-xs text-gray-300 mb-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span className="font-medium">{formatDate(show.date)}</span>
          </div>
          
          {show.time && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span className="font-medium">{formatTime(show.time)}</span>
            </div>
          )}
        </div>
        
        {/* Stats - Clean */}
        {(show.setlistCount !== undefined || (show.voteCount !== undefined && show.voteCount > 0)) && (
          <div className="flex flex-wrap gap-2 text-xs text-gray-300 mb-4">
            {show.setlistCount !== undefined && (
              <span className="bg-white/10 px-2 py-1 rounded-lg font-medium">{show.setlistCount} setlist{show.setlistCount !== 1 ? 's' : ''}</span>
            )}
            
            {show.voteCount !== undefined && show.voteCount > 0 && (
              <span className="bg-white/10 px-2 py-1 rounded-lg font-medium">{show.voteCount} vote{show.voteCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        )}
        
        {/* Single Action Button - Clean */}
        <div className="mt-auto">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClick()
            }}
            className="w-full bg-white/10 hover:bg-primary hover:text-primary-foreground text-white rounded-xl py-2.5 sm:py-3 px-4 text-sm font-semibold transition-all duration-200 group-hover:shadow-lg border border-white/20 hover:border-primary/30"
          >
            View Setlist
          </button>
        </div>
      </div>
    </MagicCard>
  )
}