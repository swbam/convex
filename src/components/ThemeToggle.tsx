import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, preventing hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return placeholder with same dimensions to avoid layout shift
    return (
      <Button
        variant="ghost"
        size="icon"
        className="w-9 h-9 rounded-full"
        disabled
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-9 h-9 rounded-full hover:bg-accent/50 transition-all"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4 text-yellow-400 transition-all rotate-0 scale-100" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700 transition-all rotate-0 scale-100" />
      )}
    </Button>
  );
}

