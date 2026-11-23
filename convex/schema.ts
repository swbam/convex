import { ticketInfoValidator } from "./lib/ticketInfo";
import { catalogResultValidator } from "./lib/catalogResult";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { appearanceValidator } from "./lib/appearanceValidator";
import { performanceValidator, requestValidator, livePhase } from "./lib/liveSetlistValidators";

const applicationTables = {
  setlistProviderSettings: defineTable({
    key: v.literal("global"), dailyBudget: v.number(), cooldownUntil: v.optional(v.number()),
  }).index("by_key", ["key"]),
  liveSetlistSessions: defineTable({
    showId: v.id("shows"), artistId: v.id("artists"), startsAt: v.number(),
    phase: livePhase, nextCheckAt: v.optional(v.number()), generation: v.number(),
    leaseUntil: v.optional(v.number()), requestsUsed: v.number(), failures: v.number(),
    lastCheckedAt: v.optional(v.number()), lastChangedAt: v.optional(v.number()),
    lastError: v.optional(v.string()), sourceId: v.optional(v.string()),
    confirmedAt: v.optional(v.number()), frozenAt: v.optional(v.number()),
    scheduleKey: v.string(),
  }).index("by_show", ["showId"]).index("by_due", ["nextCheckAt"]),
  liveSetlistSnapshots: defineTable({
    showId: v.id("shows"), songs: v.array(performanceValidator),
    requests: v.array(requestValidator), version: v.optional(v.string()),
    sourceUrl: v.optional(v.string()), sourceUpdatedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_show", ["showId"]),
  heroImageCache: defineTable({
    key: v.string(), refreshAfter: v.number(),
    image: v.optional(v.object({ url: v.string(), width: v.optional(v.number()), height: v.optional(v.number()) })),
  }).index("by_key", ["key"]),
  siteAppearance: defineTable({
    key: v.literal("global"),
    settings: appearanceValidator,
    revision: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  seoSitemapStates: defineTable({
    kind: v.string(), generation: v.number(), cursor: v.union(v.string(), v.null()),
    lastIncludedSlug: v.optional(v.union(v.string(), v.null())),
    building: v.boolean(), updatedAt: v.number(), nextShard: v.number(), urlCount: v.number(),
    publishedGeneration: v.optional(v.number()), publishedShards: v.optional(v.number()), publishedAt: v.optional(v.number()), publishedUrlCount: v.optional(v.number()),
  }).index("by_kind", ["kind"]),
  seoSitemapShards: defineTable({
    kind: v.string(), generation: v.number(), part: v.number(), xml: v.string(), urlCount: v.number(),
  }).index("by_generation_part", ["kind", "generation", "part"]).index("by_generation", ["generation"]),
  performedSongs: defineTable({
    songKey: v.string(),
    title: v.string(),
  }).index("by_song_key", ["songKey"])
    .searchIndex("search_title", { searchField: "songKey" }),

  songPerformances: defineTable({
    songId: v.id("performedSongs"),
    showId: v.id("shows"),
    title: v.string(),
    date: v.string(),
  }).index("by_show", ["showId"])
    .index("by_song_date", ["songId", "date"]),
  // Custom users table for app-specific data
  users: defineTable({
    authId: v.string(),
    username: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
    preferences: v.optional(v.object({
      emailNotifications: v.boolean(),
      favoriteGenres: v.array(v.string()),
    })),
    // Optional profile fields used by webhooks and UI
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatar: v.optional(v.string()),
    spotifyId: v.optional(v.string()),
    googleId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_auth_id", ["authId"])
    .index("by_email", ["email"])
    .index("by_username", ["username"])
    .index("by_spotify_id", ["spotifyId"])
    .index("by_google_id", ["googleId"])
    .index("by_created_at", ["createdAt"]),

  artists: defineTable({
    slug: v.string(),
    name: v.string(),
    spotifyId: v.optional(v.string()),
    ticketmasterId: v.optional(v.string()),
    genres: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    popularity: v.optional(v.number()),
    followers: v.optional(v.number()),
    trendingScore: v.optional(v.number()),
    trendingRank: v.optional(v.number()),
    upcomingShowsCount: v.optional(v.number()),
    lastTrendingUpdate: v.optional(v.number()),
    lowerName: v.optional(v.string()),
    isActive: v.boolean(),
    lastSynced: v.optional(v.number()),
    artistAccessEnabled: v.optional(v.boolean()),
    artistAccessEnabledAt: v.optional(v.number()),
    artistMemberCount: v.optional(v.number()),
    lastShowSyncAt: v.optional(v.number()),
    nextShowRefreshAt: v.optional(v.number()),
    lastShowRefreshAttemptAt: v.optional(v.number()),
    showRefreshFailures: v.optional(v.number()),
    lastShowRefreshError: v.optional(v.string()),
    // setlist.fm history import (past setlists for the Past tab)
    setlistfmMbid: v.optional(v.string()),
    lastSetlistfmHistorySyncAt: v.optional(v.number()),
    lastSpotifyBasicsSyncAt: v.optional(v.number()),
    lastCatalogSyncAt: v.optional(v.number()),
    lastAutonomousRefreshAt: v.optional(v.number()),
    lastDemandReconcileAt: v.optional(v.number()),
    // CRITICAL: Track catalog sync attempts to prevent infinite loops
    catalogSyncAttemptedAt: v.optional(v.number()),
    catalogSyncResult: v.optional(catalogResultValidator),
    catalogSyncStatus: v.optional(v.union(
      v.literal("never"),
      v.literal("pending"),
      v.literal("syncing"),
      v.literal("partial"),
      v.literal("completed"),
      v.literal("failed")
    )),
    // CIRCUIT BREAKER: Track consecutive failures to prevent infinite retries
    catalogSyncFailureCount: v.optional(v.number()), // Consecutive failures
    catalogSyncLastFailure: v.optional(v.number()), // Timestamp of last failure
    catalogSyncBackoffUntil: v.optional(v.number()), // Block syncs until this timestamp
    // Optional per-user flags occasionally patched in legacy code paths
    isTopArtist: v.optional(v.boolean()),
    topArtistRank: v.optional(v.number()),
    isFollowed: v.optional(v.boolean()),
    // Progressive import status tracking
    syncStatus: v.optional(v.object({
      showsImported: v.boolean(),
      catalogImported: v.boolean(),
      basicsEnriched: v.boolean(),
      showCount: v.optional(v.number()),
      songCount: v.optional(v.number()),
      phase: v.optional(v.string()),
      error: v.optional(v.string()),
      lastSync: v.number(),
    })),
  })
    .index("by_slug", ["slug"])
    .index("by_name", ["name"])
    .index("by_active_name", ["isActive", "name"])
    .index("by_trending_score", ["trendingScore"])
    .index("by_trending_rank", ["trendingRank"])
    .index("by_spotify_id", ["spotifyId"])
    .index("by_ticketmaster_id", ["ticketmasterId"])
    .index("by_lower_name", ["lowerName"])
    .index("by_last_synced", ["lastSynced"])
    .index("by_setlistfm_history_sync", ["lastSetlistfmHistorySyncAt"])
    .index("by_artist_access_enabled", ["artistAccessEnabled"])
    .index("by_active_show_refresh", ["isActive", "nextShowRefreshAt"])
    .searchIndex("search_name", { searchField: "name", filterFields: ["isActive"] }),

  touringRefreshRotation: defineTable({ key: v.string(), window: v.string(), cursor: v.union(v.string(), v.null()) })
    .index("by_key", ["key"]),

  artistShowCountRuns: defineTable({
    name: v.string(), generation: v.number(),
    phase: v.union(v.literal("counting"), v.literal("publishing"), v.literal("complete")),
    cursor: v.union(v.string(), v.null()), showsCounted: v.number(), artistsUpdated: v.number(),
    startedAt: v.number(), updatedAt: v.number(), completedAt: v.optional(v.number()),
  }).index("by_name", ["name"]),
  artistShowCountTotals: defineTable({
    generation: v.number(), artistId: v.id("artists"), count: v.number(),
  }).index("by_generation_artist", ["generation", "artistId"]),
  attractionDecisions: defineTable({
    ticketmasterId: v.string(), name: v.string(), fingerprint: v.string(),
    decision: v.union(v.literal("excluded"), v.literal("review")),
    reason: v.string(), policyVersion: v.number(), updatedAt: v.number(),
  }).index("by_ticketmaster_id", ["ticketmasterId"]),

  venues: defineTable({
    slug: v.optional(v.string()),
    name: v.string(),
    city: v.string(),
    state: v.optional(v.string()),
    country: v.string(),
    address: v.optional(v.string()),
    capacity: v.optional(v.number()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    ticketmasterId: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    lastSynced: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_location", ["city", "country"])
    .index("by_ticketmaster_id", ["ticketmasterId"])
    .index("by_name_city", ["name", "city"]),

  // Festivals - multi-artist events like Coachella, Bonnaroo, etc.
  festivals: defineTable({
    name: v.string(),                     // "Coachella 2025"
    slug: v.string(),                     // "coachella-2025"
    year: v.number(),                     // 2025
    startDate: v.string(),                // "2025-04-11"
    endDate: v.string(),                  // "2025-04-13"
    venueId: v.optional(v.id("venues")),  // Link to existing venue
    location: v.string(),                 // "Indio, CA" (denormalized)
    imageUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),    // Direct Ticketmaster link for affiliate revenue
    sourceVenueName: v.optional(v.string()),
    discoveryState: v.optional(v.union(v.literal("listed"), v.literal("review"))),
    discoveryReason: v.optional(v.string()),
    imageCardUrl: v.optional(v.string()),
    imageOverrideUrl: v.optional(v.string()),
    imageAttribution: v.optional(v.string()),
    imageUpdatedAt: v.optional(v.number()),
    mediaCheckedAt: v.optional(v.number()),
    mediaError: v.optional(v.string()),
    lineupSourceUrl: v.optional(v.string()),
    lineupSource: v.optional(v.string()),
    lineupCheckedAt: v.optional(v.number()),
    lineupStatus: v.optional(v.union(v.literal("partial"), v.literal("verified"))),
    lineupExpectedCount: v.optional(v.number()),

    wikiUrl: v.optional(v.string()),      // Wikipedia source
    ticketmasterId: v.optional(v.string()), // For dynamic festival detection/deduplication
    genres: v.optional(v.array(v.string())),
    status: v.union(
      v.literal("announced"),             // Dates announced, no lineup
      v.literal("lineup"),                // Lineup published
      v.literal("scheduled"),             // Set times available
      v.literal("ongoing"),               // Festival happening now
      v.literal("completed")              // Festival ended
    ),
    artistCount: v.optional(v.number()),  // Denormalized count
    totalVotes: v.optional(v.number()),   // Engagement metric
    lastSynced: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_year", ["year"])
    .index("by_status", ["status"])
    .index("by_start_date", ["startDate"])
    .index("by_end_date", ["endDate"])
    .index("by_discovery_end", ["discoveryState", "endDate"])
    .searchIndex("search_name", { searchField: "name" })
    .index("by_ticketmaster_id", ["ticketmasterId"]),

  festivalLineupEntries: defineTable({
    festivalId: v.id("festivals"), name: v.string(), nameKey: v.string(),
    artistId: v.optional(v.id("artists")), source: v.string(), sourceUrl: v.optional(v.string()),
    dayNumber: v.optional(v.number()), updatedAt: v.number(),
  }).index("by_festival", ["festivalId"]).index("by_festival_name", ["festivalId", "nameKey"]),

  shows: defineTable({
    slug: v.optional(v.string()),
    artistId: v.id("artists"),
    venueId: v.id("venues"),
    date: v.string(),
    startTime: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    timeZone: v.optional(v.string()),
    status: v.union(v.literal("upcoming"), v.literal("completed"), v.literal("cancelled")),
    ticketmasterId: v.optional(v.string()),
    setlistfmId: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
    ticketInfo: ticketInfoValidator,
    priceRange: v.optional(v.string()),
    // Engagement & trending fields
    setlistCount: v.optional(v.number()),
    voteCount: v.optional(v.number()),
    trendingScore: v.optional(v.number()),
    trendingRank: v.optional(v.number()),
    lastTrendingUpdate: v.optional(v.number()),
    lastSynced: v.optional(v.number()),
    importStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("importing"),
      v.literal("completed"),
      v.literal("not_found"), // Setlist.fm doesn't have data for this show yet
      v.literal("failed")
    )),
    importNextAttemptAt: v.optional(v.number()),
    importRetryExpiresAt: v.optional(v.number()),
    importLastAttemptAt: v.optional(v.number()),
    importAttemptCount: v.optional(v.number()),
    // Festival-specific fields
    festivalId: v.optional(v.id("festivals")),
    stageName: v.optional(v.string()),      // "Main Stage"
    setTime: v.optional(v.string()),        // "21:30" (24h format)
    setEndTime: v.optional(v.string()),     // "23:00"
    dayNumber: v.optional(v.number()),      // 1, 2, 3 for multi-day
    festivalScheduleConfirmed: v.optional(v.boolean()),
    isFestivalSet: v.optional(v.boolean()), // Quick filter flag
  })
    .index("by_slug", ["slug"])
    .index("by_artist", ["artistId"])
    .index("by_venue", ["venueId"])
    .index("by_status", ["status"])
    .index("by_status_and_date", ["status", "date"])
    .index("by_status_and_artist", ["status", "artistId"]) // For status-filtered queries
    .index("by_artist_and_status", ["artistId", "status"]) // For artist page status filtering
    .index("by_artist_and_date", ["artistId", "date"])
    .index("by_artist_status_and_date", ["artistId", "status", "date"])
    .index("by_date", ["date"])
    .index("by_venue_status_and_date", ["venueId", "status", "date"])
    .index("by_ticketmaster_id", ["ticketmasterId"])
    .index("by_ticketmaster_and_artist", ["ticketmasterId", "artistId"])
    .index("by_setlistfm_id", ["setlistfmId"]) // For setlist.fm history dedup
    .index("by_trending_rank", ["trendingRank"])
    .index("by_import_status", ["importStatus"]) // For import monitoring
    .index("by_status_import_due", ["status", "importStatus", "importNextAttemptAt"])
    .index("by_status_import_date", ["status", "importStatus", "date"])
    .index("by_import_retry_expiry", ["importRetryExpiresAt"])
    .index("by_festival", ["festivalId"]), // For festival pages

  songs: defineTable({
    title: v.string(),
    album: v.optional(v.string()),
    spotifyId: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    popularity: v.optional(v.number()),
    trackNo: v.optional(v.number()),
    isLive: v.boolean(),
    isRemix: v.boolean(),
  })
    .index("by_spotify_id", ["spotifyId"]),

  repertoireMergeJobs: defineTable({
    artistId: v.id("artists"),
    showId: v.id("shows"),
    scheduledId: v.optional(v.id("_scheduled_functions")),
  }).index("by_artist", ["artistId"])
    .index("by_show", ["showId"])
    .index("by_scheduled", ["scheduledId"]),

  artistSongs: defineTable({
    artistId: v.id("artists"),
    songId: v.id("songs"),
    isPrimaryArtist: v.boolean(),
    source: v.optional(v.union(v.literal("setlistfm"), v.literal("spotify_repertoire"))),
    sourceArtistName: v.optional(v.string()),
    sourceSpotifyArtistId: v.optional(v.string()),
    sourceTrackTitle: v.optional(v.string()),
    sourceSetlistId: v.optional(v.id("setlists")),
  })
    .index("by_artist", ["artistId"])
    .index("by_artist_and_song", ["artistId", "songId"])
    .index("by_song", ["songId"]),

  setlists: defineTable({
    showId: v.id("shows"),
    userId: v.optional(v.id("users")),
    songs: v.array(v.object({
      title: v.string(),
      album: v.optional(v.string()),
      duration: v.optional(v.number()),
      songId: v.optional(v.id("songs")),
    })),
    isOfficial: v.boolean(),
    confidence: v.optional(v.number()),
    upvotes: v.optional(v.number()),
    downvotes: v.optional(v.number()),
    setlistfmId: v.optional(v.string()),
    verified: v.optional(v.boolean()),
    source: v.optional(v.union(v.literal("user_submitted"), v.literal("setlistfm"))),
    lastUpdated: v.optional(v.number()),
    // Actual setlist fields populated from setlist.fm
    actualSetlist: v.optional(v.array(v.object({
      title: v.string(),
      setNumber: v.number(),
      encore: v.boolean(),
      album: v.optional(v.any()),
      duration: v.optional(v.number()),
      voteCount: v.optional(v.number()),
      wasPredicted: v.optional(v.boolean()),
    }))),
    setlistfmData: v.optional(v.any()),
    accuracy: v.optional(v.number()),
    comparedAt: v.optional(v.number()),
    songVoteCount: v.optional(v.number()),
    voteCountsReady: v.optional(v.boolean()),
    voteCountsSchedule: v.optional(v.string()),
    notificationSentAt: v.optional(v.number()),
    notificationScheduledAt: v.optional(v.number()),
  })
    .index("by_show", ["showId"])
    .index("by_user", ["userId"])
    .index("by_song_vote_count", ["songVoteCount"])
    .index("by_official", ["isOfficial"])
    .index("by_show_and_user", ["showId", "userId"]),

  songVoteCounts: defineTable({
    setlistId: v.id("setlists"),
    songKey: v.string(),
    songTitle: v.string(),
    upvotes: v.number(),
  })
    .index("by_setlist", ["setlistId"])
    .index("by_setlist_song_key", ["setlistId", "songKey"]),

  // Votes system per CONVEX.md specification
  votes: defineTable({
    userId: v.id("users"),
    setlistId: v.id("setlists"),
    voteType: v.union(v.literal("accurate"), v.literal("inaccurate")),
    songVotes: v.optional(v.array(v.object({
      songName: v.string(),
      vote: v.union(v.literal("correct"), v.literal("incorrect"), v.literal("missing")),
    }))),
    createdAt: v.number(),
  })
    .index("by_setlist", ["setlistId"])
    .index("by_user", ["userId"])
    .index("by_user_and_setlist", ["userId", "setlistId"])
    .index("by_created_at", ["createdAt"]),

  // Individual song upvotes within setlists (supports anonymous by string ID)
  songVotes: defineTable({
    userId: v.union(v.id("users"), v.string()),
    setlistId: v.id("setlists"),
    songTitle: v.string(),
    voteType: v.literal("upvote"),
    createdAt: v.number(),
  })
    .index("by_user_setlist_song", ["userId", "setlistId", "songTitle"])
    .index("by_user", ["userId"])
    .index("by_user_created_at", ["userId", "createdAt"])
    .index("by_setlist_song", ["setlistId", "songTitle"])
    .index("by_setlist", ["setlistId"])
    .index("by_created_at", ["createdAt"]),

  // Per-user Spotify artist relationships
  userSpotifyArtists: defineTable({
    userId: v.id("users"),
    artistId: v.id("artists"),
    isFollowed: v.boolean(),
    isTopArtist: v.optional(v.boolean()),
    topArtistRank: v.optional(v.number()),
    importedAt: v.optional(v.number()),
    lastUpdated: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_artist", ["userId", "artistId"]),

  // Lightweight audit/rate limit table for recent actions
  userActions: defineTable({
    userId: v.union(v.id("users"), v.string()),
    action: v.string(),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_action", ["userId", "action"])
    .index("by_action", ["action"])
    .index("by_user_time", ["userId", "timestamp"]),

  // Cache for external trending artists (Ticketmaster) with simple indexing
  trendingArtists: defineTable({
    artistId: v.optional(v.id("artists")),
    ticketmasterId: v.string(),
    slug: v.string(),
    name: v.string(),
    genres: v.array(v.string()),
    images: v.array(v.string()),
    upcomingEvents: v.number(),
    url: v.optional(v.string()),
    rank: v.number(),
    lastUpdated: v.number(),
  })
    .index("by_rank", ["rank"])
    .index("by_ticketmaster_id", ["ticketmasterId"])
    .index("by_artist", ["artistId"]),

  // Cache for external trending shows (Ticketmaster) with simple indexing
  trendingShows: defineTable({
    showId: v.optional(v.id("shows")),
    showSlug: v.string(),
    artistTicketmasterId: v.optional(v.string()),
    artistId: v.optional(v.id("artists")),
    artistSlug: v.string(),
    artistName: v.string(),
    venueName: v.string(),
    venueCity: v.string(),
    venueState: v.optional(v.string()),
    venueCountry: v.string(),
    date: v.string(),
    startTime: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    timeZone: v.optional(v.string()),
    artistImage: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
    ticketInfo: ticketInfoValidator,
    priceRange: v.optional(v.string()),
    status: v.string(),
    rank: v.number(),
    lastUpdated: v.number(),
    ticketmasterId: v.string(),
  })
    .index("by_rank", ["rank"])
    .index("by_ticketmaster_id", ["ticketmasterId"]),

  // Moderation: content flags raised by users
  contentFlags: defineTable({
    contentType: v.union(v.literal("setlist"), v.literal("vote"), v.literal("comment")),
    contentId: v.string(),
    reason: v.string(),
    reporterId: v.id("users"),
    createdAt: v.number(),
    status: v.union(v.literal("pending"), v.literal("reviewed"), v.literal("dismissed")),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"]),

  // Activity feed is computed from songVotes, setlists, follows (no dedicated table needed)
  // See convex/activity.ts:getUserActivityFeed for implementation

  userFollows: defineTable({
    userId: v.id("users"),
    artistId: v.id("artists"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_artist", ["artistId"])
    .index("by_user_and_artist", ["userId", "artistId"]),

  // Artist portal: claim + membership model (do not overload users.role)
  artistClaims: defineTable({
    userId: v.id("users"),
    artistId: v.id("artists"),
    status: v.union(
      v.literal("draft"),      // Started but not submitted
      v.literal("verifying"),  // Waiting for email verification
      v.literal("pending"),    // Submitted, waiting for admin review
      v.literal("approved"),
      v.literal("rejected")
    ),
    submittedAt: v.optional(v.number()),
    createdAt: v.number(),
    // Spotify user identity from Clerk external account providerUserId (auditability only)
    spotifyUserId: v.optional(v.string()),

    // Email verification flow
    verificationEmail: v.optional(v.string()),
    verificationCode: v.optional(v.string()),
    verificationCodeSentAt: v.optional(v.number()),
    verificationCodeAttempts: v.optional(v.number()),
    emailVerified: v.optional(v.boolean()),
    emailVerifiedAt: v.optional(v.number()),
    verificationRevision: v.optional(v.number()),
    // Rate limiting for email sends
    emailSendCount: v.optional(v.number()),
    emailSendWindowStart: v.optional(v.number()),

    // Professional context
    officialRole: v.optional(v.union(
      v.literal("artist"),     // The actual artist
      v.literal("manager"),    // Artist's manager
      v.literal("label"),      // Label representative
      v.literal("agent"),      // Booking agent
      v.literal("publicist"),  // PR/publicist
      v.literal("team")        // Other team member
    )),
    organizationName: v.optional(v.string()), // e.g., "Republic Records", "WME"

    // Social proof / evidence
    officialWebsite: v.optional(v.string()),
    socialLinks: v.optional(v.array(v.string())), // Twitter, Instagram, etc.
    additionalContext: v.optional(v.string()),    // Free text explanation

    // Legacy evidence field (keep for backwards compat)
    evidence: v.optional(v.array(v.object({ type: v.string(), value: v.string() }))),

    // Enhanced verification system
    verificationMethod: v.optional(v.union(
      v.literal("email_code"),       // Verified via email code
      v.literal("email_domain"),     // User email domain matches artist domain
      v.literal("website_code"),     // Verification code found on website
      v.literal("social_twitter"),   // Code posted on Twitter
      v.literal("social_instagram"), // Code posted on Instagram
      v.literal("manual_review")     // Admin approved manually
    )),
    verifiedAt: v.optional(v.number()),
    verificationProof: v.optional(v.string()), // URL or evidence reference

    // Website/social verification code (unique per claim, like SETLISTS-A7X9K2B1)
    websiteVerificationCode: v.optional(v.string()),
    websiteVerificationCodeGeneratedAt: v.optional(v.number()),
    websiteVerificationAttempts: v.optional(v.number()),
    websiteVerificationLastAttempt: v.optional(v.number()),

    // Domain verification status
    domainVerificationStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("matched"),
      v.literal("no_match"),
      v.literal("no_domain")
    )),
    domainVerificationDetails: v.optional(v.string()), // e.g., "theband.com matched"
    // A claimant-controlled URL is evidence, not an ownership attestation. This
    // is true only when the domain was independently trusted by an admin.
    trustedDomainMatched: v.optional(v.boolean()),
    websiteVerificationStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("matched"),
      v.literal("not_found"),
      v.literal("error")
    )),

    // Review tracking
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    reviewNote: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_artist", ["artistId"])
    .index("by_user_artist", ["userId", "artistId"])
    .index("by_submitted_at", ["submittedAt"]),

  artistNotifications: defineTable({
    claimId: v.id("artistClaims"), key: v.string(),
    kind: v.union(v.literal("review_needed"), v.literal("submitted"), v.literal("approved"), v.literal("rejected")),
    recipient: v.string(), subject: v.string(), html: v.string(), replyTo: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("sending"), v.literal("accepted"), v.literal("failed"), v.literal("cancelled")),
    attempts: v.number(), revision: v.number(), nextAttemptAt: v.optional(v.number()),
    firstAttemptAt: v.optional(v.number()), providerId: v.optional(v.string()),
    deliveryStatus: v.optional(v.string()), lastError: v.optional(v.string()),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_key", ["key"]).index("by_claim", ["claimId"])
    .index("by_status_due", ["status", "nextAttemptAt"]),

  artistMembers: defineTable({
    artistId: v.id("artists"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("manager"), v.literal("viewer")),
    createdAt: v.number(),
    invitedBy: v.optional(v.id("users")),
  })
    .index("by_artist", ["artistId"])
    .index("by_user", ["userId"])
    .index("by_user_artist", ["userId", "artistId"]),

  // Domains independently approved for an artist. Claim-supplied websites are
  // never trusted until an admin deliberately creates one of these records.
  artistTrustedDomains: defineTable({
    artistId: v.id("artists"),
    domain: v.string(),
    websiteUrl: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("revoked")),
    source: v.union(v.literal("manual_admin"), v.literal("legacy_verified")),
    verifiedAt: v.number(),
    verifiedBy: v.optional(v.id("users")),
  })
    .index("by_artist", ["artistId"])
    .index("by_domain", ["domain"])
    .index("by_artist_domain", ["artistId", "domain"])
    .index("by_artist_status", ["artistId", "status"]),

  // Team invitations that don't require pre-existing user accounts
  artistInvites: defineTable({
    artistId: v.id("artists"),
    email: v.string(), // Normalized to lowercase
    role: v.union(v.literal("manager"), v.literal("viewer")),
    status: v.union(
      v.literal("pending"),   // Awaiting acceptance
      v.literal("accepted"),  // User accepted and joined
      v.literal("expired"),   // Invite expired
      v.literal("revoked")    // Owner revoked the invite
    ),
    // New invitations store only a SHA-256 hash. inviteToken remains optional
    // solely so already-issued links can be migrated/accepted safely.
    inviteToken: v.optional(v.string()),
    tokenHash: v.optional(v.string()),
    // Issuances in the rolling rate-limit window, including rotations of this row.
    issuedAtHistory: v.optional(v.array(v.number())),
    invitedBy: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(), // Invites expire after 7 days
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.id("users")), // The user who accepted
    sentAt: v.optional(v.number()),
    deliveryStatus: v.optional(v.union(
      v.literal("sent"),
      v.literal("not_configured"),
      v.literal("failed")
    )),
  })
    .index("by_artist", ["artistId"])
    .index("by_email", ["email"])
    .index("by_token", ["inviteToken"])
    .index("by_token_hash", ["tokenHash"])
    .index("by_status", ["status"])
    .index("by_artist_email", ["artistId", "email"])
    .index("by_artist_created_at", ["artistId", "createdAt"]),

  // Artist portal: aggregated per-show demand so dashboards don't scan songVotes
  showSongDemand: defineTable({
    showId: v.id("shows"),
    songKey: v.string(),
    songTitle: v.string(),
    upvotes: v.number(),
    lastVoteAt: v.number(),
  })
    .index("by_show", ["showId"])
    .index("by_show_and_songKey", ["showId", "songKey"])
    .index("by_show_upvotes", ["showId", "upvotes"])
    .index("by_show_last_vote_at", ["showId", "lastVoteAt"]),

  syncStatus: defineTable({
    isActive: v.boolean(),
    currentPhase: v.string(),
    lastSync: v.number(),
  }),

  syncJobs: defineTable({
    type: v.union(
      v.literal("artist_basic"),
      v.literal("artist_shows"),
      v.literal("artist_catalog"),
      v.literal("trending_sync"),
      v.literal("active_sync"),
      v.literal("full_sync"),
      v.literal("setlist_import"),
      v.literal("festival_lineup_import"),
      v.literal("festival_media_sync")
    ),
    entityId: v.optional(v.string()),
    priority: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    retryCount: v.number(),
    maxRetries: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    failedItems: v.optional(v.array(v.string())),
    // Progress tracking fields
    currentPhase: v.optional(v.string()),
    continuationCursor: v.optional(v.union(v.string(), v.null())),
    totalSteps: v.optional(v.number()),
    completedSteps: v.optional(v.number()),
    currentStep: v.optional(v.string()),
    itemsProcessed: v.optional(v.number()),
    totalItems: v.optional(v.number()),
    progressPercentage: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_priority", ["priority"])
    .index("by_type_and_status", ["type", "status"]),

  // Simple lock table to prevent overlapping maintenance runs
  maintenanceLocks: defineTable({
    name: v.string(),
    isRunning: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"]),

  spotifyTokens: defineTable({
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    tokenType: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Error logs table for tracking backend errors with Sentry integration
  errorLogs: defineTable({
    operation: v.string(),
    error: v.string(),
    context: v.optional(v.object({
      artistId: v.optional(v.id("artists")),
      showId: v.optional(v.id("shows")),
      setlistId: v.optional(v.id("setlists")),
      userId: v.optional(v.id("users")),
      artistName: v.optional(v.string()),
      showDate: v.optional(v.string()),
      additionalData: v.optional(v.any()),
    })),
    severity: v.union(v.literal("error"), v.literal("warning"), v.literal("info")),
    timestamp: v.number(),
    resolved: v.boolean(),
    sentToSentry: v.optional(v.boolean()),
  })
    .index("by_operation", ["operation"])
    .index("by_severity", ["severity"])
    .index("by_timestamp", ["timestamp"])
    .index("by_resolved", ["resolved"])
    .index("by_sentry_status", ["sentToSentry"]),

  // Admin-configurable cron settings
  cronSettings: defineTable({
    name: v.string(),
    intervalMs: v.number(),
    enabled: v.boolean(),
    lastRunAt: v.optional(v.number()),
    // Admin-triggered one-off run request (cleared by orchestrator after execution)
    runNowRequestedAt: v.optional(v.number()),
    // Lightweight status snapshots for admin UI (also backed by cronRuns)
    lastSuccessAt: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    lastDurationMs: v.optional(v.number()),
  })
    .index("by_name", ["name"]),

  // Cron run history for observability and debugging
  cronRuns: defineTable({
    name: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("failure"),
      v.literal("skipped"),
    ),
    error: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    stats: v.optional(v.any()),
  })
    .index("by_name", ["name"])
    .index("by_started_at", ["startedAt"])
    .index("by_name_and_started_at", ["name", "startedAt"]),

  // Idempotency tracking for Clerk webhooks
  clerkWebhookEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    processedAt: v.number(),
  })
    .index("by_event_id", ["eventId"]),

  // Admin audit log (who did what, when, outcome)
  adminAuditLogs: defineTable({
    actorUserId: v.id("users"),
    action: v.string(),
    args: v.optional(v.any()),
    createdAt: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_actor", ["actorUserId"]),
};

export default defineSchema({
  ...applicationTables,
});
