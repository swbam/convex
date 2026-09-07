# Launch hardening — September 6, 2026

Status: local implementation verified; production rollout authorized and in
progress. Convex schema/functions deployed to `exuberant-weasel-22` on September
6, 2026. The frontend release and live checks are recorded separately below.
Passing local tests alone is not evidence of a successful production rollout.

## Scope

Keep React/Vite, the existing authentication integration, Convex, the current
provider import functions, cron orchestrator, caches, voting, and artist access
tables. No new queue service, authentication migration, billing system, or
artist-profile ownership claim through Spotify has been introduced.

This workspace already contained substantial uncommitted claim, invitation,
SEO, routing, and configuration changes. Those changes were preserved. This
document describes the hardening added on top, not a claim that every existing
change or every launch requirement was implemented in this pass.

## 1. Manual artist claims

- Any signed-in app user may start a claim, with or without Spotify linking.
- Verify a mailbox, enter professional details, optionally collect domain or
  website-code evidence, then submit for review.
- Neither a submitted domain nor a previously reviewed domain auto-approves.
- An admin must explicitly choose owner, manager, or viewer; the applicant’s
  stated role is evidence, not an authorization rule.
- Approval schedules membership activation, decision email, analytics, and the
  existing artist warmup. Repeated approval does not duplicate those effects.
- Existing team invitations and the admin-only quick-claim support path remain.

Email codes are omitted from public query responses. Email sends atomically
reserve cooldown/rate-limit capacity before provider I/O. A failed delivery
clears only its own code. Changing the email or claim details invalidates old
proof; a revision check discards stale website verification responses.

The admin role selector uses the existing component styling and reduced-motion
behavior. The applicant UI no longer has an automatic-verification success path.
See [claim scenarios and review runbook](./artist-claims-and-team-access.md).

The admin shell previously referenced several nonexistent Convex functions,
including queries mounted alongside the claim queue. Those references now point
to existing public admin, cron-settings, sync-job, and error-monitoring APIs.
The shell opens on Artist Claims and subscribes to other reports only when their
section is selected, so claim reviews do not depend on unrelated report queries.
Product analytics links to PostHog instead of calling a nonexistent analytics
query. Existing operations were rebound, not executed against production.

### Account and Spotify integration repairs

The current checkout mounts Clerk in `src/main.tsx`; this pass does not introduce
or migrate an auth provider. The invalid browser `user.getToken` calls have been
replaced by authenticated `spotifyOAuth.importLinkedSpotify`. It derives the
user from the Convex identity, retrieves that user's linked OAuth token through
the existing server-side `CLERK_SECRET_KEY`, and calls the existing import flow.
It never returns the OAuth token, guesses refresh tokens or expiry, or grants
artist membership. Provider failures preserve cached account data. Empty but
successful imports are distinguished from failed imports in analytics.

This follows the provider's [server-side OAuth token API](https://clerk.com/docs/reference/backend/user/get-user-oauth-access-token).
Clerk-managed credentials remain managed by Clerk; the existing stored-token
refresh cron is retained for separately stored Spotify credentials. Followed
and top-artist imports retain their existing 50-item limits; this change does
not claim a full listener-library migration. Automatic login import attempts
wait for the app user and do not immediately repeat after a failure; explicit
retry remains available.

User-editable `unsafeMetadata.role` / `unsafe_metadata.role` can no longer
elevate a platform user through app-user creation/sync or webhook handlers.
Admin-managed metadata and trusted role claims remain supported. Existing
admins are not automatically demoted: audit their provenance before rollout,
because fixing the write path does not undo any previously granted access.

The frontend compatibility cleanup also repairs the profile/security entry,
Spotify provider checks, public artist-show refresh binding, error fallback
props, blog image types/builders, and animation easing types. Existing branding
and animation behavior are retained; this is not a new visual redesign.

## 2. Concert-local timing and ordering

Ticketmaster ingestion now persists optional `shows.startsAt`, `endsAt`, and
`timeZone`. Only timestamps with an explicit UTC offset are parsed as instants.

Completion policy:

1. If provider start/end instants exist, wait until one hour after the end.
2. If only a start instant exists, wait six hours after it.
3. If only the local date and timezone exist, wait until 06:00 the next local day.
4. Without a timezone, use a conservative date + 42-hour UTC fallback.

These buffers are completion heuristics, not actual concert-duration claims.
Cancellations remain cancelled. Invalid dates do not become completed. The
status sweep paginates in batches of 200 rather than scanning all overdue shows
in one transaction. New imports no longer become completed at UTC midnight.

The production browser smoke check also caught a date-only rendering bug:
`new Date("2026-09-18")` appeared as September 17 in US browsers. Artist rows,
show cards, and show headers now use a shared calendar-date formatting anchor.
This changes display only, not stored show dates or actual start instants.

The artist dashboard selects upcoming shows from `by_artist_status_and_date`
before applying its 100-show limit, so the earliest shows cannot be excluded by
creation order.

Existing production records are not retroactively repaired by editing code.
Existing artist refreshes will populate provider timing fields when those
events are returned. Same-night records incorrectly marked completed before
this release require an inspected, targeted repair; no bulk production rewrite
was run here. Missing-time records use the conservative fallback meanwhile.

## 3. Catalog correctness and recovery

The existing Spotify pagination, album/track filters, deduplication, and
song/artistSong upserts are retained. This is still the app’s filtered studio
catalog, not a promise to import every regional Spotify recording or edition.

`catalogSync.begin` atomically claims the existing per-artist job. Active imports
cannot start a second copy. A syncing job abandoned for 30 minutes can recover.
The existing refresh windows remain 24 hours for completed catalogs and one
hour for incomplete attempts; the three-failure/72-hour circuit breaker remains.

`catalogSync.finish` accepts only the current attempt and stores:

- `catalogSyncStatus`: completed, partial, or failed.
- `catalogSyncResult`: album and track counts, failure IDs, and optional error.
- Last complete catalog freshness, plus failure/backoff state.

Failed album requests and individual track writes cannot produce a completed
result. Last-complete freshness advances only after a fully successful run.
Failures do not delete cached songs. Success explicitly clears stale backoff
and failure timestamps. Diagnostic failure-ID lists are capped at 100; total
failure counts remain complete. A later attempt still uses the existing full
filtered-catalog walk rather than a new per-album queue.

The Ticketmaster tracking wrapper reads the persisted catalog outcome rather
than assuming a non-throwing action means success.

## 4. Actual-setlist imports

The existing `check-completed-shows` cron changes from every six hours to every
two hours. Each run admits at most 20 first attempts and 10 retries, with the
existing two-second spacing and provider retry behavior. This is a bounded
drain budget, not a guarantee that 30 imports complete per run.

New optional show fields are `importNextAttemptAt`, `importLastAttemptAt`, and
`importAttemptCount`, indexed by `by_status_import_due`.

- A bounded, paginated bootstrap initializes recent legacy records.
- The retry window remains 14 days. Older backlog needs a deliberate backfill.
- First attempts and retries have separate capacity. Due time, not unrelated
  `lastSynced` edits or newest-show creation order, drives selection.
- Not-found responses wait 24 hours; failures wait one hour.
- A per-show reservation prevents cron/managed-warmup duplicate work and
  recovers interrupted imports after a one-hour lease.
- A 15-minute poller lock prevents overlapping periodic runs. The loop stops
  admitting work after four minutes to leave time for its final request.
- A late failure cannot overwrite an already confirmed actual-setlist import.

Search matching requires the concert-local date, artist identity, city, and
matching venue name. Adjacent-night guesses and ambiguous first-result imports
are removed. Conservative matching may leave renamed venues unresolved; it is
preferable to attaching another concert’s songs. Historical imports also avoid
overwriting a different venue’s same-day show.

Empty official imports are rejected. Fan predictions and actual setlists remain
separate; importing actual songs preserves the prediction and comparison.

This does not implement a provider-wide distributed quota limiter. Before
releasing the shorter interval, check the account’s actual setlist.fm allowance
and combined history-import traffic. No universal daily quota is assumed.

## 5. Honest analytics

`official_setlist_imported` is scheduled transactionally from all three actual
write paths: show import, artist-history import, and actual-setlist update.
Repeating an already imported source ID does not create another event. Existing
historical imports are not backdated or replayed into analytics.

Warmup emits `artist_warmup_partial` when catalog/show freshness is unresolved,
including when a provider action returns without throwing. Completed warmup
means those foreground stages are fresh; scheduled history imports can still
be pending. `incomplete_stages`, `catalog_status`, and `imports_pending` make
that distinction explicit. Inspect partial outcomes alongside the activation
funnel instead of treating them as completed activations.

The production PostHog launch dashboard (project 109917, dashboard 2040675) now
tracks evidence collection instead of automatic approval, accepts manual approval
without the retired `automatic` property, and charts `artist_warmup_partial`.
Existing dashboards/insights were updated in place. No synthetic fan or artist
conversion events were created; new events require real activity.

## Validation and release

Regression tests live in `src/lib/launchHardening.test.ts`, using the actual
Convex schema, function handlers, authentication checks, scheduler records, and
local transaction-limit enforcement through `convex-test`.

They cover claim access, role selection, secret-code redaction, concurrent
resends, expiry, stale responses, delivery cleanup, date boundaries/DST,
pagination, nearest-show selection, partial catalogs, interrupted job recovery,
retry fairness, conservative setlist matching, prediction preservation, and
idempotent import events. Tests do not send real email or call provider APIs.

Run the complete local gates:

```sh
npm run test:run
npm run build:check
npm run build
```

### Verification outcome

- All 50 automated tests pass, including 31 backend hardening tests and three
  additional calendar-date display regressions.
- `npm run build:check` passes both Convex and explicit frontend/config checks.
- The Vite production bundle builds successfully.
- `git diff --check` passes.
- The original `build:check` falsely passed the frontend: its root tsconfig has
  no files, and `tsc -p .` does not build its referenced projects. It now calls
  the explicit `check:frontend` script for both frontend/config projects.
- The errors uncovered by the real frontend check have been corrected; no
  tsconfig exclusions or blanket error suppression were added to bypass it.
- OAuth and role-trust regression tests use mock provider responses. They do
  not establish that real OAuth redirects, email delivery, or mobile Safari
  interactions work in the deployed environment. Those remain smoke tests.

### Dependency audit follow-up

The installed dependency graph still reports 52 advisories with
`npm audit --omit=dev` (7 critical, 30 high, 13 moderate, 2 low), as checked on
September 6. Some testing/build tools are declared as production dependencies,
so these counts are not an assessment that every advisory is remotely exploitable
in the shipped app. Direct affected packages include the existing auth SDKs,
router, Sanity, and build/test tooling. Review runtime reachability and upgrade
in a separate controlled pass before declaring the app launch-certified.
No `npm audit fix --force` or major-version migration was performed here.

Production release checklist:

- Review and stage the intended combined code changes; exclude local secrets
  and unrelated editor/MCP configuration. Commit and push the reviewed release.
- Deploy schema/functions to the intended Convex production deployment first,
  then release the frontend. Old clients remain compatible with the retained
  optional claim argument, but legacy unverified pending claims cannot approve.
- No new environment keys are required. Verify the existing auth, provider,
  Resend, owner-notification, and PostHog configuration in its actual deployment.
  Linked Spotify retrieval requires the already named `CLERK_SECRET_KEY` in
  Convex, never in the browser. Also verify the actual linked-account scopes.
- Run a real non-Spotify claim, verification email, manual approval, dashboard,
  and team-invite smoke test using controlled accounts.
- Confirm bootstrap continuation, due-time indexes, provider quota usage,
  import outcomes, and new analytics events in production.
- Inspect prematurely completed legacy shows before authorizing targeted repair.
- Audit existing platform-admin accounts and address reachable dependency
  advisories; neither is automatically repaired by this implementation.
- Confirm provider commercial-use permissions and own the under-24-hour beta
  review process. Code changes cannot grant those external approvals.

The npm lockfile is currently ignored by the repository; the new test dependency
is exactly pinned in package.json. This pass does not claim reproducible
transitive installs, a dependency-vulnerability remediation, a complete SEO
hydration release, or a universal launch/performance certification.
