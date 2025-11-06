import React from 'react';
import * as Sentry from "@sentry/react";
import { Button } from "./ui/button";

// Fallback component for error boundary
function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center space-y-4 max-w-md p-6">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-gray-400">{error?.message || 'An unexpected error occurred'}</p>
        <div className="flex gap-3 justify-center">
          <Button 
            onClick={() => {
              resetError();
              window.location.reload();
            }}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all duration-200 border border-white/20"
          >
            Try Again
          </Button>
          <Button 
            onClick={() => window.location.href = '/'}
            variant="outline"
            className="px-6 py-3"
          >
            Go Home
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          This error has been automatically reported to our team.
        </p>
      </div>
    </div>
  );
}

// Wrap with Sentry's ErrorBoundary for automatic error reporting
const ErrorBoundary = Sentry.withErrorBoundary(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  {
    fallback: ({ error, resetError }) => <ErrorFallback error={error} resetError={resetError} />,
    showDialog: false, // Don't show Sentry's default dialog
    beforeCapture: (scope, error, errorInfo) => {
      // Add additional context before sending to Sentry
      scope.setContext("errorInfo", {
        componentStack: errorInfo.componentStack,
      });
      scope.setLevel("error");
    },
  }
);

export { ErrorBoundary };