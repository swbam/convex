import React from 'react'
import { Id } from '../../convex/_generated/dataModel'
import { MagicCard } from './ui/magic-card'

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
    <MagicCard
      className="cursor-pointer p-0 transition-all duration-200 hover:scale-[1.01]"
      gradientColor="#1a1a1a"
      gradientOpacity={0.1}
    >
      <div className="p-4" onClick={handleClick}>
        <div className="flex items-center gap-3">
          {/* Artist Avatar - Smaller & More Refined */}
          <div className="relative flex-shrink-0">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              {artist.images?.[0] ? (
                <img 
                  src={artist.images[0]} 
                  alt={artist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-medium text-sm">
                  {artist.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
          </div>
          
          {/* Artist Info - Refined Typography */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-base truncate mb-1">
                  {artist.name}
                </h3>
                {artist.genres && artist.genres.length > 0 && (
                  <p className="text-muted-foreground text-xs truncate">
                    {artist.genres.slice(0, 2).join(' • ')}
                  </p>
                )}
              </div>
              
              {showFollowButton && (
                <button
                  onClick={handleFollowClick}
                  className={`ml-3 shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isFollowing 
                      ? 'bg-white text-black hover:bg-gray-200' 
                      : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            
            {/* Stats - Refined & Minimal */}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {artist.followers && (
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-zinc-600" />
                  <span>{formatFollowers(artist.followers)}</span>
                </div>
              )}
              
              {artist.popularity && (
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-zinc-600" />
                  <span>{artist.popularity}%</span>
                </div>
              )}
              
              {artist.trendingScore && artist.trendingScore > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-white" />
                  <span className="text-white font-medium">Trending</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MagicCard>
  )
}