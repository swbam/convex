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

// Dynamic sitemap.xml generation
http.route({
  path: "/sitemap.xml",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const baseUrl = "https://www.setlists.live";
    
    // Fetch all artists, shows, and festivals for the sitemap
    const [artists, shows, festivals] = await Promise.all([
      ctx.runQuery(internalRef.artists.getAllSlugs),
      ctx.runQuery(internalRef.shows.getAllSlugs),
      ctx.runQuery(internalRef.festivals.getAllSlugs),
    ]);
    
    const staticPages = [
      { loc: "/", priority: "1.0", changefreq: "daily" },
      { loc: "/artists", priority: "0.9", changefreq: "daily" },
      { loc: "/shows", priority: "0.9", changefreq: "daily" },
      { loc: "/trending", priority: "0.8", changefreq: "hourly" },
      { loc: "/festivals", priority: "0.8", changefreq: "weekly" },
      { loc: "/blog", priority: "0.8", changefreq: "daily" },
      { loc: "/about", priority: "0.5", changefreq: "monthly" },
      { loc: "/privacy", priority: "0.3", changefreq: "monthly" },
      { loc: "/terms", priority: "0.3", changefreq: "monthly" },
    ];
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add static pages
    for (const page of staticPages) {
      xml += `
  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    }
    
    // Add artist pages
    for (const slug of artists || []) {
      xml += `
  <url>
    <loc>${baseUrl}/artists/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }
    
    // Add show pages
    for (const slug of shows || []) {
      xml += `
  <url>
    <loc>${baseUrl}/shows/${slug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
    }
    
    // Add festival pages
    for (const slug of festivals || []) {
      xml += `
  <url>
    <loc>${baseUrl}/festivals/${slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }
    
    xml += `
</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  }),
});

export default http;