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
              <RouterProvider router={router} />
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
        </ThemeProvider>
      </React.StrictMode>,
    );
  } catch (error) {
    console.error('Failed to initialize app:', error);
    createRoot(rootElement).render(<DiagnosticApp />);
  }
}