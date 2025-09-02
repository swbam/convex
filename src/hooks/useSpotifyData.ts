import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string }[];
  followers: { total: number };
  popularity: number;
}

export function useSpotifyData() {
  const { user } = useUser();
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  
  const importArtists = useAction(api.spotifyAuth.importUserSpotifyArtistsWithToken);
  
  useEffect(() => {
    async function getSpotifyToken() {
      if (!user) return;
      
      const spotifyAccount = user.externalAccounts?.find(
        account => account.provider === 'oauth_spotify'
      );
      
      if (!spotifyAccount) return;
      
      setIsLoadingToken(true);
      try {
        // Get OAuth access token from Clerk
        const token = await user.getToken('oauth_spotify');
        setSpotifyToken(token);
      } catch (error) {
        console.error('Failed to get Spotify token:', error);
      } finally {
        setIsLoadingToken(false);
      }
    }
    
    getSpotifyToken();
  }, [user]);
  
  const fetchSpotifyArtists = async () => {
    if (!spotifyToken) throw new Error('No Spotify token available');
    
    // Fetch both followed artists and top artists
    const [followedResponse, topArtistsResponse] = await Promise.all([
      fetch('https://api.spotify.com/v1/me/following?type=artist&limit=50', {
        headers: { Authorization: `Bearer ${spotifyToken}` },
      }),
      fetch('https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=50', {
        headers: { Authorization: `Bearer ${spotifyToken}` },
      }),
    ]);
    
    if (!followedResponse.ok || !topArtistsResponse.ok) {
      throw new Error('Failed to fetch Spotify data');
    }
    
    const followedData = await followedResponse.json();
    const topArtistsData = await topArtistsResponse.json();
    
    return {
      followed: followedData.artists?.items || [],
      topArtists: topArtistsData.items || [],
    };
  };
  
  const importSpotifyArtists = async () => {
    if (!spotifyToken) throw new Error('No Spotify token available');
    
    const { followed, topArtists } = await fetchSpotifyArtists();
    
    // Process on the backend
    return await importArtists({
      followedArtists: followed,
      topArtists: topArtists,
    });
  };
  
  return {
    spotifyToken,
    isLoadingToken,
    fetchSpotifyArtists,
    importSpotifyArtists,
  };
}