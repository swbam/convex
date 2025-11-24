import { httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

const http = httpRouter();

// Health check endpoint
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    return new Response(JSON.stringify({ 
      status: "ok", 
      timestamp: Date.now()
    }), {
      headers: { 
        "Content-Type": "application/json",
      },
    });
  }),
});

// Clerk webhook with Svix signature verification
http.route({
  path: "/webhooks/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    
    try {
      const event = JSON.parse(body);
      
      // Extract Svix headers for signature verification
      const svixId = request.headers.get('svix-id');
      const svixTimestamp = request.headers.get('svix-timestamp');
      const svixSignature = request.headers.get('svix-signature');
      
      // Call internal action for verification and processing (per-plan verification happens inside the action)
      try {
        await ctx.runAction(internalRef.webhooks.handleClerkWebhook, { 
          event,
          svixId: svixId || undefined,
          svixTimestamp: svixTimestamp || undefined,
          svixSignature: svixSignature || undefined,
          rawBody: body,
        });
      } catch (e: any) {
        // Map authorization failures to 401
        if (e && typeof e.message === 'string' && e.message === 'UNAUTHORIZED') {
          return new Response("Unauthorized", { status: 401 });
        }
        throw e;
      }
      
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("Error", { status: 500 });
    }
  }),
});

export default http;