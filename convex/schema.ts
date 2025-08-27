import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const applicationTables = {
  // Custom users table for app-specific data
  users: defineTable({
    authId: v.string(), // Clerk user ID (string)
    username: v.string(),
    bio: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
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
    isActive: v.boolean(),
    lastSyncAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_trending_score", ["trendingScore"]),

  venues: defineTable({
    name: v.string(),
    city: v.string(),
    country: v.string(),
    address: v.optional(v.string()),
    capacity: v.optional(v.number()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    ticketmasterId: v.optional(v.string()),
  }),

  shows: defineTable({
    slug: v.optional(v.string()),
    artistId: v.id("artists"),
    venueId: v.id("venues"),
    date: v.string(),
    startTime: v.optional(v.string()),
    status: v.union(v.literal("upcoming"), v.literal("completed"), v.literal("cancelled")),
    ticketmasterId: v.optional(v.string()),
    ticketUrl: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_artist", ["artistId"])
    .index("by_venue", ["venueId"])
    .index("by_status", ["status"])
    .index("by_date", ["date"]),

  songs: defineTable({
    title: v.string(),
    album: v.optional(v.string()),
    spotifyId: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    popularity: v.optional(v.number()),
    trackNo: v.optional(v.number()),
    isLive: v.boolean(),
    isRemix: v.boolean(),
  }),

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
  })
    .index("by_show", ["showId"])
    .index("by_user", ["userId"])
    .index("by_show_and_user", ["showId", "userId"]),

  setlistVotes: defineTable({
    userId: v.id("users"),
    setlistId: v.id("setlists"),
    voteType: v.union(v.literal("up"), v.literal("down")),
  })
    .index("by_user", ["userId"])
    .index("by_setlist", ["setlistId"])
    .index("by_user_and_setlist", ["userId", "setlistId"]),

  follows: defineTable({
    userId: v.id("users"),
    artistId: v.id("artists"),
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
    .index("by_priority", ["priority"]),
};

export default defineSchema({
  ...applicationTables,
});
