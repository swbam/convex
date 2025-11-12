import React, { useState } from 'react';
import { useClerk, useSignUp, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { MagicCard } from '../components/ui/magic-card';
import { BorderBeam } from '../components/ui/border-beam';
import { ShimmerButton } from '../components/ui/shimmer-button';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Music, Sparkles, User, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FaSpotify, FaGoogle } from 'react-icons/fa';

export function SignUpPage() {
  const { signUp, isLoaded } = useSignUp();
  const { setActive } = useClerk();
  const { isSignedIn, isLoaded: isUserLoaded } = useUser();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSpotifyLoading, setIsSpotifyLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // CRITICAL FIX: Add timeout for auth loading to prevent infinite loading
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isLoaded || !signUp) {
        console.error('❌ Clerk failed to load after 10 seconds');
        setAuthError("Authentication service failed to load. Please check your internet connection.");
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isLoaded, signUp]);

  // Redirect to dashboard if already signed in
  React.useEffect(() => {
    if (isUserLoaded && isSignedIn) {
      navigate('/', { replace: true });
    }
  }, [isUserLoaded, isSignedIn, navigate]);

  // Show loading state while Clerk initializes with error handling
  if (!isLoaded || !signUp) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          {authError ? (
            <>
              <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Authentication Error</h2>
              <p className="text-gray-400 mb-6">{authError}</p>
              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all duration-200 border border-white/20"
                >
                  Retry
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full px-6 py-3 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white rounded-xl font-medium transition-all duration-200"
                >
                  Go Back Home
                </button>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-white" />
              <p className="text-white mb-2">Loading authentication...</p>
              <p className="text-gray-400 text-sm">This should only take a moment</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const handleSpotifySignUp = async () => {
    if (!signUp) {
      console.error('SignUp not available');
      toast.error('Authentication not ready. Please refresh the page.');
      return;
    }
    
    setIsSpotifyLoading(true);
    console.log('🎵 Starting Spotify OAuth sign up flow...');
    
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_spotify',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/activity`,
      });
    } catch (error: any) {
      console.error('❌ Spotify sign up error:', error);
      console.error('Error details:', {
        message: error?.message,
        errors: error?.errors,
        status: error?.status
      });
      
      const errorMessage = error?.errors?.[0]?.message || error?.message || 'Failed to sign up with Spotify';
      toast.error(errorMessage);
      setIsSpotifyLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!signUp) {
      console.error('SignUp not available');
      toast.error('Authentication not ready. Please refresh the page.');
      return;
    }
    
    setIsGoogleLoading(true);
    console.log('🔍 Starting Google OAuth sign up flow...');
    
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/`,
      });
    } catch (error: any) {
      console.error('❌ Google sign up error:', error);
      console.error('Error details:', {
        message: error?.message,
        errors: error?.errors,
        status: error?.status
      });
      
      const errorMessage = error?.errors?.[0]?.message || error?.message || 'Failed to sign up with Google';
      toast.error(errorMessage);
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) {
      console.error('SignUp not available');
      toast.error('Authentication not ready. Please refresh the page.');
      return;
    }

    setIsSubmitting(true);
    console.log('📧 SignUpPage: Starting email sign up...', {
      email,
      timestamp: new Date().toISOString()
    });
    
    try {
      // CRITICAL: Create with CAPTCHA support
      const result = await signUp.create({
        emailAddress: email,
        password,
      });

      console.log('📧 SignUpPage: Sign up result', {
        status: result.status,
        createdSessionId: result.createdSessionId,
        userId: result.createdUserId,
        timestamp: new Date().toISOString()
      });

      if (result.status === "complete") {
        if (result.createdSessionId) {
          console.log('📧 SignUpPage: Setting active session...', {
            sessionId: result.createdSessionId
          });
          await setActive({ session: result.createdSessionId });
        }
        toast.success("Account created successfully!");
        
        console.log('✅ SignUpPage: Sign up successful, redirecting to home...');
        // FIXED: Redirect to home (/) - AuthGuard will handle user creation
        navigate('/');
      } else {
        console.log('📧 SignUpPage: Sign up requires verification');
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setVerificationStep(true);
        toast.success("Please check your email for verification code.");
      }
    } catch (error: any) {
      console.error("❌ Sign up error:", error);
      console.error('Error details:', {
        message: error?.message,
        errors: error?.errors,
        status: error?.status,
        clerkError: error?.clerkError
      });
      
      if (error.errors?.[0]?.message) {
        toast.error(error.errors[0].message);
      } else if (error.message) {
        toast.error(error.message);
      } else {
        toast.error("Could not create account. Please try again or contact support.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) {
      console.error('SignUp not available');
      console.error('Clerk state:', { isLoaded, signUp: !!signUp });
      toast.error('Authentication not ready. Please refresh the page.');
      // FIXED: Immediate redirect to home
      navigate('/');
      return;
    }

    setIsSubmitting(true);
    console.log('✉️ Attempting email verification...');
    
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      console.log('Verification result status:', result.status);

      if (result.status === "complete") {
        if (result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
        }
        toast.success("Email verified! Welcome to setlists.live!");
        console.log('✅ Email verified, redirecting to home...');
        // FIXED: Redirect to home (/)
        navigate('/');
      } else {
        console.warn('Verification incomplete:', result.status);
        toast.error("Invalid verification code. Please try again.");
      }
    } catch (error: any) {
      console.error("❌ Verification error:", error);
      console.error('Error details:', {
        message: error?.message,
        errors: error?.errors,
        status: error?.status
      });
      
      if (error.errors?.[0]?.message) {
        toast.error(error.errors[0].message);
      } else if (error.message) {
        toast.error(error.message);
      } else {
        toast.error("Verification failed. Please check your code and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Simple black gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />
      
      <div className="relative z-10 w-full max-w-md">
        {/* Back Button */}
        <MagicCard className="inline-block p-0 rounded-xl border-0 mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-300 px-4 py-2 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
        </MagicCard>

        {/* Main Sign Up Card */}
        <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0">
          <div className="relative z-10 p-8">
            {!verificationStep ? (
              <>
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <Music className="h-6 w-6 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Join setlists.live</h1>
                  </div>
                  <p className="text-gray-300 text-lg">
                    Create your account to start voting
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm text-gray-400">Predict setlists and compete with fans</span>
                  </div>
                </div>

                {/* Sign Up Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                        className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white placeholder-gray-400 backdrop-blur-sm transition-all duration-300"
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
                        placeholder="Create a password"
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

                  {/* CAPTCHA Widget Container - Required by Clerk */}
                  <div id="clerk-captcha" className="flex justify-center"></div>

                  {/* Submit Button */}
                  <ShimmerButton
                    type="submit"
                    disabled={isSubmitting || !email || !password}
                    className="w-full bg-primary/20 hover:bg-primary/30 text-white border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    shimmerColor="#ffffff"
                    shimmerDuration="2s"
                  >
                    {isSubmitting ? "Creating Account..." : "Create Account"}
                  </ShimmerButton>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-card text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                {/* OAuth Buttons */}
                <div className="space-y-3">
                  {/* Google OAuth Button */}
                  <button
                    type="button"
                    onClick={handleGoogleSignUp}
                    disabled={isGoogleLoading || isSpotifyLoading || isSubmitting}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <FaGoogle className="h-5 w-5" />
                    )}
                    <span>{isGoogleLoading ? 'Connecting to Google...' : 'Sign up with Google'}</span>
                  </button>

                  {/* Spotify OAuth Button */}
                  <button
                    type="button"
                    onClick={handleSpotifySignUp}
                    disabled={isSpotifyLoading || isGoogleLoading || isSubmitting}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSpotifyLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <FaSpotify className="h-5 w-5" />
                    )}
                    <span>{isSpotifyLoading ? 'Connecting to Spotify...' : 'Sign up with Spotify'}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Verification Step */}
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <Check className="h-6 w-6 text-green-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Verify Email</h1>
                  </div>
                  <p className="text-gray-300 text-lg">
                    We sent a verification code to
                  </p>
                  <p className="text-white font-medium">{email}</p>
                </div>

                {/* Verification Form */}
                <form onSubmit={handleVerification} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Verification Code</label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="Enter 6-digit code"
                      required
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 text-white placeholder-gray-400 backdrop-blur-sm transition-all duration-300 text-center text-lg tracking-widest"
                      maxLength={6}
                    />
                  </div>

                  <ShimmerButton
                    type="submit"
                    disabled={isSubmitting || verificationCode.length !== 6}
                    className="w-full bg-green-500/20 hover:bg-green-500/30 text-white border-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    shimmerColor="#10b981"
                    shimmerDuration="2s"
                  >
                    {isSubmitting ? "Verifying..." : "Verify Email"}
                  </ShimmerButton>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => setVerificationStep(false)}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    Back to sign up
                  </button>
                </div>
              </>
            )}

            {/* Sign In Link */}
            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Already have an account?{' '}
                <button
                  onClick={() => navigate('/signin')}
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Sign in here
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
