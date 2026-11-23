# Product and engineering documentation

This directory contains the current operating documentation for shipped
features. A file in `plans/` describes a proposal. A file in `docs/` describes
behavior that exists in the application.

## Current documents

- [Google Search and public catalog pages](SEO.md) explains eligible routes, the Googlebot exception, shared HTML caching and sitemap maintenance.
- [Deployment and operations](OPERATIONS.md) covers GitHub, Vercel and Convex release checks and request investigation.
- [Catalog sync and scheduling](SYNC_SYSTEM.md) describes the fixed schedules and configurable provider jobs.
- [November 23 show-sharing release](releases/2026-11-23-show-sharing.md) describes exact-performance links and affiliate reporting fields.
- [November 23 Google Search release](releases/2026-11-23-google-search.md) records production verification and its limits.

- [Artist claims and team access](./artist-claims-and-team-access.md): claim
  states, verification rules, admin review, team invitations, security,
  automation, analytics, and release checks.
- [Product analytics](./analytics.md): PostHog configuration, event contracts,
  funnels, and launch reporting.
- [Launch hardening — September 6, 2026](./launch-hardening-2026-09-06.md):
  manual claims, concert timing, partial catalogs, fair setlist-import retries,
  regression coverage, and production rollout requirements.

## Documentation requirement for feature work

Every feature implementation must include a documentation change in the same
branch and commit. Update an existing document when the feature changes an
established workflow. Add a new document when the feature introduces a new
workflow or operating responsibility.

The document must cover the parts that apply:

1. User-visible behavior and supported scenarios.
2. Roles, permissions, and trust decisions.
3. Data model and public or internal function contracts.
4. Background jobs and third-party dependencies.
5. Required environment variables.
6. Analytics events and funnel effects.
7. Failure states, recovery steps, and operator actions.
8. Test cases and release checks.
9. Migration or compatibility behavior.

Do not mark feature work complete when its operating documentation is missing
or still describes an earlier design.

## Superseded plans

`plans/artist-platform-architecture.md` is a historical proposal. Its Spotify
user-ID-to-artist-ID ownership match is not valid and is not the production
trust model. Use
[Artist claims and team access](./artist-claims-and-team-access.md) as the
source of truth.
