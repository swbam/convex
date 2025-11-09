import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

export function MobileThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, preventing hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return placeholder to avoid layout shift
    return (
      <button
        className="w-8 h-8 flex items-center justify-center rounded-md opacity-0"
        disabled
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent/50 transition-all active:scale-95 touch-target"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4 text-yellow-400/80" />
      ) : (
        <Moon className="h-4 w-4 text-slate-600" />
      )}
    </button>
  );
}

