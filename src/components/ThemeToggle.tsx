import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();

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
        className="h-9 w-9 rounded-[10px]"
        disabled
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <motion.div
      className="flex"
      whileHover={shouldReduceMotion ? undefined : { scale: 1.035 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="h-9 w-9 rounded-[10px] text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
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
              <Sun className="h-[17px] w-[17px] text-yellow-400" />
            ) : (
              <Moon className="h-[17px] w-[17px] text-slate-700" />
            )}
          </motion.span>
        </AnimatePresence>
      </Button>
    </motion.div>
  );
}
