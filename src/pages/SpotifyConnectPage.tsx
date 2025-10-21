import React, { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { MagicCard } from '../components/ui/magic-card';
import { Music, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

export function SpotifyConnectPage() {
  const { signIn } = useSignIn();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSpotifyConnect = async () => {
    if (!signIn) {
      console.error('SignIn not available');
      toast.error('Authentication not ready. Please refresh the page.');
      return;
    }
    
    setIsLoading(true);
    console.log('🎵 Starting Spotify OAuth connection flow...');
    
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_spotify',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/activity`,
      });
    } catch (error: any) {
      console.error('❌ Spotify connection error:', error);
      const errorMessage = error?.errors?.[0]?.message || error?.message || 'Failed to connect Spotify';
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <MagicCard className="p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-[#1DB954]/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Music className="h-8 w-8 text-[#1DB954]" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-4">Connect Spotify</h1>
        <p className="text-gray-400 mb-6">
          Link your Spotify account to discover personalized shows and artists based on your music taste.
        </p>
        
        <div className="space-y-4">
          <Button
            onClick={handleSpotifyConnect}
            disabled={isLoading}
            className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Connecting...
              </>
            ) : (
              <>
                <Music className="h-5 w-5 mr-2" />
                Connect with Spotify
              </>
            )}
          </Button>
          
          <Button
            onClick={() => navigate('/activity')}
            variant="outline"
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Skip for now
          </Button>
        </div>
        
        <p className="text-xs text-gray-500 mt-6">
          We'll import your followed artists and top artists to personalize your experience.
        </p>
      </MagicCard>
    </div>
  );
}
