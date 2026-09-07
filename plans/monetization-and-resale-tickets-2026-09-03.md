# setlists.live — Monetization Priorities & Resale Ticket Stack Design

**Exported from a Claude Code session on 2026-09-03.**
Working directory: `/Users/seth/convex-app` (branch `main`, last commit `09f784c fix: harden analytics and ticket flows`).
No code was changed during this session. Short "continue" nudges between turns are omitted.

---

## Turn 1 — User

> Based on what you know from this app, what would be the top priorities on how to monetize it? I already have ticketmaster affiliate buy tickets links. But what about allowing artist merch embeds, like if they already have a shopify merch store and use the shopify api to auto pull in their merch. or if merch is on spotify. Get creative with the priotieris. dont edit any code yet. just send a list of top ideas here and possible revenue outcomes. review the previous recent chats in this convex chat and latest edits and improvements we made also. act like a genius marketer, entreprenuer and music industry expert

## Turn 1 — Claude

Here's the full picture. I reviewed the codebase, the last eight commits, production data, PostHog, and the "Artist dashboard and onboarding review" session from earlier today. No code was changed.

**The short answer:** the affiliate rails exist but nothing flows through them yet, because the app is still pre-traffic. The priorities that matter are the ones that make each future visitor worth roughly 10x more, and the one that brings visitors in the first place, which is the finished-but-unlaunched artist portal.

| Baseline signal | Value |
|---|---|
| Registered users in prod | 19 |
| Artists / upcoming shows in prod | 1,846 / 261 |
| Visitors, last 30 days | 62 |
| Pageviews, last 30 days | 244 |
| Ticket link clicks since analytics shipped Aug 27 | 0 |
| Artist claims / team members / follows | 0 / 0 / 0 |
| Blog posts in Sanity | 8 |

### Ranked priorities

1. **Add resale ticket links next to Ticketmaster on every show page and card.** Ticketmaster's affiliate payout is tiny and it pays nothing on presales or the first day of onsale. Your visitor shows up days before the show to vote, which is exactly when primary inventory is gone and fans buy resale at a much higher order value.
   - Vivid Seats, StubHub and SeatGeek all run on Impact, where you already have an account. A "Compare ticket prices" row with three providers is a small change, and the existing ticket click event already carries provider and placement.

2. **Launch the artist portal with a free tier and a paid "Tour Intelligence" tier, and make artists your distribution channel.** Earlier today's session called the portal the product thesis and noted it is finished but unlaunched, and prod confirms zero claims. The fastest way to get votes is artists posting "vote on tonight's setlist" to their own fans, so the free tier is your acquisition engine.
   - Free: claim, tonight's top requests, a share card. Pro: city deltas, momentum, post-show report, CSV export, team seats, and an embeddable "fan demand" widget artists paste into their site or Linktree.
   - A management-company tier for rosters is where the real B2B money is.

3. **Setlist-linked merch: Shopify auto-import plus album-matched vinyl.** Spotify's merch shelf is Shopify-powered and has no public API, so "merch on Spotify" is only reachable through the artist's own Shopify store. Every Shopify storefront exposes a public products feed at the store's `/products.json` path with no auth, so an artist entering a store URL is enough to auto-pull products, images and prices, and you can auto-discover the store from their official website link.
   - Revenue path: Shopify Collabs or a rev share negotiated inside the portal for claimed artists, with Amazon Associates on physical music as the fallback for the other 1,800 artists.
   - The creative edge: songs already carry album names, so "the songs you voted for are on Album X, get the vinyl" and a post-show "tonight's setlist on vinyl" module are contextual placements no competitor can build. Per-view earnings are modest, but merch is the bridge that makes artists want the portal.

4. **SEO and programmatic setlist pages, then display ads once you clear network thresholds.** setlist.fm proves the search demand for "artist setlist 2026" and "festival set times" queries, and you have thousands of shows, past setlists and a sitemap. The blocker is that the site is a client-rendered SPA, so pages need prerendering or SSR before Google indexes them reliably.
   - Ads belong on content and past-setlist pages only, never inside the voting UX. Raptive and Mediavine need roughly 50k sessions or 100k pageviews a month, and music vertical RPMs are healthy once you qualify.

5. **Email capture now, newsletter sponsorships later.** "Email me when the official setlist drops" and "tell me when resale prices fall" are high-intent captures, and the schema already has a notification timestamp on setlists while Resend is wired for claim emails. Each alert email carries resale links and the vinyl module. Sponsorships become sellable near 5k subscribers.

6. **Super votes: paid boosts split with the artist.** Fans pay about a dollar to boost a song's request count, with half or more going to the verified artist. Keep boosts as "requests" separate from prediction accuracy so the game stays honest. The money is small, but it is the incentive that gets artists to claim their page and promote your links.

7. **Sponsored placement in discovery.** The homepage "Popular" and "Soonest" carousels you just rebuilt are prime real estate for labels and promoters pushing a tour. Sell "Featured tour" slots by week once traffic exists.

8. **Demand data as B2B, the long game.** Aggregated city-level song demand is data promoters, agencies and labels cannot get elsewhere. Package it as quarterly reports or an API, but only after vote volume makes it credible.

9. **Small fillers.** A "Plan your night" block with hotels and parking near the venue, and an Amazon Music trial bounty beside "listen to the predicted setlist". Low earnings, near-zero effort.

### Revenue outcomes

Commission rates the estimates rest on, from the affiliate directories I checked. Directories disagree on the resale programs, so confirm the exact rates in your Impact contracts.

| Program | Reported commission | Note |
|---|---|---|
| Ticketmaster via Impact | ~$0.30 flat per US sale, 0.5% to 3% in some markets | Nothing on presales or the first 24h of onsale |
| Vivid Seats | 0.8% to 6% depending on source | 30-day cookie |
| StubHub | 0.8% to 4% depending on source | 30-day cookie |
| SeatGeek via Impact | ~1%, about $11 average per sale per SeatGeek | 30-day cookie |
| Amazon Associates, physical music | 5% | Vinyl and CDs |

Assumptions: show pages are about 60% of pageviews, ticket click-through of 8%, purchase conversion of 2.5%, resale order value of $250, merch conversion of 2%.

| Revenue line | Today, ~250 pv/mo | 100k pageviews/mo | 1M pageviews/mo |
|---|---|---|---|
| Ticketmaster only, as built | ~$0 | $40 to $180 | $400 to $1,800 |
| Resale ticket stack | ~$0 | $250 to $900 | $2,500 to $9,000 |
| Merch and vinyl affiliate | ~$0 | $100 to $350 | $1,000 to $3,500 |
| Display ads on content pages | not eligible | $0 to $1,200, at the threshold | $5,000 to $12,000 |
| Newsletter sponsorships | $0 | $0 to $400 | $2,000 to $4,000 |
| Artist Pro at $49/mo | $0 | 20 to 50 artists: $1,000 to $2,500 | 100 to 300 artists: $5,000 to $15,000 |
| Super votes, net of artist share | $0 | $50 to $200 | $500 to $2,000 |
| Sponsored placements | $0 | $0 | $3,000 to $10,000 |
| Data licensing, annualized | $0 | $0 | $2,000 to $8,000 |
| Total per month | ~$0 | $1,500 to $5,700 | $21,000 to $65,000 |

The takeaway from the table: ticket affiliate alone never carries the business, even at a million pageviews. The artist tier and display ads are the two lines that scale, and the resale stack is the cheapest immediate multiplier on what you already built.

### Sequencing

- **This week:** resale ticket stack and email capture. Both are small, both compound.
- **Next:** launch the portal publicly with a pricing page and share card, then hand-recruit ten mid-size touring acts who care about setlists. Their posts are your first real traffic.
- **Then:** prerendering and programmatic pages, followed by the merch module for claimed artists.
- **Later:** super votes, sponsored slots, and data products once vote volume exists.

Two gaps in what I could verify: the Impact and Search Console connectors in GoMarble are not linked to your account, so I could not pull actual affiliate conversions or organic search data. Vercel Web Analytics is also not enabled on the project, so PostHog is the only traffic source.

**Sources:**
- [Top 17 Event Ticket Affiliate Programs](https://uppromote.com/affiliate-programs/event-ticket/)
- [Ticketmaster Affiliate Program + Commissions Rates](https://linkclicky.com/affiliate-program/ticketmaster/)
- [Ticketmaster Affiliate Partner Sign Up](https://developer.ticketmaster.com/partners/distribution-partners/affiliate-sign-up/)
- [Vivid Seats Affiliate Program](https://getlasso.co/affiliate/vivid-seats/)
- [Vivid Seats Affiliate Program on TapRefer](https://taprefer.com/vivid-seats-affiliate-program/vivid-seats/)
- [Top 5 Ticket Resale Affiliate Programs](https://www.ticketwebsite.com/top-5-ticket-resale-affiliate-programs/)
- [SeatGeek Affiliate Program](https://getlasso.co/affiliate/seatgeek/)
- [SeatGeek Partner Program](https://seatgeek.com/build)
- [Amazon Affiliate Commission Rates By Category 2026](https://azonpress.com/amazon-affiliate-commission-rates/)

---

## Turn 2 — User

> so how should the resale ticket stack be implemented? dont edit any code yet

## Turn 2 — Claude

Here's the implementation design, grounded in the code paths that exist today. No code changed.

**Approach in one paragraph.** Ship it in three phases. Phase 1 needs no external API: a provider registry that wraps marketplace links in affiliate tracking, a small offers component that replaces the single "Get Tickets" button, and analytics. Phase 2 adds live "from $X" prices from SeatGeek's free Platform API, which is what turns a link row into a price comparison people click. Phase 3 imports affiliate conversions so you can rank providers by what actually pays.

**Accounts to apply for now, since approval takes days:**
- Vivid Seats and SeatGeek both run on Impact, the same account as your Ticketmaster program. Each gives you a tracking-link base that supports deep links.
- StubHub runs on Partnerize, a different network with a different link format, so the registry must support two wrappers.
- SeatGeek Platform API client ID, free at their developer portal. Its events endpoint returns lowest, average and highest price plus listing count, and an `aid` argument appends your affiliate ID to every returned URL.

### Phase 1: links, UI, analytics

1. **Replace the single Ticketmaster helper with a provider registry.** A new `src/utils/ticketLinks.ts` exports one function that takes a show and a placement and returns an ordered list of offers. Each offer carries provider, label, primary-or-resale kind, and URL. The existing Ticketmaster logic in `src/utils/ticketmaster.ts` stays exactly as it is and becomes the first entry.

2. **Deep-link wrappers.** Impact and Partnerize both accept a destination URL inside the tracking link, and both accept a sub-ID you control. Put the show ID and placement in the sub-ID so every conversion report can be joined back to a show.

```text
Impact (SeatGeek, Vivid Seats):
https://<brand>.sjv.io/c/<partner>/<ad>/<campaign>?u=<encoded destination>&subId1=<showId>&subId2=<placement>

Partnerize (StubHub):
https://prf.hn/click/camref:<camref>/pubref:<showId>-<placement>/destination:<encoded destination>

Phase 1 destinations (search pages, artist name only):
https://seatgeek.com/search?search=<artist>
https://www.vividseats.com/search?searchTerm=<artist>
https://www.stubhub.com/search?q=<artist>
```

   - Search by artist name only. Adding the city to the query returns empty results on some marketplaces when their venue naming differs. Exact event links arrive in Phase 2.
   - Impact only honors the destination if the brand has deep linking enabled and the domain is on its allowlist, and the URL must be percent-encoded exactly once. Verify both in each program's settings the day you're approved.

3. **Config and safe defaults.** Tracking bases live in three new public env vars, added to the env checker as optional. A missing var omits that provider, so the row degrades gracefully before approvals land and the feature can ship immediately.

4. **Eligibility rules, all inside the registry.** Resale shows only for upcoming shows dated today or later. Vivid Seats and SeatGeek show only for US and Canada venues. StubHub shows for US and Canada now, and for UK and EU shows only if you later join StubHub International. The show detail query already returns the venue with its country, but cards get shows from two shapes, the enriched show and the trending cache, so the helper must read country from either.
   - Verification step: check what country strings Ticketmaster wrote into the venues table, because they may be codes or full names, and normalize both.

5. **One offers component in four places.** A new component renders the primary Ticketmaster button unchanged, then a compact "Also on: SeatGeek · Vivid Seats · StubHub" row labeled Resale. On mobile the row sits behind a "Compare prices" toggle so the header stays tight, since the last mobile pass deliberately removed the sticky CTA.
   - Mount points: the hero button in `src/components/ShowDetail.tsx` (~line 566), the card handler in `src/components/ShowCard.tsx` (~line 42), and the festival anchors in `src/components/Festivals.tsx` (~line 270) and `src/components/FestivalDetail.tsx` (~line 246).
   - Render real anchors with `target="_blank"` and `rel="noopener noreferrer sponsored"` instead of the current `window.open` call. Anchors survive middle-click and Safari's popup blocker, and the sponsored attribute keeps you compliant with search engines. The click handler still fires analytics.

6. **Analytics.** Reuse the existing ticket click event with provider values for the three marketplaces, and add offer type, position, and a has-price flag. Add one new event that fires once per show view with the provider count, so click-through per provider is computable. Properties are an untyped record in `src/lib/analytics.ts`, so only the event-name union and the catalog in `docs/analytics.md` change. The festival anchors fire no event today, so this pass fixes that gap too.

7. **Disclosure.** A one-line "we may earn a commission" note under the offers plus a paragraph in the Terms page, which currently mentions ticket pricing but nothing about affiliate relationships.

8. **Tests.** Follow the existing Vitest file for the Ticketmaster builder. Cover: destination encoded once, Partnerize path segments, sub-ID contains the show ID, country gating, completed shows yield only the primary link, missing env omits the provider.

### Phase 2: live prices from SeatGeek

1. **Backend action.** A new Node action in Convex, modeled on the Ticketmaster module, calls the SeatGeek events endpoint filtered by performer, venue city, and the show date plus or minus one day, passing the affiliate `aid` so returned URLs already carry tracking. Match the single event by date and venue-name similarity.
2. **Cache table.** New table keyed by show and provider storing the external event ID, URL, lowest and average price, listing count, currency, and fetch time, indexed by show.
3. **Freshness.** Refresh lazily from the show page the same way the page already calls the artist images action on load, when no row exists or the row is older than 12 hours, and skip shows more than 60 days out. Optionally add a job to the orchestrator's list in `convex/cronOrchestrator.ts` (the `JOBS` array, ~line 29) that refreshes shows within 14 days in batches, so hot shows have prices before the first visitor. SeatGeek's rate limits are undocumented, so back off on 429s.
4. **UI upgrade.** Offers show "from $62 · 161 listings", resale sorts by lowest price, and the exact event URL replaces the search URL inside the same Impact wrapper. Cards show a price chip only when the row is under a day old.
5. **Keep the client ID server-side.** It's a low-sensitivity key, but keeping the call in Convex prevents trivial quota abuse. Vivid Seats and StubHub price APIs sit behind partner approval, so they keep search links until Phase 1 data justifies applying.

### Phase 3: close the attribution loop

1. Nightly import of Impact actions filtered by sub-ID, and Partnerize conversions by pubref, into an affiliate actions table joined to shows.
2. Per-show and per-provider revenue and earnings-per-click in the admin dashboard, which is already split into sub-components.
3. Rank providers by trailing 30-day earnings-per-click per country instead of a fixed order. If you want to test layouts, PostHog feature flags are available through the SDK already loaded, though nothing uses them yet.

| Phase | Scope | Effort | Blocked on |
|---|---|---|---|
| 1 | Registry, wrappers, component, analytics, disclosure, tests | 1 session | Nothing to ship; live links appear as each approval lands |
| 2 | SeatGeek prices, cache table, lazy refresh, optional cron | 1 to 2 sessions | SeatGeek client ID and affiliate ID |
| 3 | Conversion import, admin revenue view, EPC ordering | 1 to 2 sessions | Impact and Partnerize API credentials |

**Three calls that are yours to make.** Show resale links before a show's Ticketmaster onsale, labeled as resale, or hide them until onsale. Apply to StubHub International for the UK and EU shows already in the database. Start with primary-button-plus-row, which I recommend, or three equal buttons and let the click data decide.

**Sources:**
- [SeatGeek Platform API documentation](https://seatgeek.github.io/)
- [impact.com: Add reporting information to tracking links](https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/tracking/tracking-links/create-and-manage-links/add-reporting-information-to-your-tracking-links)
- [impact.com: Sub ID and Shared ID parameters](https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/tracking/tracking-links/link-parameters/sub-id-and-shared-id-parameters-explained-for-partners)
- [impact.com: Param parameters explained](https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/tracking/tracking-links/link-parameters/param-parameters-explained)
- [Vivid Seats affiliate program on Impact](https://app.impact.com/advertiser-advertiser-info/Vivid-Seats.brand)
- [Vivid Seats affiliate page](https://www.vividseats.com/affiliates)
- [StubHub affiliate program on Partnerize](https://partnerize.com/resources/blog/stubhub-affiliate-program-spotlight-and-sign-up-information)
- [StubHub International on Impact](https://app.impact.com/advertiser-advertiser-info/StubHub-International.brand)
- [Partnerize tracking link format](https://docs.fmtc.co/kb/partnerize)
- [Vivid Seats scraper reference showing the search URL](https://apify.com/lexis-solutions/vividseats-com-scraper/api)
- [StubHub scraper reference showing the search URL](https://apify.com/parseforge/stubhub-scraper/input-schema)

---

## Turn 3 — User

> can you export this entire chat to an MD file

## Turn 3 — Claude

Wrote this file to `plans/monetization-and-resale-tickets-2026-09-03.md`.

---

## Appendix — Research notes gathered during the session

These facts came from tool calls (Convex CLI, PostHog, git, prior session transcripts, web searches) and informed the answers above.

**Production data (Convex deployment `exuberant-weasel-22`, via CLI):**

| Metric | Value |
|---|---|
| Users | 19 (2 admins) |
| Artists | 1,846 (all active) |
| Shows | 5,000+ (query capped), 261 upcoming |
| Setlists | 5,000+ (query capped) |
| Rows in `votes` table | 0 |
| `artistMembers`, `artistClaims`, `userFollows` | empty |

**PostHog (project 109917), last 30 days:** 62 visitors, 244 pageviews, 65 sessions, ~118s average session, 52% bounce rate. `ticket_link_clicked` has never been seen. Analytics shipped in commit `b975604` on 2026-08-27.

**Sanity blog:** 8 posts (`post`, `author`, `category` types). Blog posts already auto-link festival names to Ticketmaster affiliate URLs.

**Recent commits reviewed:** `09f784c` harden analytics and ticket flows; `a441568` align Convex SDK; `b975604` PostHog analytics + launch funnels; `3129d73` enforce two free votes and song adds; `177aa58` / `74f534b` / `92c1678` homepage discovery mix and mobile song picker; `9cc43e2` animated responsive navigation; `4d97496` sync pipeline hardening; `f4600bd` Artist Studio onboarding + demand dashboard.

**Prior session ("Artist dashboard and onboarding review", 2026-09-03):** concluded the artist portal is "finished-but-unlaunched" and is the product thesis; its monetization list included merch/vinyl affiliate on artist pages, email sponsorships once the list clears ~5k, and demand data as B2B as the long game.

**Existing monetization plumbing in code:**
- `src/utils/ticketmaster.ts` — Impact Radius affiliate params (`impradid`, `camefrom`, `REFERRAL_ID`, `wt.mc_id`, `ircid`, random `clickid`), trusted Ticketmaster domain allowlist, homepage fallback.
- Ticket CTAs: `ShowDetail.tsx` hero (placement `show_hero`), `ShowCard.tsx` (placement `show_card`), `Festivals.tsx` and `FestivalDetail.tsx` (plain anchors, no analytics event).
- `docs/analytics.md` — event catalog including `ticket_link_clicked` with `provider`, `placement`, `affiliate` properties; funnel #4 "Ticket affiliate conversion".
- `convex/schema.ts` — `festivals.ticketUrl` and `shows.ticketUrl` stored for affiliate revenue; `songs.album` available for album-linked merch; `setlists.notificationSentAt` for setlist-drop emails; `users.preferences.emailNotifications`.
- Artist portal: `convex/artistAccess.ts`, `artistClaims.ts`, `artistDashboard.ts` (tour overview, show demand, city deltas, momentum, post-show report, song frequency), routes under `/for-artists`.
- Site is a Vite SPA rendered client-side; `robots.txt` allows indexing with a Convex-served sitemap; no prerender/SSR.

**Integrations not available during the session:** GoMarble's Impact and Google Search Console connectors were not linked to the account; Vercel Web Analytics is not enabled for the project.

**SeatGeek Platform API facts (from seatgeek.github.io):** `GET https://api.seatgeek.com/2/events` with `performers.slug` or `q`, `venue.city`, `datetime_utc.gte` / `datetime_utc.lte`, `per_page`, `client_id`; event `stats` contains `listing_count`, `average_price`, `lowest_price`, `highest_price`; optional `aid` and `rid` arguments append affiliate tracking to all returned URLs.
