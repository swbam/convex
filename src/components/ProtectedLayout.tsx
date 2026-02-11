import { AuthGuard } from './AuthGuard';
import { ScrollToTop } from './ScrollToTop';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

/**
 * A layout wrapper for protected routes that ensures:
 * 1. User has a Convex appUser record (via AuthGuard)
 * 2. Basic page scroll reset on navigation
 * 
 * Use this for routes that need authentication and user setup,
 * but don't use the main AppLayout (e.g., artist portal pages).
 */
export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  return (
    <AuthGuard>
      <ScrollToTop />
      <div className="min-h-screen min-h-dvh bg-background text-foreground">
        {/* Theme-aware gradient background */}
        <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-background dark:from-black dark:via-gray-950 dark:to-black pointer-events-none" />
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}
