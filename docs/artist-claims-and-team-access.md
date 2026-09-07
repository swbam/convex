# Artist claims and team access

Status: implemented locally. Production deployment is tracked separately.

This document is the source of truth for claiming an artist, granting artist
dashboard access, reviewing claims, inviting team members, and warming artist
data after access is granted.

## Product rule

Spotify linking is optional enrichment. It is not proof that a person controls
a Spotify artist profile. A Spotify user ID and a Spotify artist ID identify
different entity types, so the application never compares them to grant artist
ownership.

Artist access comes from one of two records:

- An `artistMembers` record created after an approved claim.
- An `artistMembers` record created after an email-bound team invitation is
  accepted.

The application does not add an artist role to `users.role`. Platform admin
access stays on `users.role`. Artist-specific access stays in `artistMembers`.

Platform privileges must come from trusted role claims or admin-managed metadata,
never user-editable `unsafeMetadata`. The app-user and webhook paths ignore
user-editable role fields. Previously granted admin roles require an operator
audit; they are not silently removed by a code deployment.

## Routes

| Route | Purpose | Access |
| --- | --- | --- |
| `/for-artists` | Artist entry point, access lookup, claim search | Signed-in users |
| `/for-artists/claim/:artistId` | Claim and verification flow | Claim owner |
| `/for-artists/:artistId` | Artist dashboard | Artist member |
| `/for-artists/:artistId/shows/:showId` | Per-show demand report | Artist member |
| `/for-artists/:artistId/team` | Team and invitation management | Artist member, with owner-only changes |
| `/for-artists/invite/:token` | Invitation preview and acceptance | Public preview and signed-in acceptance |
| `/studio/*` | Legacy route | Redirects to `/for-artists` |

`artistAccess.getMyArtistAccess` is the canonical portal access query. It reads
`artistMembers` and returns the accessible artists and each membership role.

## Roles and permissions

| Membership role | Dashboard | Show demand | View team | Invite/revoke | Change role/remove member |
| --- | --- | --- | --- | --- | --- |
| `owner` | Yes | Yes | Yes | Yes | Yes, except another owner |
| `manager` | Yes | Yes | Yes | No | No |
| `viewer` | Yes | Yes | Yes | No | No |

Owners cannot remove themselves or another owner. Managers and viewers can
leave a team. Ownership transfer is not implemented, so an owner cannot leave
through the current team mutation.

These are review guidelines, not an automatic claim-to-membership mapping:

| Claimed professional role | Membership role |
| --- | --- |
| `artist` | `owner` |
| `manager`, `agent` | `manager` |
| `label`, `publicist`, `team` | `viewer` |

An admin must explicitly select the membership role during manual approval. The
applicant’s self-selected professional role never assigns dashboard permissions.

## Claim state machine

```text
draft -> verifying -> pending -> approved
                         |          ^
                         +-> rejected
```

- `draft`: the signed-in user selected an artist and started a claim.
- `verifying`: a verification email was delivered and a code is pending or the
  user is adding professional evidence.
- `pending`: the claim was submitted for admin review.
- `approved`: an artist membership was granted.
- `rejected`: an admin rejected the submitted evidence. The user can start a
  new claim.

A user with an existing membership cannot create another claim for the same
artist. A draft or verifying claim resumes. A pending claim remains locked for
review. An approved claim sends the user to the dashboard.

## Claim flow

1. The user signs in and opens `/for-artists`.
2. The user searches the full artist index and selects the correct artist.
3. `artistClaims.startClaim` creates or resumes the claim. The frontend allows
   this without a Spotify relationship.
4. The user requests a six-digit email code.
5. The backend atomically reserves rate-limit capacity, stores the code, and
   invalidates earlier verification before sending email. A failed delivery
   clears only that matching code, never a later request’s code.
6. The user verifies the code.
7. The user adds a professional role and may add an organization, official
   website, social links, and supporting context.
8. The user can run domain comparison or website-code verification.
9. Every claim goes to manual review. Domain and website checks collect
   supporting evidence; they never create membership.
10. Approval creates the membership, updates artist portal state, sends the
    decision email, and starts the managed-artist warmup.

## Verification and trust rules

### Email verification

Email verification proves control of the entered mailbox. It does not prove an
artist relationship by itself.

- The code contains six digits generated with a cryptographic random source.
- The code expires after 15 minutes.
- A code permits five failed attempts.
- Resends have a one-minute cooldown.
- A claim permits five sends per hour.
- Email addresses are normalized to lowercase before storage.

### Domain comparison

The application compares the verified email domain with the submitted HTTPS
website domain. Exact domains and parent/subdomain pairs can match.

A matching website is supporting evidence only, including when an active
`artistTrustedDomains` record exists. An admin may record a domain after
checking it independently, but that record does not grant access to future
claimants. All claims require manual review.

### Website code

The application generates a stable public proof marker for the claim. The user
adds it as visible text or this meta tag on the submitted website:

```html
<meta name="setlists-verify" content="SETLISTS-…">
```

Finding the marker is evidence of control of the fetched page, not artist
ownership. Every successful check still requires manual review.

The check reserves its rate-limit slot before fetching. Completion must match
the current claim revision, website, verified email, and editable claim state.
Changing details or requesting another email code invalidates earlier evidence,
so a delayed response cannot restore stale proof.

Website checks permit ten attempts with a one-minute cooldown. The fetcher:

- accepts HTTPS pages only.
- resolves DNS and blocks private, loopback, link-local, and reserved targets.
- pins the validated public IP for each request.
- revalidates redirects.
- limits redirect count, response time, response size, and accepted content
  type.

### Spotify relationship

Optional linked-account imports use `spotifyOAuth.importLinkedSpotify` on the
backend. It retrieves the signed-in user's OAuth credential using the existing
server-side auth integration, not a browser session token or an artist-ownership
API. It requires the existing `CLERK_SECRET_KEY` in Convex; no OAuth credential
is returned to the browser. See the [launch hardening runbook](./launch-hardening-2026-09-06.md)
for compatibility limits and rollout checks.

A linked Spotify account can improve artist discovery and catalog data. A
follow, top-artist relationship, or linked Spotify user identity is audit
context only. None of these signals grants dashboard access.

## Scenario matrix

| Scenario | Result |
| --- | --- |
| Signed out user opens the artist portal | The app asks the user to sign in, then returns to the requested artist flow. |
| Signed-in user has no Spotify connection | The user can still search for an artist and start a claim. |
| Signed-in user has Spotify connected | The user can claim, but Spotify does not change the trust threshold. |
| User already has membership | The app opens the artist dashboard and does not create a second claim. |
| User has a draft or verifying claim | The app resumes that claim. |
| User has a pending claim | The app shows pending review and blocks edits. |
| A prior claim was rejected | The user can start a new claim with new evidence. |
| Verified email matches an untrusted submitted website | The app stores the match as evidence. Manual review is required. |
| Verified email matches an active trusted artist domain | The app stores the match as evidence. Manual review is still required. |
| Website marker is found on an untrusted submitted site | The app stores site control as evidence. Manual review is required. |
| Website marker is found on the exact admin-trusted page | The app stores site-control evidence. Manual review is still required. |
| Website has no marker or cannot be fetched safely | The attempt fails. The user can retry within the rate limits or submit other evidence. |
| User has no website or matching domain | The user can submit the verified email, role, and context for manual review. |
| Admin approves the claim | Membership, notification, analytics, and artist warmup are scheduled. |
| Admin rejects the claim | The claim is closed and a rejection email is scheduled. |
| Admin uses quick claim | Admin-only access is granted immediately for testing or support. |

## Manual review runbook

The beta service target is a decision within 24 hours.

Before approval, the admin should:

1. Confirm that the selected artist is correct.
2. Confirm that the email was verified.
3. Compare the stated role and organization with public professional evidence.
4. Find the official website independently. Do not treat the link from the claimant as
   an independent source.
5. Review website-code, domain-match, social-link, and free-text evidence.
6. Treat Spotify data as supporting context, not ownership proof.
7. Select the least-privileged membership role that fits the evidence.
8. Add a review note for unusual approvals or all rejections.
9. Select “Trust this website domain” only after independent confirmation that
   the artist controls it.

Recording a reviewed domain helps future reviewers; it never enables automatic
claims. Leave the checkbox clear when the evidence supports the claimant but
not the domain’s official relationship to the artist.

## Approval side effects

Normal manual approval performs these actions:

1. Create or update the `artistMembers` record.
2. Recompute portal-access state for the artist.
3. Schedule an approval email when an address is available.
4. Schedule `artistAutomation.runManagedArtistWarmup`.
5. Emit `artist_claim_approved` without blocking approval if analytics is
   unavailable.

Manual approval can also create or reactivate an `artistTrustedDomains` record.
The admin-only quick-claim support path remains an explicit bypass: it grants
membership and schedules warmup, without the normal applicant verification or
normal approval-email/event sequence.

## Managed-artist warmup

Claim approval starts the existing autonomous import and cache pipeline. It can:

- find or refresh Ticketmaster artist and show data.
- refresh Spotify artist basics.
- seed top tracks when a catalog is empty.
- refresh the full Spotify catalog.
- create prediction setlists for upcoming shows.
- reconcile `showSongDemand` for up to 20 upcoming and 10 recent completed
  shows.
- queue actual-setlist imports for recent completed shows.
- start a one-time Setlist.fm history import for the artist.

The warmup uses a 30-minute per-artist lock. It refreshes shows hourly when the
next show is within seven days and daily otherwise. Spotify basics and catalog
data use a daily freshness window. Demand reconciliation uses a 12-hour window.
The completed-show import window is 14 days.

`showSongDemand` remains the per-show dashboard demand read model. The existing
tour/momentum queries are not claimed to be scan-free by this change.

A warmup reports `partial` when catalog or show freshness is unresolved, even
when provider actions return without throwing. Queued historical imports are
not treated as confirmed reports. Existing data remains available. See
[Launch hardening](./launch-hardening-2026-09-06.md) for retry and freshness details.

## Team invitation flow

Only an owner can create or revoke an invitation. The owner chooses `manager`
or `viewer`. Invitations cannot create another owner.

1. `artistInvites.createInvite` generates 32 random bytes and encodes them as a
   URL-safe token.
2. The backend stores only the SHA-256 token hash for new invitations.
3. The raw token appears only in the one-time invitation URL.
4. Resend emails the link when configured. If delivery is unavailable, the UI
   returns the secure link so the owner can send it directly.
5. The invitation expires after seven days.
6. Acceptance hashes the supplied token and looks up the stored hash.
7. The signed-in account email must exactly match the normalized invited email.
8. Acceptance creates the membership, marks the invite accepted, clears any
   legacy plaintext token, updates portal state, and schedules warmup.

Resending rotates the token and invalidates the earlier link. The same artist
and email pair has a one-minute resend cooldown. Each artist can create no more
than 25 invitations per hour.

Pending-invite queries return status and delivery metadata but never return the
token or token hash. Owners can revoke pending invitations. Invalid, expired,
accepted, and revoked links have separate user-facing states.

## Security and privacy controls

- Claim and team mutations check the current authenticated user in Convex.
- Claim mutations check claim ownership.
- Artist data reads and team changes check `artistMembers` and role level.
- New invitation tokens are hashed at rest.
- Invitation acceptance is bound to the invited email.
- Invite-token routes disable session recording.
- Analytics removes invite tokens, verification codes, email addresses, and
  sensitive query parameters.
- Claim website and social inputs require HTTPS and have length limits.
- Email content escapes claimant-controlled values.
- Third-party email and analytics failures do not roll back approved access.

## Configuration

The claim and invitation workflows depend on these Convex environment values:

```text
RESEND_API_KEY=<Resend server key>
SITE_URL=https://www.setlists.live
OWNER_NOTIFICATION_EMAIL=<claim-review inbox>
POSTHOG_PROJECT_TOKEN=<PostHog ingestion token>
POSTHOG_HOST=https://us.i.posthog.com
```

`RESEND_API_KEY` is required for email verification. `SITE_URL` builds admin,
dashboard, and invitation links. `OWNER_NOTIFICATION_EMAIL` receives new-claim
notices. The PostHog values are optional for access decisions. Missing analytics
must not block the workflow.

The existing application auth and Convex deployment variables must also be
present. See the root README and environment validation script for the full
deployment list.

## Analytics contract

The workflow emits these browser or server events:

- `artist_portal_viewed`
- `artist_claim_started`
- `artist_claim_email_requested`
- `artist_claim_email_verified`
- `artist_claim_details_saved`
- `artist_claim_verification_attempted`
- `artist_claim_submitted`
- `artist_claim_approved`
- `artist_warmup_completed`
- `artist_warmup_partial`
- `artist_warmup_failed`
- `artist_dashboard_viewed`
- `artist_show_demand_viewed`
- `artist_team_viewed`
- `artist_team_invite_created`
- `artist_team_invite_accepted`
- `artist_team_invite_revoked`
- `artist_team_role_changed`
- `artist_team_member_removed`

See [Product analytics](./analytics.md) for event properties and saved funnels.

## Data and function map

| Area | Tables | Main functions or files |
| --- | --- | --- |
| Claims | `artistClaims`, `artistTrustedDomains` | `convex/artistClaims.ts` |
| Access | `artistMembers` | `convex/artistAccess.ts` |
| Invitations | `artistInvites` | `convex/artistInvites.ts`, `convex/artistAccess.ts` |
| Website checks | Claim verification fields | `convex/artistWebsiteVerification.ts` |
| Warmup | artists, shows, songs, setlists, demand | `convex/artistAutomation.ts` |
| Claim UI | — | `src/pages/ForArtistsPage.tsx`, `src/pages/ArtistClaimPage.tsx` |
| Team UI | — | `src/pages/ForArtistsTeamPage.tsx`, `src/pages/AcceptInvitePage.tsx` |
| Admin review | — | `src/components/admin/AdminArtistClaimsSection.tsx` |

## Test matrix

Run these paths before production release:

- New claim with no Spotify connection.
- New claim with Spotify connected.
- Verification email delivery, cooldown, hourly limit, expiry, and failed
  attempts.
- Untrusted domain match stays in manual review.
- Trusted domain match remains evidence until an admin selects a role and approves.
- Untrusted website marker stays in manual review.
- Exact trusted website marker remains evidence until manual approval.
- Website fetch rejects HTTP, private IPs, unsafe redirects, oversized pages,
  and non-HTML responses.
- Manual approve with and without adding domain trust.
- Manual reject with a visible reason.
- Owner, manager, and viewer route permissions.
- Invite delivery, manual link fallback, resend token rotation, expiry,
  revocation, reuse, and wrong-email rejection.
- Team role change, member removal, and non-owner leave.
- Approval and invite acceptance both start warmup.
- Provider failures preserve existing data and yield a partial/failed warmup,
  not a misleading completed event. Analytics delivery failure does not revoke access.
- Invite URLs and verification values do not appear in PostHog events or replay.

## Release checklist

- [ ] Claim, access, invite, website-fetch, and warmup functions pass Convex
      type checking.
- [ ] The frontend build and automated tests pass.
- [ ] `RESEND_API_KEY`, `SITE_URL`, and `OWNER_NOTIFICATION_EMAIL` are set in
      the production Convex deployment.
- [ ] A production verification email is received.
- [ ] A production team invitation is received and accepted by the exact
      invited address.
- [ ] Neither a trusted nor an untrusted claimant website can auto-approve a claim.
- [ ] An admin can approve, reject, and deliberately trust a domain.
- [ ] The first approved artist dashboard loads shows, catalog data, demand,
      and historical setlists after warmup.
- [ ] PostHog receives claim, approval, warmup, dashboard, and team events with
      no sensitive values.
- [ ] Support owns the 24-hour beta review target.

## Compatibility notes

The schema keeps the optional `artistInvites.inviteToken` field and its index so
previously issued links can be migrated or invalidated without breaking schema
deployment. New invitations do not store plaintext tokens.

The legacy `artistClaims.create` mutation remains for compatibility but creates
a draft, not a submitted or approved claim. It cannot bypass verified email and
professional details. New UI work must use `artistClaims.startClaim`.

The optional `bypassSpotifyCheck` argument remains accepted but has no effect.
Public claim responses never include the secret email verification code. The
separate website marker is intentionally public. Existing approved memberships
are unchanged. Pending legacy claims without verified-email timestamps must be
rejected/restarted and verified before approval.

The old Spotify auto-match design in
`plans/artist-platform-architecture.md` is not implemented and must not be used
as an access rule.
