import React, { useEffect } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { MagicCard } from '../components/ui/magic-card';
import { Music, Loader2 } from 'lucide-react';

/**
 * SSO Callback Page
 * Handles OAuth redirects from Clerk (Spotify, Google, etc.)
 */
export function SSOCallback() {
  const { handleRedirectCallback } = useClerk();
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        // Handle the OAuth callback
        await handleRedirectCallback();
        
        // Redirect to home - App.tsx will handle user creation
        setTimeout(() => {
          navigate('/');
        }, 500);
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
  }, [handleRedirectCallback, navigate]);

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
