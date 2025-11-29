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
        // Handle the OAuth callback
        await handleRedirectCallback({
          afterSignInUrl: '/',
          afterSignUpUrl: '/',
        });

        // Ensure Clerk has the latest session data before inspecting accounts
        await clerk.load();
        
        // Check if this was a Spotify OAuth flow
        spotifyImportTimeout.current = window.setTimeout(async () => {
          try {
            const latestUser = clerk.user ?? user ?? undefined;

            if (latestUser?.externalAccounts) {
              const spotifyAccount = latestUser.externalAccounts.find(
                (account) => account.provider === 'spotify'
              );
              
              if (spotifyAccount) {
                setIsImportingSpotify(true);
                
                const accessToken = await latestUser.getToken({ template: 'spotify' });
                
                if (!accessToken) {
                  toast.warning('Spotify connected but token not available', {
                    description: 'You can manually sync from your profile later.',
                  });
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

                  const providerId = spotifyAccount.providerUserId || (spotifyAccount as any).provider_user_id;
                  if (providerId) {
                    await storeSpotifyTokens({
                      spotifyId: providerId,
                      accessToken,
                      refreshToken: rawRefreshToken ?? undefined,
                      expiresAt,
                      scope,
                      tokenType,
                    });
                  }
                } catch {
                  // Token storage failed, continue anyway
                }
                
                try {
                  const result = await completeSpotifyImport({
                    accessToken: accessToken,
                  });
                  
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
                } catch {
                  toast.error('Failed to import Spotify artists', {
                    description: 'You can manually sync later from your profile.',
                  });
                }
              }
            }
          } catch {
            // Error checking Spotify account, continue anyway
          }
          
          navigate('/');
        }, 1000);
        
      } catch (err: any) {
        setError(err.message || 'Authentication failed');
        
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
          <h2 className="text-xl font-bold text-foreground mb-2">Authentication Failed</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting to sign in...</p>
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
        <h2 className="text-2xl font-bold text-foreground mb-2">Completing Sign In...</h2>
        <p className="text-muted-foreground mb-6">Setting up your account with Spotify</p>
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground mt-4">This should only take a moment</p>
      </MagicCard>
    </div>
  );
}
