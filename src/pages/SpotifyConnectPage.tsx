import React, { useState } from 'react';
import { useUser, useSignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { MagicCard } from '../components/ui/magic-card';
import { Music, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

export function SpotifyConnectPage() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signIn } = useSignIn();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Check if Spotify is already connected
  const spotifyAccount = user?.externalAccounts?.find(
    (account) => account.provider === 'spotify'
  );
  const isSpotifyConnected = !!spotifyAccount;

  const handleSpotifyConnect = async () => {
    setIsLoading(true);
    
    try {
      // If user is signed in, use createExternalAccount to LINK Spotify
      if (user) {
        const externalAccount = await user.createExternalAccount({
          strategy: 'oauth_spotify',
          redirectUrl: `${window.location.origin}/sso-callback`,
        });
        
        const verificationUrl = externalAccount.verification?.externalVerificationRedirectURL;
        if (verificationUrl) {
          window.location.href = verificationUrl.toString();
        } else {
          throw new Error('No verification URL returned');
        }
      } else {
        // If not signed in, use signIn flow
        if (!signIn) {
          toast.error('Authentication not ready. Please refresh the page.');
          setIsLoading(false);
          return;
        }
        
        await signIn.authenticateWithRedirect({
          strategy: 'oauth_spotify',
          redirectUrl: `${window.location.origin}/sso-callback`,
          redirectUrlComplete: `${window.location.origin}/activity`,
        });
      }
    } catch (error: any) {
      const errorMessage = error?.errors?.[0]?.message || error?.message || 'Failed to connect Spotify';
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  // Show loading while checking user state
  if (!isUserLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <MagicCard className="p-8 max-w-md text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1DB954]" />
          <p className="text-muted-foreground mt-4">Loading...</p>
        </MagicCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <MagicCard className="p-8 max-w-md text-center">
        <div className={`w-16 h-16 ${isSpotifyConnected ? 'bg-green-500/20' : 'bg-[#1DB954]/20'} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
          {isSpotifyConnected ? (
            <CheckCircle className="h-8 w-8 text-green-500" />
          ) : (
            <Music className="h-8 w-8 text-[#1DB954]" />
          )}
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-4">
          {isSpotifyConnected ? 'Spotify Connected!' : 'Connect Spotify'}
        </h1>
        
        {isSpotifyConnected ? (
          <>
            <p className="text-muted-foreground mb-6">
              Your Spotify account is already linked. We're using your music preferences to personalize your experience.
            </p>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-6">
              <p className="text-sm text-green-400">
                Connected as: {spotifyAccount?.emailAddress || 'Spotify User'}
              </p>
            </div>
            <Button
              onClick={() => { void navigate('/activity'); }}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-foreground"
            >
              Continue to Dashboard
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-6">
              {user 
                ? 'Link your Spotify account to discover personalized shows and artists based on your music taste.'
                : 'Sign in with Spotify to discover personalized shows and artists based on your music taste.'}
            </p>
            
            <div className="space-y-4">
              <Button
                onClick={() => { void handleSpotifyConnect(); }}
                disabled={isLoading}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-foreground"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Music className="h-5 w-5 mr-2" />
                    {user ? 'Link Spotify Account' : 'Sign in with Spotify'}
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => { void navigate(user ? '/activity' : '/'); }}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {user ? 'Skip for now' : 'Go back'}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-6">
              We'll import your followed artists and top artists to personalize your experience.
            </p>
          </>
        )}
      </MagicCard>
    </div>
  );
}
