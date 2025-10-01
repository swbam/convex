import React, { useEffect, useState } from 'react';
import { useUser, useSignIn, useClerk } from '@clerk/clerk-react';
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Music as Spotify } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';
import { MagicCard } from '../components/ui/magic-card';
import { BorderBeam } from '../components/ui/border-beam';
import { ShimmerButton } from '../components/ui/shimmer-button';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Music, Sparkles, Loader2 } from 'lucide-react';
import { FaGoogle } from 'react-icons/fa';

export function SignInPage() {
  const { user, isSignedIn } = useUser();
  const { signIn, isLoaded, setActive } = useSignIn();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importSpotifyArtists = useAction(api.spotifyAuth.importUserSpotifyArtistsWithToken);

  useEffect(() => {
    if (isSignedIn && user?.publicMetadata?.spotifyId) {
      // Post-sign-in import if Spotify connected
      setIsImporting(true);
      const spotifyData = {
        followedArtists: [], // Fetch from Clerk metadata or localStorage/callback params
        topArtists: [], // Similar
        // Assume data from OAuth callback or user metadata
      };
      importSpotifyArtists(spotifyData)
        .then((result) => {
          toast.success(result.message);
        })
        .catch((e) => toast.error("Spotify import failed"))
        .finally(() => setIsImporting(false));
    }
  }, [isSignedIn, user]);

  if (isImporting) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /> Importing Spotify...</div>;
  }

  const handleSpotifySignIn = async () => {
    if (!isLoaded) return;
    setIsSpotifyLoading(true);
    
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_spotify',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      });
    } catch (error: any) {
      console.error('Spotify sign in error:', error);
      toast.error('Failed to sign in with Spotify');
      setIsSpotifyLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isLoaded) return;
    setIsGoogleLoading(true);
    
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      });
    } catch (error: any) {
      console.error('Google sign in error:', error);
      toast.error('Failed to sign in with Google');
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setIsSubmitting(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        if (result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
        }
        toast.success("Welcome back!");
        
        // Redirect to home - let App.tsx handle user creation and routing
        setTimeout(() => navigate('/'), 500);
      } else {
        toast.error("Sign in incomplete. Please check your email.");
      }
    } catch (error: any) {
      console.error("Sign in error:", error);
      if (error.errors?.[0]?.message) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Could not sign in. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-3 sm:p-4 safe-area-x safe-area-y">
      {/* Simple black gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />
      
      <div className="relative z-10 w-full max-w-sm sm:max-w-md">
        {/* Back Button */}
        <MagicCard className="inline-block p-0 rounded-lg sm:rounded-xl border-0 mb-4 sm:mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-foreground transition-all duration-300 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl touch-target"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="text-responsive-sm">Back to Home</span>
          </button>
        </MagicCard>

        {/* Main Sign In Card */}
        <MagicCard className="relative overflow-hidden rounded-xl sm:rounded-2xl p-0 border-0">
          {/* Header */}
          <div className="relative z-10 p-6 sm:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/10 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Music className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <h1 className="text-responsive-2xl sm:text-responsive-3xl font-bold text-white">Welcome Back</h1>
              </div>
              <p className="text-gray-300 text-responsive-base sm:text-responsive-lg">
                Sign in to your setlists.live account
              </p>
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                <span className="text-responsive-xs sm:text-responsive-sm text-gray-400">Vote on setlists and follow artists</span>
              </div>
            </div>

            {/* Sign In Form */}
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {/* Email Field */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-responsive-xs sm:text-responsive-sm font-medium text-gray-300">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white placeholder-gray-400 backdrop-blur-sm transition-all duration-300 text-responsive-sm touch-target"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white placeholder-gray-400 backdrop-blur-sm transition-all duration-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

            {/* Submit Button */}
            <ShimmerButton
              type="submit"
              disabled={isSubmitting || !email || !password}
              className="w-full bg-primary/20 hover:bg-primary/30 text-white border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
              shimmerColor="#ffffff"
              shimmerDuration="2s"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </ShimmerButton>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-black text-gray-400">Or continue with</span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isSpotifyLoading || isSubmitting}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
            >
              {isGoogleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FaGoogle className="h-5 w-5" />
              )}
              <span>{isGoogleLoading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
            </button>

            {/* Spotify OAuth Button */}
            <button
              type="button"
              onClick={handleSpotifySignIn}
              disabled={isSpotifyLoading || isGoogleLoading || isSubmitting}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSpotifyLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Spotify className="h-5 w-5" />
              )}
              <span>{isSpotifyLoading ? 'Connecting to Spotify...' : 'Sign in with Spotify'}</span>
            </button>
          </div>

            {/* Sign Up Link */}
            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Don't have an account?{' '}
                <button
                  onClick={() => navigate('/signup')}
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Sign up here
                </button>
              </p>
            </div>
          </div>
          
          <BorderBeam size={200} duration={15} className="opacity-40" />
        </MagicCard>
      </div>
    </div>
  );
}
