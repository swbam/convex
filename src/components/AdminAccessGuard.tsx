import type { ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";

// Keep restricted dashboard subscriptions unmounted until backend auth and the
// database-backed role are ready. Server functions still enforce requireAdmin.
export function AdminAccessGuard({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.loggedInUser, isAuthenticated ? {} : "skip");

  if (isLoading || (isAuthenticated && (user === undefined || user?.needsSetup))) {
    return <p role="status" className="px-4 py-16 text-center text-muted-foreground">Checking admin access…</p>;
  }

  if (!isAuthenticated || !user) {
    return (
      <section className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Sign in to administration</h1>
        <p className="text-muted-foreground">Use your administrator account to manage the site.</p>
        <Button asChild><Link to="/signin?returnTo=%2Fadmin">Sign in</Link></Button>
      </section>
    );
  }

  if (user.appUser?.role !== "admin") {
    return (
      <section className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Administrator access required</h1>
        <p className="text-muted-foreground">This account does not have access to site administration.</p>
        <Button asChild variant="outline"><Link to="/">Back to setlists.live</Link></Button>
      </section>
    );
  }

  return children;
}
