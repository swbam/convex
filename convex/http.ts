import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// Health check endpoint
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    return new Response(JSON.stringify({ 
      status: "ok", 
      timestamp: Date.now(),
      version: "1.0.0"
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;