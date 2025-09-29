import React from 'react'
import { Id } from '../../convex/_generated/dataModel'
import { MagicCard } from './ui/magic-card'
import { BorderBeam } from './ui/border-beam'
import { Users } from 'lucide-react'

interface Artist {
  _id: Id<'artists'>
  name: string
  genres?: string[]
  images?: string[]
  followers?: number
  popularity?: number
  trendingScore?: number
  slug?: string
}

interface ArtistCardProps {
  artist: Artist
  onClick: (artistId: Id<'artists'>, slug?: string) => void
}

export function ArtistCard({ 
  artist, 
  onClick,
  showFollowButton = true,
}: ArtistCardProps & { showFollowButton?: boolean }) {
  const handleClick = () => {
    onClick(artist._id, artist.slug)
  }

  return (
    <div 
      className="group cursor-pointer transition-all duration-300 ease-out active:scale-[0.98] relative overflow-hidden touch-manipulation h-full bg-black"
      onClick={handleClick}
      style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Enhanced Artist Image with Better Visibility */}
      <div className="relative w-full h-32 sm:h-36 lg:h-40 overflow-hidden">
        {artist.images?.[0] ? (
          <img 
            src={artist.images[0]} 
            alt={artist.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <span className="text-white/60 font-bold text-2xl sm:text-3xl">
              {artist.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      <div className="relative z-10 p-3 sm:p-4 min-h-[140px] flex flex-col" onClick={handleClick}>
        {/* Artist Info - Clean Apple Style */}
        <div className="mb-3 flex-1">
          <h3 className="font-semibold text-white text-sm sm:text-base mb-1 group-hover:text-primary transition-colors line-clamp-2">
            {artist.name}
          </h3>
          
          <div className="space-y-1">
            {artist.genres?.[0] && (
              <p className="text-xs text-gray-400 truncate">
                {artist.genres[0]}
              </p>
            )}
            
            {artist.followers && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Users className="h-3 w-3 flex-shrink-0" />
                <span>{(artist.followers / 1000000).toFixed(1)}M followers</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Minimal Action - Apple Style */}
        <div className="flex items-center justify-between mt-auto pt-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick(artist._id, artist.slug)
            }}
            className="text-primary text-sm font-medium hover:text-primary/80 transition-colors"
          >
            View Shows
          </button>
          <div className="text-xs text-gray-500">\u203A</div>
        </div>
      </div>
    </div>
  )
}