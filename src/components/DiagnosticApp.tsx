import React from 'react';

export function DiagnosticApp() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">App Diagnostic</h1>
        
        <div className="space-y-6">
          <div className="bg-card rounded-xl p-6 border border-border p-6">
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
          
          <div className="bg-card rounded-xl p-6 border border-border p-6">
            <h2 className="text-xl font-semibold mb-4">Browser Info</h2>
            <div className="space-y-2 text-sm">
              <div>User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'Not available'}</div>
              <div>URL: {typeof window !== 'undefined' ? window.location.href : 'Not available'}</div>
              <div>Origin: {typeof window !== 'undefined' ? window.location.origin : 'Not available'}</div>
            </div>
          </div>
          
          <div className="bg-card rounded-xl p-6 border border-border p-6">
            <h2 className="text-xl font-semibold mb-4">App Status</h2>
            <div className="text-green-400">
              ✅ App is loading and rendering successfully
            </div>
          </div>
          
          <div className="bg-card rounded-xl p-6 border border-border p-6 border-red-500">
            <h2 className="text-xl font-semibold mb-4 text-red-400">Action Required</h2>
            <div className="space-y-2 text-sm">
              <p className="text-red-400 font-medium">Environment variables are missing!</p>
              <p>To fix this issue:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Go to your Vercel Dashboard</li>
                <li>Navigate to Settings → Environment Variables</li>
                <li>Add the missing variables shown above</li>
                <li>Redeploy your application</li>
              </ol>
              <p className="mt-4 text-yellow-400">
                For local development, create a .env.local file with these variables.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
