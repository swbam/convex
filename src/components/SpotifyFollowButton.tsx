import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Button } from './ui/button';
import { Heart, Plus, Check, Loader2, Music } from 'lucide-react';
import { toast } from 'sonner';

interface SpotifyFollowButtonProps {
  artistId: Id<"artists">;
  artistName: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function SpotifyFollowButton({ 
  artistId, 
  artistName, 
  variant = 'outline',
  size = 'default',
  showIcon = true,
  className = ''
}: SpotifyFollowButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Check if user is a Spotify user
  const isSpotifyUser = useQuery(api.spotifyFollowing.isSpotifyUser);
  
  // Check follow status (only for Spotify users)
  const followStatus = useQuery(
    api.spotifyFollowing.getFollowStatus, 
    isSpotifyUser ? { artistIds: [artistId] } : 'skip'
  );
  const isFollowing = followStatus?.[artistId] || false;
  
  // Mutation to toggle follow
  const toggleFollow = useMutation(api.spotifyFollowing.toggleArtistFollow);
  
  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click events
    
    if (!isSpotifyUser) {
      toast.error('Sign in with Spotify to follow artists', {
        description: 'Artist following is available for Spotify users only',
        duration: 4000,
        icon: '🎵',
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await toggleFollow({ artistId });
      toast.success(result.message, {
        duration: 2000,
        icon: result.isFollowing ? '❤️' : '💔',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update follow status';
      
      if (errorMessage.includes('Spotify authentication required')) {
        toast.error('Spotify Required', {
          description: 'Please sign in with Spotify to follow artists',
          duration: 4000,
          icon: '🎵',
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show button for non-Spotify users
  if (isSpotifyUser === false) {
    return null;
  }

  if (isSpotifyUser === undefined || followStatus === undefined) {
    return (
      <Button 
        variant={variant} 
        size={size}
        disabled
        className={className}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant={isFollowing ? 'default' : variant}
      size={size}
      onClick={handleToggleFollow}
      disabled={isLoading}
      className={`transition-all duration-200 ${className} ${
        isFollowing 
          ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
          : 'hover:bg-green-50 hover:text-green-600 hover:border-green-600 dark:hover:bg-green-900/20'
      }`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : showIcon ? (
        isFollowing ? (
          <Check className="h-4 w-4 mr-2" />
        ) : (
          <Plus className="h-4 w-4 mr-2" />
        )
      ) : null}
      
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
}

// Compact heart-style follow button for Spotify users
export function SpotifyHeartFollowButton({ 
  artistId, 
  artistName,
  className = ''
}: Omit<SpotifyFollowButtonProps, 'variant' | 'size' | 'showIcon'>) {
  const [isLoading, setIsLoading] = useState(false);
  
  const isSpotifyUser = useQuery(api.spotifyFollowing.isSpotifyUser);
  const followStatus = useQuery(
    api.spotifyFollowing.getFollowStatus,
    isSpotifyUser ? { artistIds: [artistId] } : 'skip'
  );
  const isFollowing = followStatus?.[artistId] || false;
  
  const toggleFollow = useMutation(api.spotifyFollowing.toggleArtistFollow);
  
  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isSpotifyUser) {
      toast.error('Sign in with Spotify to follow artists', {
        description: 'Artist following is available for Spotify users only',
        duration: 4000,
        icon: '🎵',
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await toggleFollow({ artistId });
      toast.success(result.message, {
        duration: 2000,
        icon: result.isFollowing ? '❤️' : '💔',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update follow status';
      
      if (errorMessage.includes('Spotify authentication required')) {
        toast.error('Spotify Required', {
          description: 'Please sign in with Spotify to follow artists',
          duration: 4000,
          icon: '🎵',
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show for non-Spotify users
  if (isSpotifyUser === false) {
    return null;
  }

  if (isSpotifyUser === undefined || followStatus === undefined) {
    return (
      <div className={`w-8 h-8 flex items-center justify-center ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <button
      onClick={handleToggleFollow}
      disabled={isLoading}
      className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/10 ${className}`}
      title={isFollowing ? `Unfollow ${artistName}` : `Follow ${artistName} (Spotify)`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      ) : (
        <Heart 
          className={`h-5 w-5 transition-all duration-200 ${
            isFollowing 
              ? 'text-green-500 fill-green-500' 
              : 'text-gray-400 hover:text-green-500'
          }`} 
        />
      )}
    </button>
  );
}

// Spotify indicator for non-Spotify users
export function SpotifyRequiredButton({
  className = '',
  size = 'default'
}: {
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}) {
  const handleClick = () => {
    toast.info('Spotify Required', {
      description: 'Sign in with Spotify to follow your favorite artists',
      duration: 4000,
      icon: '🎵',
    });
  };

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleClick}
      className={`border-dashed opacity-60 hover:opacity-80 ${className}`}
    >
      <Music className="h-4 w-4 mr-2" />
      Spotify Only
    </Button>
  );
}