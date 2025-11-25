/**
 * Backend Error Monitor Component
 * Polls for backend errors and optionally sends them to Sentry
 * ONLY runs for admin users
 */

import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export function BackendErrorMonitor() {
  // CRITICAL: Check admin status first - only admins can access error monitoring
  const isAdmin = useQuery((api as any).admin.isCurrentUserAdmin);
  
  // Only poll for errors if user is confirmed admin
  const errors = useQuery(
    (api as any).admin.errorMonitoring.getRecentErrors,
    isAdmin === true ? { limit: 50, onlyUnresolved: true } : "skip"
  );
  
  const markSentToSentry = useMutation((api as any).admin.errorMonitoring.markSentToSentry);

  useEffect(() => {
    // Don't run if not admin or no errors
    if (!isAdmin || !errors) return;
    
    errors.forEach((error: any) => {
      if (error.sentToSentry) return;
      // Log to console in lieu of Sentry
      console.error("[BackendError]", {
        message: error.error,
        operation: error.operation,
        context: error.context,
      });
      void markSentToSentry({ errorId: error._id as Id<"errorLogs"> });
    });
  }, [isAdmin, errors, markSentToSentry]);

  // This component renders nothing - it just monitors in the background
  return null;
}

