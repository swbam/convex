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
  onFollow?: (artistId: Id<'artists'>) => void
  isFollowing?: boolean
  showFollowButton?: boolean
}

export function ArtistCard({ 
  artist, 
  onClick, 
  onFollow, 
  isFollowing = false, 
  showFollowButton = false 
}: ArtistCardProps) {
  const handleClick = () => {
    onClick(artist._id, artist.slug)
  }

  return (
    <MagicCard className="group cursor-pointer p-0 transition-all duration-300 ease-out active:scale-[0.98] relative overflow-hidden border-0 touch-manipulation h-full bg-black" onClick={handleClick} gradientColor="#000000" gradientOpacity={0} gradientSize={0}>
      {/* Halo-style gradient overlay */}

      {/* Enhanced Artist Image with Better Visibility */}
      <div className="relative w-full h-32 sm:h-36 lg:h-40 overflow-hidden">
        {artist.images?.[0] ? (
          <>
            <img 
              src={artist.images[0]} 
              alt={artist.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover opacity-85 group-hover:opacity-95 transition-all duration-500 scale-105 group-hover:scale-110"
            />

          </>
        ) : (
          <div className="w-full h-full bg-accent/20 flex items-center justify-center">
            <span className="text-foreground font-bold text-responsive-xl sm:text-responsive-2xl">
              {artist.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      <div className="relative z-10 p-3 sm:p-4 lg:p-5 min-h-[160px] sm:min-h-[180px] flex flex-col" onClick={handleClick}>
        {/* Artist Info - Enhanced */}
        <div className="mb-3 sm:mb-4 flex-1">
          <h3 className="font-bold text-white text-responsive-base sm:text-responsive-lg mb-1.5 sm:mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {artist.name}
          </h3>
          
          <div className="space-y-1.5 sm:space-y-2">
            {artist.genres?.[0] && (
              <span className="inline-block text-gray-300 text-[10px] sm:text-xs font-medium bg-white/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg">
                {artist.genres[0]}
              </span>
            )}
            
            {artist.followers && (
              <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-400">
                <Users className="h-3 w-3 flex-shrink-0" />
                <span className="font-semibold">{artist.followers.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Single Action Button - Clean */}
        <div className="mt-auto flex gap-1.5 sm:gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick(artist._id, artist.slug)
            }}
            className="flex-1 bg-white/10 hover:bg-primary hover:text-primary-foreground text-white rounded-lg sm:rounded-xl py-2 sm:py-2.5 px-3 sm:px-4 text-responsive-xs sm:text-responsive-sm font-semibold transition-all duration-200 border border-white/20 hover:border-primary/30 touch-target"
          >
            View Profile
          </button>
          
          {showFollowButton && onFollow && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                void onFollow(artist._id)
              }}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-responsive-xs sm:text-responsive-sm font-semibold transition-all duration-200 touch-target ${
                isFollowing 
                  ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30' 
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>
      
      {/* Enhanced border effect */}
      <BorderBeam size={100} duration={10} className="opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
    </MagicCard>
  )
}