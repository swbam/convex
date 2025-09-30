import React from 'react';
import { motion } from 'framer-motion';
import { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { useMutation } from "convex/react";
import { Button } from "./ui/button";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Card } from "./ui/Card"; // New shared

interface ArtistCardProps {
  artist: any;
  onClick: (artistId: Id<'artists'>, slug?: string) => void;
  showFollowButton?: boolean;
}

export function ArtistCard({ 
  artist, 
  onClick,
  showFollowButton = true,
}: ArtistCardProps & { showFollowButton?: boolean }) {
  const followArtist = useMutation(api.artists.followArtist);
  const isFollowing = artist.isFollowing;

  const handleClick = () => {
    onClick(artist._id, artist.slug);
  };

  const handleFollow = async () => {
    try {
      await followArtist({ artistId: artist._id });
      toast.success(isFollowing ? "Unfollowed" : "Following");
    } catch (error) {
      toast.error("Failed to update follow");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        variant="artist"
        onClick={handleClick}
        imageSrc={artist.images?.[0]}
        title={artist.name}
        subtitle={artist.genres?.[0]}
      >
        <p className="text-gray-400 text-sm">{artist.upcomingShowsCount || 0} shows</p>
        {showFollowButton && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => { e.stopPropagation(); handleFollow(); }}
            className="mt-2 p-1 h-auto self-end"
          >
            <Heart className={`h-4 w-4 ${isFollowing ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
        )}
      </Card>
    </motion.div>
  );
}

const ArtistCardMemo = React.memo(ArtistCard);

export { ArtistCardMemo as ArtistCard };