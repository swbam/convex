"use client";
import { useClerk, useSignIn, useSignUp } from "@clerk/clerk-react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { setActive } = useClerk();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!signInLoaded || !signUpLoaded) return;

    setSubmitting(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      if (flow === "signIn") {
        const result = await signIn.create({
          identifier: email,
          password,
        });

        if (result.status === "complete") {
          if (result.createdSessionId) {
            await setActive({ session: result.createdSessionId });
          }
          toast.success("Signed in successfully!");
        } else {
          toast.error("Sign in incomplete. Please check your email.");
        }
      } else {
        const result = await signUp.create({
          emailAddress: email,
          password,
        });

        if (result.status === "complete") {
          if (result.createdSessionId) {
            await setActive({ session: result.createdSessionId });
          }
          toast.success("Account created successfully!");
        } else {
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          toast.success("Please check your email to verify your account.");
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.errors?.[0]?.message) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(flow === "signIn" ? "Could not sign in" : "Could not sign up");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-3 sm:gap-4"
        onSubmit={handleSubmit}
      >
        <input
          className="px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-800 border border-zinc-700 rounded-lg sm:rounded-xl text-responsive-sm placeholder-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all touch-target"
          type="email"
          name="email"
          placeholder="Email"
          required
          autoComplete="email"
          inputMode="email"
        />
        <input
          className="px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-800 border border-zinc-700 rounded-lg sm:rounded-xl text-responsive-sm placeholder-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all touch-target"
          type="password"
          name="password"
          placeholder="Password"
          required
          autoComplete={flow === "signIn" ? "current-password" : "new-password"}
        />
        <button 
          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-primary-foreground rounded-lg sm:rounded-xl hover:bg-primary/90 active:bg-primary/80 transition-all disabled:opacity-50 font-medium text-responsive-sm sm:text-responsive-base touch-target" 
          type="submit" 
          disabled={submitting}
        >
          {submitting ? "..." : (flow === "signIn" ? "Sign in" : "Sign up")}
        </button>
        <div className="text-center text-responsive-xs sm:text-responsive-sm text-zinc-400 mt-1 sm:mt-2">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-primary hover:text-primary/80 hover:underline font-medium cursor-pointer touch-target inline-block py-1"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
    </div>
  );
}
