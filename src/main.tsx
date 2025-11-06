import React from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { RouterProvider } from "react-router-dom";
import * as Sentry from "@sentry/react";
import "./index.css";
import { router } from "./router";
import { DiagnosticApp } from "./components/DiagnosticApp";
import { Toaster } from "./components/ui/sonner";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

// Initialize Sentry for error tracking and performance monitoring
Sentry.init({
  dsn: "https://7a0b4270ce0837a16efc62a1f9e7493b@o4509554346754048.ingest.us.sentry.io/4510320697081856",
  
  // Performance Monitoring
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  
  // Performance monitoring sample rate (1.0 = 100% of transactions)
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  
  // Session Replay sampling rates
  replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
  
  // Send default PII (personally identifiable information)
  sendDefaultPii: true,
  
  // Environment configuration
  environment: import.meta.env.MODE,
  
  // Release tracking (optional - can be set via CI/CD)
  // release: "setlists-live@" + packageJson.version,
  
  // Ignore specific errors
  ignoreErrors: [
    // Browser extensions
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    // Network errors
    'NetworkError',
    'Failed to fetch',
  ],
  
  // Before sending events, filter or modify them
  beforeSend(event, hint) {
    // Don't send events in development if you prefer
    if (!import.meta.env.PROD && !import.meta.env.VITE_SENTRY_DEBUG) {
      console.log('[Sentry] Would send event:', event);
      return null;
    }
    return event;
  },
});

// Safety check for DOM availability
if (typeof document === 'undefined') {
  throw new Error('Document is not available - this should only run in the browser');
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found in DOM');
}

// Show diagnostic if environment variables are missing
if (!convexUrl || !publishableKey) {
  console.error("Missing environment variables:", { convexUrl: !!convexUrl, publishableKey: !!publishableKey });
  createRoot(rootElement).render(<DiagnosticApp />);
} else {
  try {
    const convex = new ConvexReactClient(convexUrl);
    
    // CRITICAL FIX: Custom useAuth that requests JWT with template name "setlistslive"
    const useAuth = () => {
      const auth = useClerkAuth();
      return React.useMemo(
        () => ({
          ...auth,
          getToken: async (args?: any) => {
            // Request JWT with default template name "convex"
            return await auth.getToken({ ...args, template: "convex" });
          },
        }),
        [auth]
      );
    };

    // Wrap router with Sentry for performance monitoring
    const SentryRouter = Sentry.withSentryRouting(RouterProvider);

    createRoot(rootElement).render(
      <React.StrictMode>
        <ClerkProvider 
          publishableKey={publishableKey}
          afterSignOutUrl="/"
        >
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <SentryRouter router={router} />
            <Toaster 
              theme="dark"
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
                },
              }}
            />
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </React.StrictMode>,
    );
  } catch (error) {
    console.error('Failed to initialize app:', error);
    createRoot(rootElement).render(<DiagnosticApp />);
  }
}