# Deployment and operations

The production website runs on Vercel. Convex serves the catalog and runs scheduled provider syncs. GitHub Actions checks documentation links, types, tests and builds on pull requests and pushes to `main`. Vercel builds the frontend from the production branch. A Convex backend release is a separate deployment. [CI workflow](../.github/workflows/ci.yml) · [Project commands](../package.json)

## Check a release

Use Node.js 24 and the committed npm lockfile. From a clean checkout, run the same application checks used by CI and the repository documentation check.

```sh
npm ci
npm run docs:check
npm run build:check
npm run test:run
npm run build
```

For backend changes, confirm the intended Convex deployment before running a dry run. Review the schema and function changes, then deploy the compatible backend before publishing clients that depend on it. For frontend changes, verify the production alias for both the apex and www domains and compare the deployment commit with GitHub. The `all` script also triggers production trending work. [Convex configuration](../convex.json) · [Frontend routing](../vercel.json) · [Post-deployment script](../scripts/post-deploy.sh)

Keep provider secrets in their deployment environments. Only public browser configuration belongs in `VITE_*` variables. The optional US Ticketmaster Impact tracking link comes from the approved agreement. Changing a Vite environment value requires rebuilding the frontend. [Environment template](../.env.example) · [Ticket destination builder](../src/utils/ticketmaster.ts)

## Investigate a request spike

Use the same project, production environment and time range for each comparison. A single page visit can issue additional requests for JavaScript, styles and images.

| Measurement | What to check |
| --- | --- |
| Vercel CDN requests | Group by path, bot name, status and cache result. A request served from cache counts here. Inspect firewall-denied requests separately when assessing billable usage. |
| Vercel function invocations | Check whether any frontend functions actually ran in the same time window. |
| Convex callbacks to Vercel | Inspect incoming Vercel requests with the client user agent `Convex/1.0`. The catalog renderer should never fetch the site's HTML template over the network. |
| Convex function executions | Compare catalog HTML requests and reads with scheduled provider jobs. A site visit and a sync job have different entry points. |
| Billing | Use the plan's usage report for billable requests and transfer. Raw traffic totals alone cannot establish a charge. |

For a single popular URL, repeat a normal GET and inspect `x-vercel-cache`. If every request to the same URL and region stays a miss, check the upstream cache headers and Vercel's external rewrite caching setting before changing the sync schedule. [Google Search and cache behavior](SEO.md) · [Vercel rewrite caching](https://vercel.com/docs/rewrites) · [Firewall usage](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing)

## Provider syncs

Ticketmaster supplies event records, Spotify enriches artist and song catalogs, and setlist.fm supplies recorded performances. Convex updates this data independently of whether Google or a fan visits the site. Inspect the affected job and provider budget before retrying an import. Sitemaps are generated from stored records. [Sync schedule](SYNC_SYSTEM.md)
