import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export function MobileThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();

  // useEffect only runs on the client, preventing hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return placeholder to avoid layout shift
    return (
      <button
        className="flex h-11 w-11 items-center justify-center rounded-xl opacity-0"
        disabled
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-secondary/55 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={theme}
          className="flex items-center justify-center"
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, rotate: -18, scale: 0.75 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 18, scale: 0.75 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.14, ease: 'easeOut' }}
        >
          {theme === 'dark' ? (
            <Sun className="h-[18px] w-[18px] text-yellow-400" />
          ) : (
            <Moon className="h-[18px] w-[18px] text-slate-600" />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
