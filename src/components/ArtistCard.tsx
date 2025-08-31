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
    <MagicCard className="group cursor-pointer p-0 transition-all duration-300 ease-out active:scale-[0.98] relative overflow-hidden border-0 touch-manipulation" onClick={handleClick} gradientColor="#000000" gradientOpacity={0} gradientSize={0}>
      {/* Halo-style gradient overlay */}

      {/* Enhanced Artist Image with Better Visibility */}
      <div className="relative w-full h-40 overflow-hidden">
        {artist.images?.[0] ? (
          <>
            <img 
              src={artist.images[0]} 
              alt={artist.name}
              className="w-full h-full object-cover opacity-85 group-hover:opacity-95 transition-all duration-500 scale-105 group-hover:scale-110"
            />

          </>
        ) : (
          <div className="w-full h-full bg-accent/20 flex items-center justify-center">
            <span className="text-foreground font-bold text-2xl">
              {artist.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      <div className="relative z-10 p-5" onClick={handleClick}>
        {/* Artist Info - Enhanced */}
        <div className="mb-4">
          <h3 className="font-bold text-foreground text-lg mb-2 group-hover:text-primary transition-colors truncate">
            {artist.name}
          </h3>
          
          <div className="flex items-center justify-between">
            {artist.genres?.[0] && (
              <span className="text-muted-foreground text-sm font-medium bg-accent/30 px-2 py-1 rounded-lg">
                {artist.genres[0]}
              </span>
            )}
            
            {artist.followers && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                <span className="font-semibold">{artist.followers.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Single Action Button - Clean */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick(artist._id, artist.slug)
            }}
            className="flex-1 bg-accent hover:bg-primary hover:text-primary-foreground text-foreground rounded-xl py-2.5 px-4 text-sm font-semibold transition-all duration-200 group-hover:shadow-lg"
          >
            View Profile
          </button>
          
          {showFollowButton && onFollow && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                void onFollow(artist._id)
              }}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isFollowing 
                  ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30' 
                  : 'bg-accent hover:bg-accent/80 text-foreground'
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