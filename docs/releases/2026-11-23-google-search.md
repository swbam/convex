# November 23, 2026 — Google Search and cached catalog pages

The public catalog regained Google Search eligibility after the temporary crawler shutdown. Verified Googlebot can request public catalog pages, their rendering assets and the sitemap. SE Ranking and the general crawler deny rules remain active. Fans and Google receive the same page content. [Production change](https://github.com/swbam/convex/pull/42)

Release checks covered one artist, show, venue and festival page on the public domain. Each returned HTTP 200 with its own heading, canonical and indexing directive. Repeated requests returned Vercel cache hits. A missing artist returned 404, an account page kept its indexing restriction, and requests posing as Googlebot from an unrelated network returned 403. The type checks, all 233 application tests and the frontend build passed.

Convex renders a cache miss from stored catalog data and its local app template. This removes the duplicate Vercel request for the template. Provider schedules continue to run in Convex. Google Search Console is the source for actual indexing and rankings. [SEO runbook](../SEO.md) · [Operations](../OPERATIONS.md)
