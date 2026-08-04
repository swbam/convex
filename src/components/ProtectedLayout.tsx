import { AuthGuard } from './AuthGuard';
import { ScrollToTop } from './ScrollToTop';
import { SEOHead } from './SEOHead';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

/**
 * A layout wrapper for protected routes that ensures:
 * 1. User has a Convex appUser record (via AuthGuard)
 * 2. Basic page scroll reset on navigation
 * 3. Robots "noindex" meta on private paths (via SEOHead's NOINDEX_PREFIXES)
 *
 * Use this for routes that need authentication and user setup,
 * but don't use the main AppLayout (e.g., artist portal pages).
 */
export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  return (
    <>
      {/* Outside AuthGuard so the noindex robots meta applies even while
          auth is loading or the visitor is signed out. */}
      <SEOHead />
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
    </>
  );
}
