import React from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import "./index.css";
import { router } from "./router";
import { DiagnosticApp } from "./components/DiagnosticApp";
import { Toaster } from "./components/ui/sonner";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

// Sentry removed

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
    
    // CRITICAL FIX: Custom useAuth that requests JWT with template name "convex"
    const useAuth = () => {
      const auth = useClerkAuth();
      return React.useMemo(
        () => ({
          ...auth,
          // Request the Convex JWT template without logging or decoding tokens
          // in production browser sessions.
          getToken: async (args?: any) =>
            await auth.getToken({ ...args, template: "convex" }),
        }),
        [auth]
      );
    };

    createRoot(rootElement).render(
      <React.StrictMode>
        <ThemeProvider 
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ClerkProvider 
            publishableKey={publishableKey}
            afterSignOutUrl="/"
            appearance={{
              elements: {
                // Hide CAPTCHA if it's causing issues
                captcha: 'hidden',
              },
            }}
          >
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
              <React.Suspense
                fallback={
                  <div className="flex min-h-dvh items-center justify-center bg-background text-foreground">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground motion-reduce:animate-none" />
                  </div>
                }
              >
                <RouterProvider router={router} />
              </React.Suspense>
              <Toaster 
                position="bottom-right"
                richColors
              />
            </ConvexProviderWithClerk>
          </ClerkProvider>
        </ThemeProvider>
      </React.StrictMode>,
    );
  } catch (error) {
    console.error('Failed to initialize app:', error);
    createRoot(rootElement).render(<DiagnosticApp />);
  }
}
