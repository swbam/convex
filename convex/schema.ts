import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const applicationTables = {
  // Custom users table for app-specific data
  users: defineTable({
    authId: v.string(), // Clerk user ID (string)
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    spotifyId: v.optional(v.string()),
    avatar: v.optional(v.string()),
    username: v.string(),
    bio: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin"), v.literal("banned")),
    preferences: v.optional(v.object({
      emailNotifications: v.boolean(),
      favoriteGenres: v.array(v.string()),
    })),
    createdAt: v.number(),
  })
    .index("by_auth_id", ["authId"])
    .index("by_username", ["username"])
    .index("by_email", ["email"]),

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
    trendingRank: v.optional(v.number()), // 1-20 for top trending
    upcomingShowsCount: v.optional(v.number()), // Cached count
    lastTrendingUpdate: v.optional(v.number()), // When trending was calculated
    isActive: v.boolean(),
    lastSynced: v.optional(v.number()),
    lowerName: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_trending_rank", ["trendingRank"]) // Fast top-20 query
    .index("by_trending_score", ["trendingScore"])
    .index("by_spotify_id", ["spotifyId"]) 
    .index("by_ticketmaster_id", ["ticketmasterId"]) 
    .index("by_name", ["name"])
    .index("by_lower_name", ["lowerName"]),

  venues: defineTable({
    name: v.string(),
    city: v.string(),
    state: v.optional(v.string()),
    country: v.string(),
    address: v.optional(v.string()),
    capacity: v.optional(v.number()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    ticketmasterId: v.optional(v.string()),
  })
    .index("by_location", ["city", "country"]) 
    .index("by_ticketmaster_id", ["ticketmasterId"]),

  shows: defineTable({
    slug: v.optional(v.string()),
    artistId: v.id("artists"),
    venueId: v.id("venues"),
    date: v.string(),
    startTime: v.optional(v.string()),
    status: v.union(v.literal("upcoming"), v.literal("completed"), v.literal("cancelled")),
    ticketmasterId: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
    priceRange: v.optional(v.string()), // Min-max price
    setlistfmId: v.optional(v.string()),
    trendingScore: v.optional(v.number()),
    trendingRank: v.optional(v.number()), // 1-20 for top trending
    lastTrendingUpdate: v.optional(v.number()),
    lastSynced: v.optional(v.number()),
    voteCount: v.optional(v.number()), // Total votes on setlists for this show
    setlistCount: v.optional(v.number()), // Number of user-submitted setlists
    importStatus: v.optional(v.union(v.literal("pending"), v.literal("importing"), v.literal("completed"), v.literal("failed"))), // Setlist.fm import status
  })
    .index("by_slug", ["slug"])
    .index("by_ticketmaster_id", ["ticketmasterId"])
    .index("by_artist", ["artistId"])
    .index("by_venue", ["venueId"])
    .index("by_status", ["status"])
    .index("by_date", ["date"])
    .index("by_trending_rank", ["trendingRank"]), // Fast trending query

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

  artistSongs: defineTable({
    artistId: v.id("artists"),
    songId: v.id("songs"),
    isPrimaryArtist: v.boolean(),
  })
    .index("by_artist", ["artistId"])
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
    // SEPARATE column for actual setlist from setlist.fm - preserves user predictions
    actualSetlist: v.optional(v.array(v.object({
      title: v.string(),
      album: v.optional(v.string()),
      duration: v.optional(v.number()),
      songId: v.optional(v.id("songs")),
      setNumber: v.optional(v.number()), // 1 = main set, 2 = encore, etc.
      encore: v.optional(v.boolean()),
    }))),
    verified: v.boolean(),
    source: v.union(v.literal("setlistfm"), v.literal("user_submitted")),
    lastUpdated: v.number(),
    isOfficial: v.optional(v.boolean()),
    confidence: v.optional(v.number()),
    upvotes: v.optional(v.number()),
    downvotes: v.optional(v.number()),
    setlistfmId: v.optional(v.string()),
    setlistfmData: v.optional(v.any()), // Raw setlist.fm JSON for reference
    accuracy: v.optional(v.number()), // Calculated accuracy vs actual setlist
    comparedAt: v.optional(v.number()), // When accuracy was calculated
  })
    .index("by_show", ["showId"])
    .index("by_user", ["userId"])
    .index("by_show_and_user", ["showId", "userId"]),

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
    .index("by_user_and_setlist", ["userId", "setlistId"]),


  userFollows: defineTable({
    userId: v.id("users"),
    artistId: v.id("artists"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_artist", ["artistId"])
    .index("by_user_and_artist", ["userId", "artistId"]),

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
      v.literal("artist_import"),
      v.literal("setlist_import")
    ),
    entityId: v.optional(v.string()),
    priority: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    retryCount: v.number(),
    maxRetries: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    // Progress tracking fields
    currentPhase: v.optional(v.string()),
    totalSteps: v.optional(v.number()),
    completedSteps: v.optional(v.number()),
    currentStep: v.optional(v.string()),
    itemsProcessed: v.optional(v.number()),
    totalItems: v.optional(v.number()),
    progressPercentage: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_priority", ["priority"]),

// Add cached trending tables back for compatibility
  trendingShows: defineTable({
    ticketmasterId: v.string(),
    showId: v.optional(v.id("shows")),
    showSlug: v.optional(v.string()),
    artistTicketmasterId: v.optional(v.string()),
    artistId: v.optional(v.id("artists")),
    artistSlug: v.optional(v.string()),
    artistName: v.string(),
    venueName: v.string(),
    venueCity: v.string(),
    venueCountry: v.string(),
    date: v.string(),
    startTime: v.optional(v.string()),
    artistImage: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    status: v.string(),
    rank: v.number(),
    lastUpdated: v.number(),
  })
    .index("by_rank", ["rank"])
    .index("by_last_updated", ["lastUpdated"])
    .index("by_ticketmaster_id", ["ticketmasterId"])
    .index("by_show", ["showId"])
    .index("by_artist", ["artistId"]),

  trendingArtists: defineTable({
    ticketmasterId: v.string(),
    artistId: v.optional(v.id("artists")),
    slug: v.optional(v.string()),
    name: v.string(),
    genres: v.array(v.string()),
    images: v.array(v.string()),
    upcomingEvents: v.number(),
    url: v.optional(v.string()),
    rank: v.number(),
    lastUpdated: v.number(),
  })
    .index("by_rank", ["rank"])
    .index("by_last_updated", ["lastUpdated"])
    .index("by_ticketmaster_id", ["ticketmasterId"])
    .index("by_artist", ["artistId"]),


  // Individual song votes within setlists (ProductHunt style)
  songVotes: defineTable({
    userId: v.union(v.id("users"), v.literal("anonymous")),
    setlistId: v.id("setlists"),
    songTitle: v.string(),
    voteType: v.literal("upvote"),
    createdAt: v.number(),
  })
    .index("by_user_setlist_song", ["userId", "setlistId", "songTitle"])
    .index("by_setlist_song", ["setlistId", "songTitle"])
    .index("by_setlist", ["setlistId"])
    .index("by_user", ["userId"]),

  // Content flagging for moderation
  contentFlags: defineTable({
    reporterId: v.id("users"),
    contentType: v.union(v.literal("setlist"), v.literal("vote"), v.literal("comment")),
    contentId: v.string(),
    reason: v.string(),
    status: v.union(v.literal("pending"), v.literal("reviewed"), v.literal("dismissed")),
    createdAt: v.number(),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_reporter", ["reporterId"]),

  // User achievements for gamification
  userAchievements: defineTable({
    userId: v.id("users"),
    achievementId: v.string(),
    points: v.number(),
    unlockedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_and_achievement", ["userId", "achievementId"]),

  // User's Spotify artists (for users who login with Spotify)
  userSpotifyArtists: defineTable({
    userId: v.id("users"),
    artistId: v.id("artists"),
    isFollowed: v.boolean(), // User follows on Spotify
    isTopArtist: v.boolean(), // In user's top artists
    topArtistRank: v.optional(v.number()), // 1-50 ranking in top artists
    importedAt: v.number(),
    lastUpdated: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_artist", ["artistId"])
    .index("by_user_artist", ["userId", "artistId"]),
};

export default defineSchema({
  ...applicationTables,
});
