import React from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "./router";
import { DiagnosticApp } from "./components/DiagnosticApp";
import { Toaster } from "./components/ui/sonner";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

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

    createRoot(rootElement).render(
      <React.StrictMode>
        <ClerkProvider 
          publishableKey={publishableKey} 
          afterSignOutUrl="/" 
          signInUrl="/signin"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
          signInForceRedirectUrl="/"
          signUpForceRedirectUrl="/"
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
      </React.StrictMode>,
    );
  } catch (error) {
    console.error('Failed to initialize app:', error);
    createRoot(rootElement).render(<DiagnosticApp />);
  }
}