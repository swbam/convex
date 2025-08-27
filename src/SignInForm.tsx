"use client";
import { useSignIn, useSignUp } from "@clerk/clerk-react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
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
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <input
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:border-primary focus:outline-none"
          type="email"
          name="email"
          placeholder="Email"
          required
        />
        <input
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:border-primary focus:outline-none"
          type="password"
          name="password"
          placeholder="Password"
          required
        />
        <button 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50" 
          type="submit" 
          disabled={submitting}
        >
          {submitting ? "..." : (flow === "signIn" ? "Sign in" : "Sign up")}
        </button>
        <div className="text-center text-sm text-zinc-400">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-primary hover:text-primary/80 hover:underline font-medium cursor-pointer"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
    </div>
  );
}
