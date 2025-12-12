import { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AuthGuardProps {
  children: React.ReactNode;
}

const MAX_CREATION_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2_000;

export function AuthGuard({ children }: AuthGuardProps) {
  const user = useQuery(api.auth.loggedInUser);
  const ensureUser = useMutation(api.auth.ensureUserExists);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [hasTriedCreation, setHasTriedCreation] = useState(false);
  const [creationAttempts, setCreationAttempts] = useState(0);
  const [hasTriedSync, setHasTriedSync] = useState(false);
  const [syncAttempts, setSyncAttempts] = useState(0);

  useEffect(() => {
    // If user is logged in but app user doesn't exist, auto-create in background
    if (
      user &&
      user.needsSetup &&
      !hasTriedCreation &&
      !isCreatingUser &&
      creationAttempts < MAX_CREATION_ATTEMPTS
    ) {
      setIsCreatingUser(true);
      setHasTriedCreation(true);
      setCreationAttempts((prev) => prev + 1);

      ensureUser()
        .then(() => {
          toast.success('Welcome! Your account is ready.', {
            description: 'You can now vote on setlists and follow artists.',
            duration: 3000,
          });
          setCreationAttempts(0);
        })
        .catch(() => {
          toast.error('Account setup failed', {
            description: 'Please refresh the page to try again.',
          });
          setTimeout(() => {
            setHasTriedCreation(false);
          }, RETRY_DELAY_MS);
        })
        .finally(() => {
          setIsCreatingUser(false);
        });
    }
  }, [user, ensureUser, hasTriedCreation, isCreatingUser, creationAttempts]);

  useEffect(() => {
    // If user exists, do a one-time background sync from identity (spotifyId, avatar, role upgrades, etc).
    if (
      user &&
      !user.needsSetup &&
      !hasTriedSync &&
      !isCreatingUser &&
      syncAttempts < MAX_CREATION_ATTEMPTS
    ) {
      setHasTriedSync(true);
      setSyncAttempts((prev) => prev + 1);

      ensureUser()
        .catch(() => {
          // Silent-ish failure; don't block UI.
          setTimeout(() => {
            setHasTriedSync(false);
          }, RETRY_DELAY_MS);
        });
    }
  }, [user, ensureUser, hasTriedSync, isCreatingUser, syncAttempts]);

  // Still loading initial auth state
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't block the UI while creating app user. Render a lightweight inline banner if setup is in progress.
  const showSetupBanner = Boolean(
    (user && user.needsSetup) || isCreatingUser
  );

  return (
    <>
      {showSetupBanner && (
        <div className="fixed top-3 right-3 z-[100] rounded-xl border border-border bg-card/70 backdrop-blur-md px-3 py-2 text-xs text-muted-foreground shadow-lg">
          Setting up your account...
        </div>
      )}
      {children}
    </>
  );
}
