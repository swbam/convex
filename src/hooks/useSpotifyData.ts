import { useCallback } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function useSpotifyData() {
  const importLinkedSpotify = useAction(api.spotifyOAuth.importLinkedSpotify);
  const importSpotifyArtists = useCallback(async () => {
    const result = await importLinkedSpotify({});
    if (!result.success) throw new Error(result.message);
    return result;
  }, [importLinkedSpotify]);

  return { importSpotifyArtists };
}
