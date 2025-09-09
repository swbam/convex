import React, { useState } from 'react';
import { useClerk, useSignUp } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { MagicCard } from '../components/ui/magic-card';
import { BorderBeam } from '../components/ui/border-beam';
import { ShimmerButton } from '../components/ui/shimmer-button';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Music, Sparkles, User, Check } from 'lucide-react';
import { toast } from 'sonner';

export function SignUpPage() {
  const { signUp, isLoaded } = useSignUp();
  const { setActive } = useClerk();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setIsSubmitting(true);
    try {
      const result = await signUp.create({
        emailAddress: email,
        password,
      });

      if (result.status === "complete") {
        if (result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
        }
        toast.success("Account created successfully!");
        navigate('/');
      } else {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setVerificationStep(true);
        toast.success("Please check your email for verification code.");
      }
    } catch (error: any) {
      console.error("Sign up error:", error);
      if (error.errors?.[0]?.message) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Could not create account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setIsSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === "complete") {
        if (result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
        }
        toast.success("Email verified! Welcome to setlists.live!");
        navigate('/');
      } else {
        toast.error("Invalid verification code. Please try again.");
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error("Verification failed. Please try again.");
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
