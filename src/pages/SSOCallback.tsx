import React, { useEffect, useRef } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MagicCard } from '../components/ui/magic-card';
import { Music, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { capture, captureException, consumeOAuthIntent } from '../lib/analytics';
import { safeReturnTo } from '../lib/navigation';

/**
 * SSO Callback Page
 * Handles OAuth redirects from Clerk (Spotify, Google, etc.)
 */
export function SSOCallback() {
  const clerk = useClerk();
  const { handleRedirectCallback } = clerk;
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = React.useState<string | null>(null);
  const [isImportingSpotify, setIsImportingSpotify] = React.useState(false);
  const completeSpotifyImport = useAction(api.spotifyOAuth.importLinkedSpotify);
  const spotifyImportTimeout = useRef<number | null>(null);
  const hasHandledCallback = useRef(false);

  useEffect(() => {
    if (hasHandledCallback.current) {
      return;
    }

    hasHandledCallback.current = true;

    async function handleCallback() {
      try {
        const returnTo = safeReturnTo(new URLSearchParams(location.search).get('returnTo'));

        // Handle the OAuth callback
        await handleRedirectCallback({
          afterSignInUrl: returnTo,
          afterSignUpUrl: returnTo,
        });

        // useClerk already supplies the loaded client.
        const oauthIntent = consumeOAuthIntent();
        if (oauthIntent?.auth_mode !== 'link') {
          capture('auth_completed', {
            auth_method: oauthIntent?.auth_method || 'oauth',
            auth_mode: oauthIntent?.auth_mode || 'sign_in',
            source: oauthIntent?.source || 'oauth_callback',
            return_to: returnTo,
          });
          if (oauthIntent?.auth_mode === 'sign_up') {
            capture('account_created', {
              auth_method: oauthIntent.auth_method,
              verification_required: false,
            });
          }
        }
        
        // Check if this was a Spotify OAuth flow
        spotifyImportTimeout.current = window.setTimeout(async () => {
          try {
            const latestUser = clerk.user ?? user ?? undefined;

            if (latestUser?.externalAccounts) {
              const spotifyAccount = latestUser.externalAccounts.find(
                (account) => ['spotify', 'oauth_spotify'].includes(account.provider)
              );
              
              if (spotifyAccount) {
                setIsImportingSpotify(true);
                
                try {
                  const result = await completeSpotifyImport({});
                  if (!result.success) throw new Error(result.message);
                  
                  if (result.imported > 0 || result.correlated > 0) {
                    capture('spotify_connect_completed', {
                      imported_artist_count: result.imported,
                      correlated_artist_count: result.correlated,
                      return_to: returnTo,
                    });
                    toast.success('Spotify artists imported successfully!', {
                      description: `Imported ${result.imported} new artists, found ${result.correlated} existing artists.`,
                      duration: 5000,
                    });
                  } else {
                    capture('spotify_connect_completed', {
                      imported_artist_count: 0,
                      correlated_artist_count: 0,
                      return_to: returnTo,
                    });
                    toast.info('Spotify connected', {
                      description: 'No new artists to import at this time.',
                    });
                  }
                } catch (error) {
                  capture('spotify_connect_failed', { source: 'spotify_import', error_type: 'import_error' });
                  captureException(error, { operation: 'spotify_artist_import' });
                  toast.error('Failed to import Spotify artists', {
                    description: 'You can manually sync later from your profile.',
                  });
                }
              }
            }
          } catch (error) {
            capture('spotify_connect_failed', {
              source: oauthIntent?.source || 'spotify_callback',
              error_type: 'account_inspection_error',
            });
            captureException(error, { operation: 'spotify_account_inspection' });
          }
          
          navigate(returnTo);
        }, 1000);
        
      } catch (err: any) {
        capture('auth_failed', { auth_method: 'oauth', auth_mode: 'callback', error_type: err?.code || 'callback_error' });
        captureException(err, { operation: 'oauth_callback' });
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
  }, [handleRedirectCallback, clerk, user, navigate, location.search, completeSpotifyImport]);

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
        <p className="text-muted-foreground mb-6">{isImportingSpotify ? 'Importing your Spotify artists' : 'Preparing your account'}</p>
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground mt-4">This should only take a moment</p>
      </MagicCard>
    </div>
  );
}
