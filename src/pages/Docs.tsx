import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MagicCard } from "../components/ui/magic-card";
import { BorderBeam } from "../components/ui/border-beam";
import { Button } from "../components/ui/button";
import { Copy } from "lucide-react";

export function DocsPage() {
  const appUser = useQuery(api.auth.loggedInUser);

  if (appUser === undefined) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="text-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!appUser?.appUser || appUser.appUser.role !== "admin") {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-12">
        <MagicCard className="p-0 rounded-2xl border-0 bg-black">
          <div className="p-6 sm:p-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mb-4">
              <span className="text-red-400 text-2xl">⛔</span>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-white">403 – Admins only</h1>
            <p className="text-gray-400">You don’t have access to API documentation.</p>
          </div>
          <BorderBeam size={80} duration={8} className="opacity-20" />
        </MagicCard>
      </div>
    );
  }

  const convexUrl = (import.meta as any).env.VITE_CONVEX_URL as string | undefined;
  const httpBase = convexUrl || "https://YOUR-DEPLOYMENT.convex.cloud";

  const healthCurl = `curl -i ${httpBase}/health`;
  const clerkCurl = [
    `curl -i -X POST ${httpBase}/webhooks/clerk \\`,
    `  -H 'svix-id: <svix-id>' \\`,
    `  -H 'svix-timestamp: <svix-timestamp>' \\`,
    `  -H 'svix-signature: <svix-signature>' \\`,
    `  -H 'content-type: application/json' \\`,
    `  --data '{ "type": "user.created", "data": { "id": "user_123" } }'`,
  ].join("\n");

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">API Documentation</h1>
      </div>

      {/* HTTP Endpoints */}
      <MagicCard className="p-0 rounded-2xl border-0 bg-black">
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">HTTP Endpoints (Convex)</h2>
            <div className="text-xs text-muted-foreground">Base: {httpBase}</div>
          </div>

          <div className="space-y-6">
            {/* Health */}
            <section className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">
                  GET
                </span>
                <code className="text-sm">/health</code>
              </div>
              <p className="text-sm text-gray-400">
                Health check. Returns JSON {"{ status: \"ok\", timestamp }"}.
              </p>
              <pre className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs overflow-x-auto">
{healthCurl}
              </pre>
              <Button variant="outline" size="sm" onClick={() => copy(healthCurl)}>
                <Copy className="h-4 w-4 mr-2" /> Copy cURL
              </Button>
            </section>

            {/* Clerk Webhook */}
            <section className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/20">
                  POST
                </span>
                <code className="text-sm">/webhooks/clerk</code>
              </div>
              <p className="text-sm text-gray-400">
                Clerk webhooks endpoint (Svix signature headers required). Use for user lifecycle events.
              </p>
              <pre className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs overflow-x-auto">
{clerkCurl}
              </pre>
              <Button variant="outline" size="sm" onClick={() => copy(clerkCurl)}>
                <Copy className="h-4 w-4 mr-2" /> Copy cURL
              </Button>
            </section>
          </div>
        </div>
        <BorderBeam size={120} duration={10} className="opacity-20" />
      </MagicCard>

      {/* Notes */}
      <MagicCard className="p-0 rounded-2xl border-0 bg-black">
        <div className="p-6 sm:p-8">
          <h3 className="text-lg font-semibold mb-3 text-white">Notes</h3>
          <ul className="list-disc list-inside text-sm text-gray-400 space-y-2">
            <li>These endpoints are served by your Convex deployment.</li>
            <li>The base URL matches your app’s configured Convex URL.</li>
            <li>Access to these docs is restricted to admin users.</li>
          </ul>
        </div>
        <BorderBeam size={80} duration={8} className="opacity-10" />
      </MagicCard>
    </div>
  );
}


