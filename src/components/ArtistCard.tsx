import React from 'react';
import { motion } from 'framer-motion';
import { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { useMutation } from "convex/react";
import { Heart, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { formatCompactNumber } from "../lib/format";

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

  const metaParts: string[] = [];
  if (artist.genres?.[0]) {
    metaParts.push(artist.genres[0]);
  }
  if (artist.upcomingShowsCount > 0) {
    metaParts.push(`${artist.upcomingShowsCount} ${artist.upcomingShowsCount === 1 ? 'show' : 'shows'}`);
  }
  if (typeof artist.followers === 'number' && artist.followers > 0) {
    metaParts.push(`${formatCompactNumber(artist.followers)} fans`);
  }

  return (
    <motion.article
      className={cn(
        "group relative overflow-hidden touch-manipulation cursor-pointer transition-all duration-200",
        // Keyboard focus
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-none sm:rounded-xl",
        // Mobile: simple border bottom for list feel
        "border-b border-border last:border-b-0",
        // Desktop: shared panel styling
        "interactive-row sm:glow-card-sm"
      )}
    >
      <div className="flex items-center gap-3 px-0 py-3 sm:p-4 min-h-[72px]">
        {/* Artist Image - Compact Circle */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-secondary ring-1 ring-border transition-colors group-hover:ring-primary/40">
            {artist.images?.[0] ? (
              <img
                src={artist.images[0]}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-foreground/40 text-xl font-bold">
                {artist.name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Content - Compact Info */}
        <a href={`/artists/${encodeURIComponent(artist.slug || artist._id)}`} onClick={(event) => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); handleClick(); } }} className="flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <h3 className="text-foreground font-semibold text-base leading-tight line-clamp-1 mb-0.5">
            {artist.name}
          </h3>
          {metaParts.length > 0 && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {metaParts.join(' · ')}
            </p>
          )}
        </a>

        {/* Actions - Compact Right Side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {showFollowButton && (
            <button
              onClick={handleFollow}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary active:bg-secondary/80 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={isFollowing ? "Unfollow" : "Follow"}
            >
              <Heart
                className={`h-5 w-5 transition-colors ${
                  isFollowing
                    ? 'fill-red-500 text-red-500'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              />
            </button>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground transition-colors" />
        </div>
      </div>
    </motion.article>
  );
}

export const ArtistCard = React.memo(ArtistCardComponent);
