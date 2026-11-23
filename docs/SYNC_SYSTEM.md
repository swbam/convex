# Catalog sync and scheduling

Convex owns artist discovery, upcoming-show refreshes, song catalogs, festival maintenance and completed-show imports. The Google Search renderer reads the resulting records. It neither calls those providers nor traverses the public website. [Provider orchestrator](../convex/cronOrchestrator.ts) · [Public catalog reads](../convex/publicSeo.ts)

## Production job definitions

| Work | Schedule or trigger |
| --- | --- |
| Configurable jobs, including touring and trending refresh | The orchestrator checks for due jobs every ten minutes. Effective intervals and enablement come from job settings. |
| Completed-show setlist imports | Every two hours, with bounded admission and retry handling. Expired retry work is retired daily at 03:30 UTC. |
| Live-setlist pilot and artist notification recovery | Every five minutes, through separate recovery jobs. |
| Festival status and prediction setlist maintenance | Daily at 05:00 and 06:00 UTC, respectively. |
| Partial festival lineup refresh and festival image refresh | Sunday at 07:00 UTC and Monday at 08:00 UTC, respectively. |
| Stable Google sitemap snapshots | Sunday at 04:00 UTC. A page request reads the published snapshot. |

A scheduled tick can have no due work. Check job outcomes, provider backoff and the age of the affected records when diagnosing freshness. Check Vercel's cache status separately if stored data is current but the initial HTML is stale. [Fixed jobs](../convex/crons.ts) · [Sitemap batches](../convex/sitemaps.ts) · [Deployment and traffic checks](OPERATIONS.md)
