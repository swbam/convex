import React, { useEffect } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MagicCard } from '../components/ui/magic-card';
import { Music, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * SSO Callback Page
 * Handles OAuth redirects from Clerk (Spotify, Google, etc.)
 */
export function SSOCallback() {
  const { handleRedirectCallback } = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);
  const [isImportingSpotify, setIsImportingSpotify] = React.useState(false);
  const importSpotifyArtists = useAction(api.spotifyAuth.importUserSpotifyArtistsWithToken);

  useEffect(() => {
    async function handleCallback() {
      try {
        console.log('🔄 Handling OAuth callback...');
        
        // Handle the OAuth callback
        await handleRedirectCallback({
          afterSignInUrl: '/',
          afterSignUpUrl: '/',
        });
        
        console.log('✅ OAuth callback handled successfully');
        
        // Check if this was a Spotify OAuth flow
        // We'll check user metadata after a short delay to ensure Clerk has updated
        setTimeout(async () => {
          try {
            if (user?.externalAccounts) {
              const spotifyAccount = user.externalAccounts.find(
                (account) => account.provider === 'spotify'
              );
              
              if (spotifyAccount) {
                console.log('🎵 Spotify account detected, fetching data...');
                setIsImportingSpotify(true);
                
                // Fetch Spotify data using the OAuth token
                const token = spotifyAccount.approvedScopes?.length ? 
                  (spotifyAccount as any).verification?.externalVerificationRedirectURL : null;
                
                // Fetch followed artists and top artists from Spotify API
                try {
                  // Note: In production, you'd use the actual access token from Clerk
                  // For now, we'll create a placeholder implementation
                  // The actual Spotify API calls would happen in a Convex action
                  
                  const result = await importSpotifyArtists({
                    followedArtists: [], // Will be populated by Convex action
                    topArtists: [], // Will be populated by Convex action
                  });
                  
                  console.log('✅ Spotify import result:', result);
                  toast.success('Welcome! Your Spotify artists are being imported.', {
                    description: 'This may take a moment...',
                  });
                } catch (importError) {
                  console.error('❌ Failed to import Spotify artists:', importError);
                  toast.error('Failed to import Spotify artists', {
                    description: 'You can manually sync later from your profile.',
                  });
                }
              }
            }
          } catch (err) {
            console.error('Error checking for Spotify account:', err);
          }
          
          // Redirect to home regardless of Spotify import status
          navigate('/');
        }, 1000);
        
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setError(err.message || 'Authentication failed');
        
        // Redirect to sign in after error
        setTimeout(() => {
          navigate('/signin');
        }, 3000);
      }
    }

    void handleCallback();
  }, [handleRedirectCallback, user, navigate, importSpotifyArtists]);

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <MagicCard className="p-8 max-w-md text-center border border-red-500/20">
          <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Authentication Failed</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to sign in...</p>
        </MagicCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <MagicCard className="p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-[#1DB954]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Music className="h-8 w-8 text-[#1DB954]" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Completing Sign In...</h2>
        <p className="text-gray-400 mb-6">Setting up your account with Spotify</p>
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-gray-500 mt-4">This should only take a moment</p>
      </MagicCard>
    </div>
  );
}
