import React, { useEffect, useRef } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MagicCard } from '../components/ui/magic-card';
import { Music, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * SSO Callback Page
 * Handles OAuth redirects from Clerk (Spotify, Google, etc.)
 */
export function SSOCallback() {
  const { handleRedirectCallback, clerk } = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);
  const [isImportingSpotify, setIsImportingSpotify] = React.useState(false);
  const completeSpotifyImport = useAction(api.spotifyOAuth.completeSpotifyImport);
  const storeSpotifyTokens = useAction(api.spotifyAuth.storeSpotifyTokens);
  const spotifyImportTimeout = useRef<number | null>(null);
  const hasHandledCallback = useRef(false);

  useEffect(() => {
    if (hasHandledCallback.current) {
      return;
    }

    hasHandledCallback.current = true;

    async function handleCallback() {
      try {
        console.log('🔄 SSOCallback: Starting OAuth callback handling', {
          url: window.location.href,
          timestamp: new Date().toISOString()
        });
        
        // Handle the OAuth callback
        await handleRedirectCallback({
          afterSignInUrl: '/',
          afterSignUpUrl: '/',
        });

        // Ensure Clerk has the latest session data before inspecting accounts
        await clerk.load();
        
        console.log('✅ SSOCallback: OAuth callback handled successfully', {
          userId: clerk.user?.id,
          userEmail: clerk.user?.emailAddresses?.[0]?.emailAddress,
          isSignedIn: !!clerk.user
        });
        
        // Check if this was a Spotify OAuth flow
        // We'll check user metadata after a short delay to ensure Clerk has updated
        spotifyImportTimeout.current = window.setTimeout(async () => {
          try {
            const latestUser = clerk.user ?? user ?? undefined;

            if (latestUser?.externalAccounts) {
              const spotifyAccount = latestUser.externalAccounts.find(
                (account) => account.provider === 'spotify'
              );
              
              if (spotifyAccount) {
                console.log('🎵 Spotify account detected, fetching data...');
                console.log('Spotify account details:', spotifyAccount);
                setIsImportingSpotify(true);
                
                // Get access token using Clerk's getToken method with Spotify template
                const accessToken = await latestUser.getToken({ template: 'spotify' });
                
                if (!accessToken) {
                  console.error('❌ No access token found in Spotify account');
                  console.log('Available properties:', Object.keys(spotifyAccount));
                  console.log('Full spotify account object:', spotifyAccount);
                  toast.warning('Spotify connected but token not available', {
                    description: 'You can manually sync from your profile later.',
                  });
                  // Continue to home page even without token - user can sync manually
                  navigate('/');
                  return;
                }

                try {
                  const spotifyExternal = spotifyAccount as unknown as Record<string, any>;
                  const rawRefreshToken =
                    spotifyExternal?.refresh_token ??
                    spotifyExternal?.token?.refreshToken ??
                    spotifyExternal?.token?.refresh_token ??
                    null;
                  const scope =
                    spotifyExternal?.scope ?? spotifyExternal?.token?.scope ?? undefined;
                  const tokenType =
                    spotifyExternal?.token_type ??
                    spotifyExternal?.token?.tokenType ??
                    'Bearer';
                  const expiresInValue =
                    typeof spotifyExternal?.expires_in === 'number'
                      ? spotifyExternal.expires_in
                      : typeof spotifyExternal?.token?.expiresIn === 'number'
                        ? spotifyExternal.token.expiresIn
                        : 3600;
                  const expiresAt = Date.now() + Math.max(expiresInValue, 300) * 1000;

                  if (spotifyAccount.providerUserId) {
                    await storeSpotifyTokens({
                      spotifyId: spotifyAccount.providerUserId,
                      accessToken,
                      refreshToken: rawRefreshToken ?? undefined,
                      expiresAt,
                      scope,
                      tokenType,
                    });
                  } else if ((spotifyAccount as any).provider_user_id) {
                    await storeSpotifyTokens({
                      spotifyId: (spotifyAccount as any).provider_user_id,
                      accessToken,
                      refreshToken: rawRefreshToken ?? undefined,
                      expiresAt,
                      scope,
                      tokenType,
                    });
                  } else {
                    console.warn('⚠️ Unable to determine Spotify provider ID for token storage.');
                  }
                } catch (tokenError) {
                  console.error('❌ Failed to store Spotify tokens:', tokenError);
                }
                
                console.log('✅ Found Spotify access token, fetching artist data...');
                
                try {
                  // Use the new Spotify OAuth action to fetch and import real data
                  const result = await completeSpotifyImport({
                    accessToken: accessToken,
                  });
                  
                  console.log('✅ Spotify import result:', result);
                  
                  if (result.imported > 0 || result.correlated > 0) {
                    toast.success('Spotify artists imported successfully!', {
                      description: `Imported ${result.imported} new artists, found ${result.correlated} existing artists.`,
                      duration: 5000,
                    });
                  } else {
                    toast.info('Spotify connected', {
                      description: 'No new artists to import at this time.',
                    });
                  }
                } catch (importError) {
                  console.error('❌ Failed to import Spotify artists:', importError);
                  toast.error('Failed to import Spotify artists', {
                    description: 'You can manually sync later from your profile.',
                  });
                }
              } else {
                console.log('No Spotify account found, proceeding with normal login');
              }
            }
          } catch (err) {
            console.error('Error checking for Spotify account:', err);
          }
          
          // FIXED: Redirect to home (/) after OAuth processing
          console.log('🏠 SSOCallback: Redirecting to home page', {
            timestamp: new Date().toISOString(),
            finalUserId: clerk.user?.id,
            finalUserEmail: clerk.user?.emailAddresses?.[0]?.emailAddress
          });
          navigate('/');
        }, 1000); // Short delay to ensure Clerk state updates
        
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

    return () => {
      if (spotifyImportTimeout.current !== null) {
        window.clearTimeout(spotifyImportTimeout.current);
        spotifyImportTimeout.current = null;
      }
    };
  }, [handleRedirectCallback, clerk, user, navigate, completeSpotifyImport, storeSpotifyTokens]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
