import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internalRef } from "./adminHelpers";
import { appShell } from "../shared/appShell";
import { renderSeoDocument } from "./seoHtml";
import { resolveSeoPage } from "./seoRoutes";

const http = httpRouter();
const catalogShell = appShell("/app/main.js", "/app/main.css");

function catalogResponse(body: string, status: number, type: string, robots: string, ttl: number) {
  return new Response(body, { status, headers: {
    "Content-Type": type,
    "X-Robots-Tag": robots,
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Vercel-CDN-Cache-Control": `public, max-age=${ttl}, stale-while-revalidate=3600`,
  } });
}

http.route({ pathPrefix: "/catalog-html/", method: "GET", handler: httpAction(async (ctx, request) => {
  const path = new URL(request.url).pathname.slice("/catalog-html".length).replace(/\/+$/, "") || "/";
  if (path !== "/" && !/^\/(?:artists|shows|festivals)(?:\/[^/]{1,540})?$|^\/venues\/[^/]{1,540}$/.test(path)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    // A cache miss may read the catalog. It must never fetch Vercel or start a provider sync.
    const result = await resolveSeoPage({ runQuery: ctx.runQuery.bind(ctx) }, path);
    if (result.redirect) return new Response(null, { status: result.status, headers: {
      Location: result.redirect, "Cache-Control": "public, max-age=300",
    } });
    return catalogResponse(renderSeoDocument(catalogShell, result.page, path), result.status,
      "text/html; charset=utf-8", result.page.robots, result.status === 404 ? 300 : 21600);
  } catch (error) {
    console.error("Public catalog unavailable", error instanceof Error ? error.message : "Unknown error");
    return new Response("Catalog temporarily unavailable", { status: 503, headers: {
      "Cache-Control": "no-store", "Retry-After": "60",
    } });
  }
}) });

http.route({ pathPrefix: "/catalog-map/", method: "GET", handler: httpAction(async (ctx, request) => {
  const name = new URL(request.url).pathname.slice("/catalog-map/".length);
  let xml: string | null;
  if (name === "index.xml") {
    const snapshot = await ctx.runQuery(internalRef.sitemaps.index, {});
    if (!snapshot.ready) return new Response("Sitemap is being prepared", { status: 503, headers: {
      "Cache-Control": "no-store", "Retry-After": "300",
    } });
    xml = snapshot.xml;
  } else {
    const match = /^(artists|shows|venues|festivals)-(0|[1-9][0-9]{0,4})\.xml$/.exec(name);
    if (!match) return new Response("Not found", { status: 404 });
    xml = await ctx.runQuery(internalRef.sitemaps.publishedFile, { kind: match[1], part: Number(match[2]) });
  }
  return catalogResponse(xml || "Not found", xml ? 200 : 404,
    xml ? "application/xml; charset=utf-8" : "text/plain", "noindex, follow", xml ? 21600 : 300);
}) });

const closed = httpAction(async () => new Response("Gone", {
  status: 410,
  headers: { "Cache-Control": "public, max-age=86400", "X-Robots-Tag": "noindex, nofollow" },
}));
http.route({ path: "/robots.txt", method: "GET", handler: httpAction(async () =>
  new Response("User-agent: *\nDisallow: /\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  })) });
http.route({ pathPrefix: "/seo/", method: "GET", handler: closed });
http.route({ path: "/seo-meta", method: "GET", handler: closed });
http.route({ path: "/sitemap.xml", method: "GET", handler: closed });
http.route({ pathPrefix: "/sitemaps/", method: "GET", handler: closed });

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
