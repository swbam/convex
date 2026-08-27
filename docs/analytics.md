# Product analytics

The app uses the `posthog-js` SDK for browser analytics and a small Convex
ingestion action for autonomous backend outcomes. The browser SDK is loaded on
demand, so it is not part of the initial application bundle and cannot block
rendering.

## Configuration

PostHog project: `109917` (US Cloud).

Frontend environments need:

```text
VITE_POSTHOG_KEY=<PostHog project token>
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_POSTHOG_PROJECT_ID=109917
```

Convex environments need:

```text
POSTHOG_PROJECT_TOKEN=<PostHog project token>
POSTHOG_HOST=https://us.i.posthog.com
```

The project token is a public, write-only ingestion token. A PostHog personal
API key must never be put in `VITE_*` variables or browser code.

## Tracking rules

- Event names are lower-case `snake_case`, describe a completed action, and
  remain stable once shipped.
- IDs are sent for joins and breakdowns; typed email addresses, verification
  codes, invite tokens, passwords, auth headers, and search text are not sent.
- Search analytics records query length and result count, not the query itself.
- Session replay masks every form input and all rendered text. Invite-token
  routes disable recording entirely.
- Autocapture is disabled. Product behavior is represented by intentional,
  named events instead of noisy click data.
- `$pageview` is emitted by the React router with `route_name`, `surface`, and a
  query-string-free URL. Invite tokens are replaced with `:token` before any
  URL property leaves the browser.
- Convex lifecycle events are non-blocking. An analytics outage cannot fail a
  claim approval, warmup, cron, or setlist import.
- `analytics_schema_version`, `app_name`, `app_environment`, `device_class`,
  and `event_source` distinguish schemas, deployments, and browser/server data.

## Event catalog

### Discovery and fan activation

| Event | When it fires | Important properties |
| --- | --- | --- |
| `$pageview` | Every client-side route change | `route_name`, `surface`, `page_path` |
| `search_performed` | A settled artist search returns | `context`, `query_length`, `result_count`, `search_type` |
| `search_result_selected` | A result is opened | `result_id`, `result_type`, `result_position`, `result_source` |
| `discovery_filter_changed` | Homepage category/order or artist dashboard tab changes | `context`, `filter_name`, `filter_value` |
| `artist_viewed` | Artist detail loads | `artist_id`, `artist_slug`, `upcoming_show_count` |
| `artist_follow_changed` | Follow state is successfully changed | `artist_id`, `action`, `auth_state` |
| `venue_viewed` | Venue detail and show inventory load | `venue_id`, location, capacity, show counts |
| `show_viewed` | Show detail loads | `show_id`, `artist_id`, `venue_id`, `show_status`, `show_date` |
| `ticket_link_clicked` | Ticketmaster affiliate link is opened | `show_id`, `artist_id`, `placement`, `provider`, `affiliate` |

### Setlist engagement

| Event | When it fires | Important properties |
| --- | --- | --- |
| `song_picker_opened` | Song catalog opens | `show_id`, `artist_id`, `catalog_size`, `auth_state` |
| `song_added` | A song is successfully added | `show_id`, `artist_id`, `setlist_id`, `song_id`, `auth_state` |
| `song_add_rejected` | A valid add attempt is rejected | `show_id`, `song_id`, `reason` |
| `song_vote_changed` | A song vote is successfully added or removed | `show_id`, `setlist_id`, `action`, `vote_count_after`, `auth_state` |
| `anonymous_limit_reached` | A visitor reaches a free add or vote limit | `action_type`, `show_id`, `actions_used`, `free_limit` |
| `official_setlist_imported` | Convex writes a setlist.fm result | `show_id`, `artist_id`, `actual_song_count`, `prediction_accuracy` |
| `official_setlist_viewed` | A fan views a completed official setlist | `show_id`, `artist_id`, `song_count`, `source` |
| `setlist_import_retry_requested` | A user asks Convex to retry an import | `show_id`, `artist_id`, `prior_import_status` |

### Authentication and Spotify connection

| Event | When it fires | Important properties |
| --- | --- | --- |
| `auth_started` | Authentication begins | `auth_method`, `auth_mode`, `source` |
| `auth_completed` | Authentication succeeds | `auth_method`, `auth_mode` |
| `auth_failed` | Authentication fails | `auth_method`, `auth_mode`, `error_type` |
| `account_created` | New account setup succeeds | `auth_method`, `verification_required` |
| `spotify_connect_started` | Spotify linking/import starts | `source`, `mode` |
| `spotify_connect_completed` | Spotify linking/import succeeds | import and correlation counts |
| `spotify_connect_failed` | Spotify linking/import fails | `source`, `error_type` |

### Artist claim and activation

| Event | When it fires | Important properties |
| --- | --- | --- |
| `artist_portal_viewed` | Artist portal resolves the user's access state | access/claim counts, Spotify state |
| `artist_claim_started` | A claim is created or resumed | `artist_id`, `claim_id`, `claim_status`, `resumed` |
| `artist_claim_email_requested` | Verification email is accepted by the backend | `artist_id`, `claim_id` |
| `artist_claim_email_verified` | Verification code succeeds | `artist_id`, `claim_id` |
| `artist_claim_details_saved` | Professional details are saved | role and proof-presence booleans |
| `artist_claim_verification_attempted` | Domain or website verification returns | method, `matched`, `auto_approved` |
| `artist_claim_submitted` | Manual review submission succeeds | role and verification state |
| `artist_claim_approved` | Convex grants membership | method, automatic/manual, role |
| `artist_warmup_completed` | Autonomous claim/catalog/show warmup completes | steps, counts, duration, reason |
| `artist_warmup_failed` | Autonomous warmup fails | reason, error type, duration |
| `artist_dashboard_viewed` | Dashboard data loads | role, show/vote/song summary counts |
| `artist_show_demand_viewed` | A show demand report loads | show status, song count, vote total, report state |
| `artist_team_viewed` | Team settings load | role, member and invite counts |
| `artist_team_invite_created` | Invite creation succeeds | artist and invited role |
| `artist_team_invite_accepted` | Invite acceptance succeeds | artist and assigned role |
| `artist_team_invite_revoked` | Invite revocation succeeds | artist and invited role |
| `artist_team_role_changed` | Member role update succeeds | previous/new role |
| `artist_team_member_removed` | Team member removal succeeds | removed role |

## Funnels to save in PostHog

Use a 14-day conversion window for fan funnels and a 30-day window for artist
onboarding. Start with unique users, then add a second insight using total
conversions when operational volume matters.

1. **Fan discovery to show intent**
   `$pageview` (`route_name = home`) → `search_performed` →
   `search_result_selected` → `artist_viewed` → `show_viewed`.
   Break down by `device_class`, initial referrer/UTM, and result source.

2. **Show voting activation**
   `show_viewed` → `song_picker_opened` → `song_added` →
   `song_vote_changed` (`action = added`). Break down by `auth_state`,
   `device_class`, artist, and show.

3. **Anonymous-to-account conversion**
   `anonymous_limit_reached` → `auth_started` → `auth_completed` →
   `song_vote_changed` or `song_added`. Break down by `action_type`, auth
   method, and device class. This is the primary signup funnel.

4. **Ticket affiliate conversion**
   `show_viewed` → `ticket_link_clicked`. Break down by placement, artist,
   show, device class, and acquisition source. Pair this with Ticketmaster's
   affiliate conversion report because PostHog measures outbound intent, not
   the completed ticket purchase.

5. **Artist claim conversion**
   `artist_portal_viewed` → `artist_claim_started` →
   `artist_claim_email_verified` → `artist_claim_details_saved` →
   `artist_claim_submitted` or `artist_claim_verification_attempted` →
   `artist_claim_approved`. Split automatic and manual approval paths rather
   than forcing them through identical steps.

6. **Artist time-to-value**
   `artist_claim_approved` → `artist_warmup_completed` →
   `artist_dashboard_viewed` → `artist_show_demand_viewed` →
   `artist_team_invite_created`. Track median time between the first three
   steps and break down warmup failures by reason.

7. **Post-show operational journey**
   Chart `official_setlist_imported`, `official_setlist_viewed`, and
   `artist_show_demand_viewed` (`has_post_show_report = true`) as trends. Use
   `show_id` and `artist_id` breakdowns plus import-to-view latency. Do not use
   a person funnel here: the importer, fan, and artist are intentionally
   different identities.

8. **Spotify connection reliability**
   `spotify_connect_started` → `spotify_connect_completed`, with
   `spotify_connect_failed` as a failure trend. Break down by source, mode,
   error type, and device class.

## Launch dashboard

Pin these insights to one launch dashboard:

- Daily/weekly active fans and artists by `surface`.
- Fan voting activation rate and median time to first vote.
- Anonymous limit → account conversion rate.
- Ticket click-through rate by placement and artist.
- Artist claim completion and approval rate by verification method.
- Claim approval → first dashboard and first show-demand view time.
- Warmup success rate, p50/p95 duration, and failure type.
- Official setlist import volume, prediction accuracy, and import-to-view time.
- JavaScript exceptions, dead clicks, LCP, CLS, and INP by route/device.

Exclude internal/test users and localhost traffic from launch reporting.
