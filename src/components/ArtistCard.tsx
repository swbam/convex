import React from 'react';
import { motion } from 'framer-motion';
import { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { useMutation } from "convex/react";
import { Heart, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface ArtistCardProps {
  artist: any;
  onClick: (artistId: Id<'artists'>, slug?: string) => void;
  showFollowButton?: boolean;
}

function ArtistCardComponent({ 
  artist, 
  onClick,
  showFollowButton = true,
}: ArtistCardProps) {
  const followArtist = useMutation(api.artists.followArtist);
  const isFollowing = artist.isFollowing;

  const handleClick = () => {
    onClick(artist._id, artist.slug);
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await followArtist({ artistId: artist._id });
      toast.success(isFollowing ? "Unfollowed" : "Following");
    } catch (error) {
      toast.error("Failed to update follow");
    }
  };

  return (
    <motion.div
      onClick={handleClick}
      whileTap={{ scale: 0.98 }}
      className="group relative overflow-hidden touch-manipulation bg-card border-b border-white/5 last:border-b-0 sm:border sm:border-white/10 sm:rounded-xl cursor-pointer active:bg-white/5 transition-all duration-150"
    >
      <div className="flex items-center gap-3 p-3 sm:p-4 min-h-[72px]">
        {/* Artist Image - Compact Circle */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-white/5 ring-1 ring-white/10">
            {artist.images?.[0] ? (
              <img 
                src={artist.images[0]} 
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40 text-xl font-bold">
                {artist.name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Content - Compact Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-base leading-tight line-clamp-1 mb-0.5">
            {artist.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {artist.genres?.[0] && (
              <span className="line-clamp-1">{artist.genres[0]}</span>
            )}
            {artist.genres?.[0] && artist.upcomingShowsCount > 0 && (
              <span className="text-white/20">•</span>
            )}
            {artist.upcomingShowsCount > 0 && (
              <span className="font-medium text-white/60">
                {artist.upcomingShowsCount} {artist.upcomingShowsCount === 1 ? 'show' : 'shows'}
              </span>
            )}
          </div>
        </div>

        {/* Actions - Compact Right Side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {showFollowButton && (
            <button
              onClick={handleFollow}
              className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors touch-manipulation"
              aria-label={isFollowing ? "Unfollow" : "Follow"}
            >
              <Heart 
                className={`h-5 w-5 transition-colors ${
                  isFollowing 
                    ? 'fill-red-500 text-red-500' 
                    : 'text-gray-400 hover:text-white'
                }`} 
              />
            </button>
          )}
          <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}

export const ArtistCard = React.memo(ArtistCardComponent);
