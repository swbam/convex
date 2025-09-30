import React from 'react'
import { motion } from 'framer-motion'
import { Id } from '../../convex/_generated/dataModel'
import { MagicCard } from './ui/magic-card'
import { MapPin, Calendar, Clock } from 'lucide-react'

interface Show {
  _id: Id<'shows'>
  artistId: Id<'artists'>
  venueId: Id<'venues'>
  date: string
  startTime?: string
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
    if (isNaN(date.getTime())) return 'Date TBA'
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (timeString?: string) => {
    if (!timeString) return null
    const base = timeString.length >= 5 ? timeString.slice(0, 5) : timeString
    const time = new Date(`2000-01-01T${base}`)
    if (isNaN(time.getTime())) return base
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const isToday = new Date(show.date).toDateString() === new Date().toDateString()

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ x: 4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      className="group cursor-pointer relative overflow-hidden touch-manipulation bg-black py-3 min-h-[44px]"
      onClick={handleClick}
      style={{
        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
      }}
    >
        <div className="relative z-10" onClick={handleClick}>
          <div className="flex items-center gap-2.5 sm:gap-3">
            {showArtist && show.artist && (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center flex-shrink-0">
                {show.artist.images?.[0] ? (
                  <img 
                    src={show.artist.images[0]} 
                    alt={show.artist.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover opacity-90"
                  />
                ) : (
                  <span className="text-white/60 font-semibold text-xs sm:text-sm">
                    {show.artist.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              {showArtist && show.artist && (
                <h3 className="font-medium text-white text-sm truncate mb-0.5 group-hover:text-primary transition-colors">
                  {show.artist.name}
                </h3>
              )}
              
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span className="whitespace-nowrap">{formatDate(show.date)}</span>
                <span className="hidden sm:inline">•</span>
                <span className="truncate hidden sm:inline">{show.venue?.name}</span>
              </div>
              {show.venue && (
                <div className="sm:hidden text-xs text-gray-500 truncate mt-0.5">
                  {show.venue.name}
                </div>
              )}
            </div>
            
            {isToday && (
              <div className="bg-primary/10 text-primary rounded-full px-2 py-1 text-xs font-medium flex-shrink-0">
                Tonight
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ scale: 1.02, y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      className="group cursor-pointer relative overflow-hidden touch-manipulation h-full bg-black rounded-2xl"
      onClick={handleClick}
      style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Enhanced Artist Image at Top */}
      {showArtist && show.artist?.images?.[0] && (
        <div className="relative w-full h-40 overflow-hidden">
          <img 
            src={show.artist.images[0]} 
            alt={show.artist.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover opacity-85"
          />
        </div>
      )}
      
      <div className="relative z-10 p-3 sm:p-4 min-h-[160px] flex flex-col" onClick={handleClick}>
        {/* Status Badge - Subtle */}
        {isToday && (
          <div className="absolute top-3 right-3 bg-primary/10 text-primary rounded-full px-2 py-1 text-xs font-medium">
            Tonight
          </div>
        )}
        
        {/* Show Info - Clean Apple Style */}
        <div className="mb-3 flex-1">
          {showArtist && show.artist && (
            <h3 className="font-semibold text-white text-sm sm:text-base mb-1 group-hover:text-primary transition-colors line-clamp-2">
              {show.artist.name}
            </h3>
          )}
          
          {show.venue && (
            <p className="text-xs text-gray-400 truncate mb-2">
              {show.venue.name}
            </p>
          )}
          
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>{formatDate(show.date)}</span>
            </div>
            
            {show.startTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>{formatTime(show.startTime)}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Minimal Action - Apple Style */}
        <div className="flex items-center justify-between mt-auto pt-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClick()
            }}
            className="text-primary text-sm font-medium hover:text-primary/80 transition-colors"
          >
            View Setlist
          </button>
          <div className="text-xs text-gray-500">›</div>
        </div>
      </div>
    </motion.div>
  )
}