/**
 * Backend Error Monitor Component
 * Polls for backend errors and optionally sends them to Sentry
 */

import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import * as Sentry from "@sentry/react";
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

    // Send new backend errors to Sentry
    errors.forEach((error) => {
      if (error.sentToSentry) return;

      // Create Sentry event with backend context
      Sentry.captureException(new Error(error.error), {
        level: error.severity as "error" | "warning" | "info",
        tags: {
          operation: error.operation,
          source: "convex-backend",
        },
        contexts: {
          backend: {
            operation: error.operation,
            timestamp: new Date(error.timestamp).toISOString(),
            ...error.context,
          },
        },
        fingerprint: [
          "backend-error",
          error.operation,
          error.error.substring(0, 100),
        ],
      });

      // Mark as sent
      void markSentToSentry({ errorId: error._id as Id<"errorLogs"> });
    });
  }, [errors, markSentToSentry]);

  // This component renders nothing - it just monitors in the background
  return null;
}

