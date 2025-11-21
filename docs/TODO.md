## Completion Checklist

- [x] Replace `sync-engagement-counts` cron with on-write vote/setlist counters and keep a one-time backfill escape hatch.
- [x] Harden Spotify studio-only filter with regex boundaries and strict album version blocking.
- [x] Wire admin flag actions to real backend operations; add delete-content path and per-artist catalog force sync.
- [x] Add ±1 day fallback when fetching setlists from Setlist.fm and keep imports pending during retries.
- [x] Add email notification pipeline (Resend/SendGrid) honoring `emailNotifications` when a setlist is verified/completed.
- [x] Sort show lists by show date (not creation time) and keep slug/vote counts consistent with backfill tool.
- [x] Add admin monitoring widgets for sync jobs, cron settings, and error logs.
