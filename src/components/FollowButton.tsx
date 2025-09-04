import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Button } from './ui/button';
import { Heart, Plus, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FollowButtonProps {
  artistId: Id<"artists">;
  artistName: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function FollowButton({ 
  artistId, 
  artistName, 
  variant = 'outline',
  size = 'default',
  showIcon = true,
  className = ''
}: FollowButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Check follow status
  const followStatus = useQuery(api.social.getFollowStatus, { artistIds: [artistId] });
  const isFollowing = followStatus?.[artistId] || false;
  
  // Mutation to toggle follow
  const toggleFollow = useMutation(api.social.toggleArtistFollow);
  
  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click events
    
    setIsLoading(true);
    try {
      const result = await toggleFollow({ artistId });
      toast.success(result.message, {
        duration: 2000,
        icon: result.isFollowing ? '❤️' : '💔',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update follow status');
    } finally {
      setIsLoading(false);
    }
  };

  if (followStatus === undefined) {
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
          ? 'bg-primary hover:bg-primary/80 text-primary-foreground' 
          : 'hover:bg-primary/10 hover:text-primary hover:border-primary'
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

// Compact heart-style follow button
export function HeartFollowButton({ 
  artistId, 
  artistName,
  className = ''
}: Omit<FollowButtonProps, 'variant' | 'size' | 'showIcon'>) {
  const [isLoading, setIsLoading] = useState(false);
  
  const followStatus = useQuery(api.social.getFollowStatus, { artistIds: [artistId] });
  const isFollowing = followStatus?.[artistId] || false;
  
  const toggleFollow = useMutation(api.social.toggleArtistFollow);
  
  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    setIsLoading(true);
    try {
      const result = await toggleFollow({ artistId });
      toast.success(result.message, {
        duration: 2000,
        icon: result.isFollowing ? '❤️' : '💔',
      });
    } catch (error) {
      toast.error('Failed to update follow status');
    } finally {
      setIsLoading(false);
    }
  };

  if (followStatus === undefined) {
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
      title={isFollowing ? `Unfollow ${artistName}` : `Follow ${artistName}`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      ) : (
        <Heart 
          className={`h-5 w-5 transition-all duration-200 ${
            isFollowing 
              ? 'text-red-500 fill-red-500' 
              : 'text-gray-400 hover:text-red-500'
          }`} 
        />
      )}
    </button>
  );
}