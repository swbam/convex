/**
 * Backend Error Monitor Component
 * Polls for backend errors and optionally sends them to Sentry
 */

import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export function BackendErrorMonitor() {
  // Poll for unsent errors every 30 seconds
  const errors = useQuery(api.admin.errorMonitoring.getRecentErrors, {
    limit: 50,
    onlyUnresolved: true,
  });
  
  const markSentToSentry = useMutation(api.admin.errorMonitoring.markSentToSentry);

  useEffect(() => {
    if (!errors) return;
    errors.forEach((error) => {
      if (error.sentToSentry) return;
      // Log to console in lieu of Sentry
      console.error("[BackendError]", {
        message: error.error,
        operation: error.operation,
        context: error.context,
      });
      void markSentToSentry({ errorId: error._id as Id<"errorLogs"> });
    });
  }, [errors, markSentToSentry]);

  // This component renders nothing - it just monitors in the background
  return null;
}

