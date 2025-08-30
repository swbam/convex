import React from 'react';

export function DiagnosticApp() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">App Diagnostic</h1>
        
        <div className="space-y-6">
          <div className="halo-card p-6">
            <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">VITE_CONVEX_URL:</span>
                <span className={`ml-2 ${convexUrl ? 'text-green-400' : 'text-red-400'}`}>
                  {convexUrl || 'MISSING'}
                </span>
              </div>
              <div>
                <span className="font-medium">VITE_CLERK_PUBLISHABLE_KEY:</span>
                <span className={`ml-2 ${clerkKey ? 'text-green-400' : 'text-red-400'}`}>
                  {clerkKey ? 'SET' : 'MISSING'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="halo-card p-6">
            <h2 className="text-xl font-semibold mb-4">Browser Info</h2>
            <div className="space-y-2 text-sm">
              <div>User Agent: {navigator.userAgent}</div>
              <div>URL: {window.location.href}</div>
              <div>Origin: {window.location.origin}</div>
            </div>
          </div>
          
          <div className="halo-card p-6">
            <h2 className="text-xl font-semibold mb-4">App Status</h2>
            <div className="text-green-400">
              ✅ App is loading and rendering successfully
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
