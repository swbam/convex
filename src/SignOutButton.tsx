"use client";
import { useClerk, useUser } from "@clerk/clerk-react";
import { LogOut } from 'lucide-react';

export function SignOutButton() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();

  if (!isSignedIn) {
    return null;
  }

  return (
    <button
      className="w-full flex items-center px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all duration-200 group"
      onClick={() => signOut()}
    >
      <LogOut className="mr-2 h-4 w-4 group-hover:text-red-500 transition-colors" />
      <span className="font-medium">Sign Out</span>
    </button>
  );
}
