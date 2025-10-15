import { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const user = useQuery(api.auth.loggedInUser);
  const ensureUser = useMutation(api.auth.ensureUserExists);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [hasTriedCreation, setHasTriedCreation] = useState(false);

  useEffect(() => {
    // If user is logged in but app user doesn't exist, auto-create in background
    if (user && user.needsSetup && !hasTriedCreation && !isCreatingUser) {
      console.log('🔧 Auto-creating app user in background...');
      setIsCreatingUser(true);
      setHasTriedCreation(true);
      
      ensureUser()
        .then((userId) => {
          console.log('✅ App user created:', userId);
          toast.success('Welcome! Your account is ready.', {
            description: 'You can now vote on setlists and follow artists.',
            duration: 3000,
          });
        })
        .catch((error) => {
          console.error('❌ Failed to create app user:', error);
          toast.error('Account setup failed', {
            description: 'Please refresh the page to try again.',
          });
        })
        .finally(() => {
          setIsCreatingUser(false);
        });
    }
  }, [user, ensureUser, hasTriedCreation, isCreatingUser]);

  // Still loading initial auth state
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

  // CRITICAL FIX: Don't block the UI while creating app user
  // Let the app render normally, user creation happens in background
  return <>{children}</>;
}
