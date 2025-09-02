import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';
import { useSpotifyData } from './useSpotifyData';

export function useSpotifyAuth() {
  const { user, isLoaded } = useUser();
  const [isImporting, setIsImporting] = useState(false);
  const [hasImported, setHasImported] = useState(false);
  
  const appUser = useQuery(api.auth.loggedInUser);
  const { importSpotifyArtists } = useSpotifyData();
  
  // Check if user has Spotify connected
  const hasSpotify = user?.externalAccounts?.some(
    account => account.provider === 'oauth_spotify'
  ) || false;
  
  // Check if user has Spotify ID in our DB
  const hasSpotifyInDb = appUser?.appUser?.spotifyId !== undefined;
  
  // Auto-import Spotify artists on first login with Spotify
  useEffect(() => {
    if (!isLoaded || !user || !hasSpotify || hasImported || isImporting) return;
    
    // Check if this is a new Spotify connection
    const spotifyAccount = user.externalAccounts?.find(
      account => account.provider === 'oauth_spotify'
    );
    
    if (spotifyAccount && !hasSpotifyInDb) {
      setIsImporting(true);
      toast.info('🎵 Importing your Spotify artists...');
      
      importSpotifyArtists()
        .then((result) => {
          setHasImported(true);
          toast.success(result.message, {
            duration: 5000,
          });
        })
        .catch((error) => {
          console.error('Failed to import Spotify artists:', error);
          toast.error('Failed to import Spotify artists. Please try again.');
        })
        .finally(() => {
          setIsImporting(false);
        });
    }
  }, [isLoaded, user, hasSpotify, hasSpotifyInDb, hasImported, isImporting, importSpotifyArtists]);
  
  const refreshSpotifyArtists = async () => {
    if (!hasSpotify) {
      toast.error('Please connect your Spotify account first');
      return;
    }
    
    setIsImporting(true);
    toast.info('🎵 Refreshing your Spotify artists...');
    
    try {
      const result = await importSpotifyArtists();
      toast.success(result.message, {
        duration: 5000,
      });
    } catch (error) {
      console.error('Failed to refresh Spotify artists:', error);
      toast.error('Failed to refresh Spotify artists. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };
  
  return {
    hasSpotify,
    isImporting,
    refreshSpotifyArtists,
  };
}