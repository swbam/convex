import React, { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { MagicCard } from '../components/ui/magic-card';
import { BorderBeam } from '../components/ui/border-beam';
import { ShimmerButton } from '../components/ui/shimmer-button';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Music, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export function SignInPage() {
  const { signIn, isLoaded } = useSignIn();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        toast.success("Welcome back!");
        navigate('/');
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
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
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

        {/* Main Sign In Card */}
        <MagicCard className="relative overflow-hidden rounded-2xl p-0 border-0">
          {/* Header */}
          <div className="relative z-10 p-8">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Music className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white">Welcome Back</h1>
              </div>
              <p className="text-gray-300 text-lg">
                Sign in to your TheSet account
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm text-gray-400">Vote on setlists and follow artists</span>
              </div>
            </div>

            {/* Sign In Form */}
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
