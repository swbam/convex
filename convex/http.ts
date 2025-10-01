import { httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";

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

// Clerk webhook - simplified (for production, use Svelte for verification in a Node action)
http.route({
  path: "/webhooks/clerk",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    
    try {
      const event = JSON.parse(body);
      
      // Call internal action for verification and processing (which can use Node.js crypto)
      await ctx.runAction(internal.webhooks.handleClerkWebhook, { event });
      
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("Error", { status: 500 });
    }
  }),
});

export default http;