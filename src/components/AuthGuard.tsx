import { useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const user = useQuery(api.auth.loggedInUser);
  const ensureUser = useMutation(api.auth.ensureUserExists);

  useEffect(() => {
    // If user is logged in but app user doesn't exist, auto-create
    if (user && user.needsSetup) {
      console.log('🔧 Auto-creating app user...');
      ensureUser()
        .then((userId) => {
          console.log('✅ App user created:', userId);
        })
        .catch((error) => {
          console.error('❌ Failed to create app user:', error);
        });
    }
  }, [user, ensureUser]);

  // Still loading user data
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // User is setting up (creating app user)
  if (user && user.needsSetup) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-400">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // User is fully ready
  return <>{children}</>;
}
