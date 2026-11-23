# Google Search and public catalog pages

Fans and Google receive the same initial HTML for the homepage, artist/show/festival listings, and artist, show, venue and festival details. A show response can contain the artist, venue, date, available setlist, canonical URL and structured data before JavaScript starts. React adds voting, ticket links and live updates. The frontend uses Vite and React Router. [Public routes](../vercel.json) · [Catalog renderer](../convex/http.ts)

## How a request is served

1. A fan or an allowed crawler requests a URL from Vercel. Every incoming request appears in CDN traffic, including cache hits.
2. A cache hit serves the stored HTML. On a miss, Vercel requests that document from Convex. The handler reads stored catalog records and renders them with a local copy of the app template. It makes no request back to Vercel and starts no provider sync.
3. A successful document is fresh for six hours. Vercel may serve the cached document for another hour while refreshing it. A missing entity returns HTTP 404 with a five-minute freshness period. A temporary rendering failure returns an uncached 503. Cache eviction and requests from other regions can cause additional misses.
4. The browser reuses the embedded metadata on startup. In-app navigation handles metadata locally. The former public `/seo-meta` and `/seo/*` endpoints return 410. An interactive visit can still read live data directly from Convex. [HTML handler](../convex/http.ts) · [Page metadata](../src/components/SEOHead.tsx)

## Google access and eligibility

The production firewall's Google Search exception checks the Googlebot user agent, Google's published crawler IP networks, the public host, the request method and the path. It precedes the general crawler deny rule. SE Ranking stays blocked. Separate account and artist-team pages retain their indexing restrictions. A request from an ordinary computer with a Googlebot user agent should return 403 on a catalog page. [Robots policy](../public/robots.txt) · [Google's crawler verification guide](https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot)

Run `python3 scripts/refresh-google-search-networks.py` with an authenticated Vercel CLI that supports `vercel api` to compare the active exception with Google's published ranges. If the ranges differ, rerun with `--apply` to update the IP condition. The rule lives in the Vercel account. A Git deployment alone does not refresh the ranges. [Network maintenance command](../scripts/refresh-google-search-networks.py)

Public pages have individual eligibility rules. For example, a completed show needs at least three recorded songs to qualify for the sitemap. A canonical alias can redirect to the preferred URL. The redirect preserves validated campaign labels and is sent with `no-store` so referral parameters stay with the request that supplied them. An eligible page can still be omitted from Google results. [Eligibility rules](../convex/seoEligibility.ts)

## Sitemap and indexing checks

Convex publishes stable sitemap files for artists, shows, venues and festivals. The weekly job starts Sunday at 04:00 UTC. It processes bounded batches. Each family switches to its new snapshot after its build succeeds. A sitemap request reads the published snapshot. It does not regenerate it or visit the listed URLs. Legacy generation-specific sitemap URLs return 410. [Live sitemap](https://www.setlists.live/sitemap.xml) · [Publisher](../convex/sitemaps.ts) · [Schedule](../convex/crons.ts)

To check a release, choose one real URL from each sitemap family. Inspect its HTTP status, canonical, title, heading and robots directive in the initial HTML. Request it again and check for `x-vercel-cache: HIT`. Also check a missing slug for 404 and an account page for `noindex`. The static Open Graph fallback is served at `/api/og`. [Routing configuration](../vercel.json)

Use the verified site's Google Search Console property to submit the sitemap or check its processing status. URL Inspection shows the last crawl, indexing status and Google's selected canonical. The Performance report shows search impressions and clicks. A sitemap entry, a successful fetch or a `site:` search alone cannot establish rankings. [URL Inspection](https://support.google.com/webmasters/answer/9012289) · [Google's site search limitations](https://developers.google.com/search/docs/monitor-debug/search-operators/all-search-site)
