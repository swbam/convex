import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';
import { useSpotifyData } from './useSpotifyData';

export function useSpotifyAuth() {
  const { user, isLoaded } = useUser();
  const [isImporting, setIsImporting] = useState(false);
  const attemptedUser = useRef<string | null>(null);
  
  const appUser = useQuery(api.auth.loggedInUser);
  const { importSpotifyArtists } = useSpotifyData();
  
  // Check if user has Spotify connected
  const hasSpotify = user?.externalAccounts?.some(
    account => ['spotify', 'oauth_spotify'].includes(account.provider)
  ) || false;
  
  // Check if user has Spotify ID in our DB
  const hasSpotifyInDb = appUser?.appUser?.spotifyId !== undefined;
  
  // Auto-import Spotify artists on first login with Spotify
  useEffect(() => {
    if (!user) { attemptedUser.current = null; return; }
    if (!isLoaded || !appUser?.appUser || !hasSpotify || attemptedUser.current === user.id || isImporting) return;
    
    // Check if this is a new Spotify connection
    const spotifyAccount = user.externalAccounts?.find(
      account => ['spotify', 'oauth_spotify'].includes(account.provider)
    );
    
    if (spotifyAccount && !hasSpotifyInDb) {
      attemptedUser.current = user.id;
      setIsImporting(true);
      toast.info('🎵 Importing your Spotify artists...');
      
      importSpotifyArtists()
        .then((result) => {
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
  }, [isLoaded, user, hasSpotify, hasSpotifyInDb, appUser, isImporting, importSpotifyArtists]);
  
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
