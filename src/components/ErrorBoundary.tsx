import React from 'react';
import { AlertCircle, Home, RefreshCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // ENHANCED: Log additional debugging info for production issues
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    });
    
    // Also log to window for easy access in production
    if (typeof window !== 'undefined') {
      (window as any).lastError = {
        error,
        errorInfo,
        timestamp: new Date().toISOString()
      };
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />
          <div className="relative z-10 max-w-md mx-auto text-center">
            {/* ENHANCED: Better error UI with icon and actions */}
            <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-2xl flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-red-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">Something went wrong</h1>
            <p className="text-gray-400 mb-2">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <p className="text-sm text-gray-600 mb-8">
              This error has been logged. Try refreshing or going back home.
            </p>
            {this.state.error && (
              <details className="mt-4 text-left mb-6">
                <summary className="cursor-pointer text-sm text-gray-400 hover:text-white transition-colors">
                  Show error details
                </summary>
                <pre className="mt-2 text-xs bg-white/5 p-3 rounded-lg overflow-auto max-h-64 text-gray-300 border border-white/10">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
                <p className="mt-2 text-xs text-gray-600">
                  Error logged to console. Check window.lastError for full details.
                </p>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all min-h-[44px]"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh Page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: undefined });
                  window.location.href = "/";
                }}
                className="flex items-center gap-2 px-6 py-3 bg-primary/20 hover:bg-primary/30 text-white rounded-xl transition-all min-h-[44px]"
              >
                <Home className="h-4 w-4" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}