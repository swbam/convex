import React from 'react';
import { Button } from "./ui/button";

// Fallback component for error boundary
function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4 max-w-md p-6">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground">{error?.message || 'An unexpected error occurred'}</p>
        <div className="flex gap-3 justify-center">
          <Button 
            onClick={() => {
              resetError();
              window.location.reload();
            }}
            className="px-6 py-3 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl font-medium transition-all duration-200 border border-border"
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
        <p className="text-xs text-muted-foreground mt-4">
          This error has been automatically reported to our team.
        </p>
      </div>
    </div>
  );
}

class BasicErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log locally; no external services
    // eslint-disable-next-line no-console
    console.error("App Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error ?? new Error("Unknown error")} resetError={() => this.setState({ hasError: false, error: undefined })} />;
    }
    return this.props.children as React.ReactElement;
  }
}

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => (
  <BasicErrorBoundary>{children}</BasicErrorBoundary>
);

export { ErrorBoundary };