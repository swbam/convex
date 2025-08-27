import React from 'react'
import { Id } from '../../convex/_generated/dataModel'

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

  const handleFollowClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onFollow?.(artist._id)
  }

  const formatFollowers = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

  return (
    <div 
      className="group cursor-pointer bg-card border border-border rounded-xl hover:bg-accent/30 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl p-6"
      onClick={handleClick}
    >
      <div className="flex items-start gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            {artist.images?.[0] ? (
              <img 
                src={artist.images[0]} 
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white font-semibold text-lg">
                {artist.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          
          {artist.trendingScore && artist.trendingScore > 0 && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-background rounded-full animate-pulse" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-xl truncate group-hover:text-gray-300 transition-colors mb-1">
                {artist.name}
              </h3>
              {artist.genres && artist.genres.length > 0 && (
                <p className="text-muted-foreground text-sm truncate">
                  {artist.genres.slice(0, 2).join(', ')}
                  {artist.genres.length > 2 && ` +${artist.genres.length - 2}`}
                </p>
              )}
            </div>
            
            {showFollowButton && (
              <button
                onClick={handleFollowClick}
                className={`ml-4 shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  isFollowing 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'border border-border text-foreground hover:bg-accent hover:border-gray-600'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isFollowing ? 'bg-primary-foreground' : 'bg-primary'}`} />
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            {artist.followers && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                </div>
                <span className="font-medium">{formatFollowers(artist.followers)} followers</span>
              </div>
            )}
            
            {artist.popularity && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-700 flex items-center justify-center">
                  <div className="w-2 h-1 rounded-full bg-gray-400" />
                </div>
                <span className="font-medium">{artist.popularity}% popular</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}