"use client";
import { useClerk, useUser } from "@clerk/clerk-react";

export function SignOutButton() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();

  if (!isSignedIn) {
    return null;
  }

  return (
    <button
      className="px-4 py-2 rounded bg-zinc-800 text-white border border-zinc-700 font-medium hover:bg-zinc-700 transition-colors"
      onClick={() => signOut()}
    >
      Sign out
    </button>
  );
}
