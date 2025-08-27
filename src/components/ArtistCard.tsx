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

  return (
    <div 
      className="group cursor-pointer bg-zinc-900/50 border border-zinc-800 rounded-lg hover:bg-zinc-800/50 transition-all duration-200 hover:scale-[1.02] p-4"
      onClick={handleClick}
    >
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full ring-2 ring-zinc-700 group-hover:ring-zinc-600 transition-colors overflow-hidden bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
          {artist.images?.[0] ? (
            <img 
              src={artist.images[0]} 
              alt={artist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white font-semibold text-sm">
              {artist.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-white text-lg truncate group-hover:text-zinc-300 transition-colors">
              {artist.name}
            </h3>
            {showFollowButton && (
              <button
                onClick={handleFollowClick}
                className={`ml-2 shrink-0 px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                  isFollowing 
                    ? 'bg-zinc-600 hover:bg-zinc-700 text-white border border-zinc-600' 
                    : 'border border-zinc-600 text-zinc-300 hover:border-zinc-500 hover:text-zinc-200 bg-transparent'
                }`}
              >
                <span className={`text-xs ${isFollowing ? '❤️' : '🤍'}`}></span>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
          
          {artist.genres && artist.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {artist.genres.slice(0, 3).map((genre) => (
                <span 
                  key={genre} 
                  className="text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 px-2 py-1 rounded"
                >
                  {genre}
                </span>
              ))}
              {artist.genres.length > 3 && (
                <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded">
                  +{artist.genres.length - 3}
                </span>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            {artist.followers && (
              <div className="flex items-center gap-1">
                <span>👥</span>
                <span>{artist.followers.toLocaleString()}</span>
              </div>
            )}
            
            {artist.popularity && (
              <div className="flex items-center gap-1">
                <span>🎵</span>
                <span>{artist.popularity}% popular</span>
              </div>
            )}
            
            {artist.trendingScore && artist.trendingScore > 0 && (
              <span className="bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/30 px-2 py-1 rounded text-xs">
                🔥 Trending
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}