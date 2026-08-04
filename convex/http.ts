import { httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";
import { internalRef } from "./adminHelpers";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any


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
const EMPTY_URLSET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

// Format a ms timestamp as YYYY-MM-DD for <lastmod>
const toLastmod = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// Fetch published blog post slugs from Sanity's public CDN API (5s timeout).
// Returns [] on any failure so the sitemap never breaks because of the blog.
async function fetchBlogSlugs(): Promise<{ slug: string; publishedAt?: string }[]> {
  try {
    const groq = `*[_type == "post" && publishedAt < now()][0...400]{"slug": slug.current, publishedAt}`;
    const url = `https://i4wz0fvl.apicdn.sanity.io/v2023-01-01/data/query/production?query=${encodeURIComponent(groq)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.result)) return [];
    return data.result.filter(
      (p: any): p is { slug: string; publishedAt?: string } =>
        typeof p?.slug === "string" && p.slug.length > 0
    );
  } catch {
    return []; // skip blog URLs silently
  }
}

http.route({
  path: "/sitemap.xml",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const baseUrl = "https://www.setlists.live";

    try {
      // Fetch indexable artists, shows, festivals, and blog posts.
      // Each query is bounded; total URL count stays well under 10k.
      const [artists, shows, festivals, blogPosts] = await Promise.all([
        ctx.runQuery(internalRef.artists.getAllSlugs) as Promise<
          { slug: string; lastmod?: number }[]
        >,
        ctx.runQuery(internalRef.shows.getAllSlugs) as Promise<
          { slug: string; date: string; lastmod: number }[]
        >,
        ctx.runQuery(internalRef.festivals.getAllSlugs) as Promise<
          { slug: string; lastmod?: number }[]
        >,
        fetchBlogSlugs(),
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

      // Add artist pages (bounded at 5000 by the query)
      for (const artist of artists || []) {
        xml += `
  <url>
    <loc>${baseUrl}/artists/${artist.slug}</loc>${
      artist.lastmod
        ? `
    <lastmod>${toLastmod(artist.lastmod)}</lastmod>`
        : ""
    }
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
      }

      // Add show pages (upcoming + last ~180 days, bounded at 4000 by the query)
      for (const show of shows || []) {
        xml += `
  <url>
    <loc>${baseUrl}/shows/${show.slug}</loc>${
      show.lastmod
        ? `
    <lastmod>${toLastmod(show.lastmod)}</lastmod>`
        : ""
    }
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
      }

      // Add festival pages (small table, bounded at 500 by the query)
      for (const festival of festivals || []) {
        xml += `
  <url>
    <loc>${baseUrl}/festivals/${festival.slug}</loc>${
      festival.lastmod
        ? `
    <lastmod>${toLastmod(festival.lastmod)}</lastmod>`
        : ""
    }
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
      }

      // Add blog posts from Sanity (bounded at 400; skipped on fetch failure)
      for (const post of blogPosts) {
        const lastmod =
          post.publishedAt && !Number.isNaN(Date.parse(post.publishedAt))
            ? toLastmod(Date.parse(post.publishedAt))
            : null;
        xml += `
  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>${
      lastmod
        ? `
    <lastmod>${lastmod}</lastmod>`
        : ""
    }
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
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
    } catch (error) {
      // A 500 sitemap is worse than a sparse one — return a valid empty urlset.
      console.error("Sitemap generation failed:", error);
      return new Response(EMPTY_URLSET, {
        status: 200,
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "public, max-age=300",
        },
      });
    }
  }),
});

export default http;