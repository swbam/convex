import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const applicationTables = {
  // Custom users table for app-specific data
  users: defineTable({
    authId: v.string(), // Clerk user ID (string)
    username: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
    preferences: v.optional(v.object({
      emailNotifications: v.boolean(),
      favoriteGenres: v.array(v.string()),
    })),
    createdAt: v.number(),
  })
    .index("by_auth_id", ["authId"])
    .index("by_username", ["username"]),

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
  })
    .index("by_slug", ["slug"])
    .index("by_name", ["name"]) 
    .index("by_trending_score", ["trendingScore"])
    .index("by_trending_rank", ["trendingRank"]) 
    .index("by_spotify_id", ["spotifyId"]) 
    .index("by_ticketmaster_id", ["ticketmasterId"]) 
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
    postalCode: v.optional(v.string()),
  })
    .index("by_location", ["city", "country"]) 
    .index("by_ticketmaster_id", ["ticketmasterId"]) 
    .index("by_name_city", ["name", "city"]),

  shows: defineTable({
    slug: v.optional(v.string()),
    artistId: v.id("artists"),
    venueId: v.id("venues"),
    date: v.string(),
    startTime: v.optional(v.string()),
    status: v.union(v.literal("upcoming"), v.literal("completed"), v.literal("cancelled")),
    ticketmasterId: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    // Engagement & trending fields
    setlistCount: v.optional(v.number()),
    voteCount: v.optional(v.number()),
    trendingScore: v.optional(v.number()),
    trendingRank: v.optional(v.number()),
    lastTrendingUpdate: v.optional(v.number()),
    importStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("importing"),
      v.literal("completed"),
      v.literal("failed")
    )),
  })
    .index("by_slug", ["slug"])
    .index("by_artist", ["artistId"])
    .index("by_venue", ["venueId"])
    .index("by_status", ["status"])
    .index("by_date", ["date"]) 
    .index("by_ticketmaster_id", ["ticketmasterId"]) 
    .index("by_trending_rank", ["trendingRank"]),

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
    isOfficial: v.boolean(),
    confidence: v.optional(v.number()),
    upvotes: v.optional(v.number()),
    downvotes: v.optional(v.number()),
    setlistfmId: v.optional(v.string()),
    verified: v.optional(v.boolean()),
    source: v.optional(v.union(v.literal("user_submitted"), v.literal("setlistfm"))),
    lastUpdated: v.optional(v.number()),
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
    .index("by_setlist_song", ["setlistId", "songTitle"]) 
    .index("by_setlist", ["setlistId"]),

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
    venueCountry: v.string(),
    date: v.string(),
    startTime: v.optional(v.string()),
    artistImage: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    status: v.string(),
    rank: v.number(),
    lastUpdated: v.number(),
    ticketmasterId: v.string(),
  })
    .index("by_rank", ["rank"]) 
    .index("by_ticketmaster_id", ["ticketmasterId"]),

  // Track limited anonymous actions to enforce limits
  userActions: defineTable({
    userId: v.string(),
    action: v.union(v.literal("add_song")),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"]) 
    .index("by_action", ["action"]),


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
      v.literal("full_sync")
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
    .index("by_priority", ["priority"]) 
    .index("by_type_and_status", ["type", "status"]),
};

export default defineSchema({
  ...applicationTables,
});
