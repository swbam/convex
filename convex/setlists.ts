import { query, mutation, internalMutation, action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "./auth";

// Helper to safely track errors in mutations
async function trackError(ctx: any, operation: string, error: unknown, context?: any) {
  try {
    await ctx.runMutation(internal.errorTracking.logError, {
      operation,
      error: error instanceof Error ? error.message : String(error),
      context,
      severity: "error",
    });
  } catch (e) {
    // Don't fail the mutation if error tracking fails
    console.error("Failed to track error:", e);
  }
}

export const create = mutation({
  args: {
    showId: v.id("shows"),
    songs: v.array(v.object({
      title: v.string(),
      album: v.optional(v.string()),
      duration: v.optional(v.number()),
      songId: v.optional(v.id("songs")),
    })),
    isOfficial: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    // Check if user already has a setlist for this show
    if (userId) {
      const existing = await ctx.db
        .query("setlists")
        .withIndex("by_show_and_user", (q) => 
          q.eq("showId", args.showId).eq("userId", userId)
        )
        .first();
      
      if (existing) {
        // Update existing setlist
        await ctx.db.patch(existing._id, {
          songs: args.songs,
          lastUpdated: Date.now(),
        });
        return existing._id;
      }
    }
    
    return await ctx.db.insert("setlists", {
      showId: args.showId,
      userId: userId || undefined,
      songs: args.songs,
      verified: false,
      source: "user_submitted",
      lastUpdated: Date.now(),
      isOfficial: args.isOfficial || false,
      confidence: 0.5,
      upvotes: 0,
      downvotes: 0,
    });
  },
});

export const addSongToSetlist = mutation({
  args: {
    showId: v.id("shows"),
    song: v.object({
      title: v.string(),
      album: v.optional(v.string()),
      duration: v.optional(v.number()),
      songId: v.optional(v.id("songs")),
    }),
    anonId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const authUserId = await getAuthUserId(ctx);
      let effectiveUserId: Id<"users"> | string;

      if (!authUserId) {
        if (!args.anonId) {
          throw new Error("Anonymous ID required for unauthenticated users");
        }
        effectiveUserId = args.anonId;
      } else {
        effectiveUserId = authUserId;
      }

    // For anonymous users, enforce limit of 1 total song add
    if (typeof effectiveUserId === "string") {
      const totalAdds = await ctx.db
        .query("userActions")
        .filter((q) => q.eq(q.field("userId"), effectiveUserId))
        .filter((q) => q.eq(q.field("action"), "add_song"))
        .collect();

      if (totalAdds.length >= 1) {
        throw new Error("Anonymous users can only add one song total");
      }
    }

    // Find the shared Setlist Votes record for this show (explicitly not user-specific)
    const communitySetlist = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .filter((q) => q.eq(q.field("isOfficial"), false))
      .filter((q) => q.eq(q.field("userId"), undefined))
      .first();

    let setlistId: Id<"setlists">;

    if (communitySetlist) {
      // Add song if not already present (case insensitive to avoid duplicates)
      const normalizedTitle = args.song.title.toLowerCase().trim();
      const songExists = (communitySetlist.songs || []).some((existing) => {
        const title = typeof existing === "string" ? existing : existing?.title;
        return title ? title.toLowerCase().trim() === normalizedTitle : false;
      });

      if (!songExists) {
        await ctx.db.patch(communitySetlist._id, {
          songs: [...(communitySetlist.songs || []), args.song],
          lastUpdated: Date.now(),
        });
        setlistId = communitySetlist._id;
      } else {
        setlistId = communitySetlist._id;
      }
    } else {
      // Create new shared setlist for this show
      setlistId = await ctx.db.insert("setlists", {
        showId: args.showId,
        userId: undefined, // Shared setlist, not user-specific
        songs: [args.song],
        verified: false,
        source: "user_submitted",
        lastUpdated: Date.now(),
        isOfficial: false,
        confidence: 0.5,
        upvotes: 0,
        downvotes: 0,
      });
    }

      // Log the action for anonymous users (authenticated don't need limit tracking)
      if (typeof effectiveUserId === "string") {
        await ctx.db.insert("userActions", {
          userId: effectiveUserId,
          action: "add_song",
          timestamp: Date.now(),
        });
      }

      return setlistId;
    } catch (error) {
      // Track song addition errors
      await trackError(ctx, "add_song_to_setlist", error, {
        showId: args.showId,
        additionalData: { songTitle: args.song.title },
      });
      throw error;
    }
  },
});

export const createOfficial = internalMutation({
  args: {
    showId: v.id("shows"),
    songs: v.array(v.object({
      title: v.string(),
      album: v.optional(v.string()),
      duration: v.optional(v.number()),
      songId: v.optional(v.id("songs")),
    })),
    setlistfmId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if official setlist already exists
    const existing = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .filter((q) => q.eq(q.field("isOfficial"), true))
      .first();

    if (existing) {
      // Update existing official setlist
      await ctx.db.patch(existing._id, {
        songs: args.songs,
        lastUpdated: Date.now(),
        setlistfmId: args.setlistfmId,
      });
      return existing._id;
    }

    return await ctx.db.insert("setlists", {
      showId: args.showId,
      userId: undefined,
      songs: args.songs,
      verified: true,
      source: "setlistfm",
      lastUpdated: Date.now(),
      isOfficial: true,
      confidence: 1.0,
      upvotes: 0,
      downvotes: 0,
      setlistfmId: args.setlistfmId,
    });
  },
});

export const getByShow = query({
  args: { showId: v.id("shows") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .collect();

    // Get user data for each setlist
    const enrichedSetlists = await Promise.all(
      setlists.map(async (setlist) => {
        let username = "Community";
        if (setlist.userId) {
          const user = await ctx.db.get(setlist.userId);
          if (user) {
            username = user.username;
          }
        } else if (setlist.isOfficial) {
          username = "setlist.fm";
        }
        
        return {
          ...setlist,
          username,
          score: (setlist.upvotes || 0),
        };
      })
    );

    // Sort by official first, then by score, then by creation time
    return enrichedSetlists.sort((a, b) => {
      if (a.isOfficial && !b.isOfficial) return -1;
      if (!a.isOfficial && b.isOfficial) return 1;
      if (a.score !== b.score) return b.score - a.score;
      return b._creationTime - a._creationTime;
    });
  },
});

export const getUserSetlistForShow = query({
  args: { showId: v.id("shows") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    
    return await ctx.db
      .query("setlists")
      .withIndex("by_show_and_user", (q) => 
        q.eq("showId", args.showId).eq("userId", userId)
      )
      .first();
  },
});

// Enhanced voting system per CONVEX.md specification
export const submitVote = mutation({
  args: {
    setlistId: v.id("setlists"),
    voteType: v.union(v.literal("accurate"), v.literal("inaccurate")),
    songVotes: v.optional(v.array(v.object({
      songName: v.string(),
      vote: v.union(v.literal("correct"), v.literal("incorrect"), v.literal("missing")),
    }))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to vote");
    }

    const setlist = await ctx.db.get(args.setlistId);
    if (!setlist) {
      throw new Error("Setlist not found");
    }

    // Can only vote on predicted setlists, not official ones
    if (setlist.isOfficial) {
      throw new Error("Cannot vote on official setlists");
    }

    // Check if user already voted
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_user_and_setlist", (q) =>
        q.eq("userId", userId).eq("setlistId", args.setlistId)
      )
      .first();

    const isAccurate = args.voteType === "accurate";

    if (existingVote) {
      // Update existing vote
      await ctx.db.patch(existingVote._id, {
        voteType: args.voteType,
        songVotes: args.songVotes,
        createdAt: Date.now(), // Update timestamp
      });

      // Update setlist vote counts
      const currentUpvotes = setlist.upvotes || 0;
      const currentDownvotes = setlist.downvotes || 0;
      const wasAccurate = existingVote.voteType === "accurate";

      if (wasAccurate && !isAccurate) {
        // Changed from accurate to inaccurate
        await ctx.db.patch(args.setlistId, {
          upvotes: Math.max(0, currentUpvotes - 1),
          downvotes: currentDownvotes + 1,
        });
      } else if (!wasAccurate && isAccurate) {
        // Changed from inaccurate to accurate
        await ctx.db.patch(args.setlistId, {
          upvotes: currentUpvotes + 1,
          downvotes: Math.max(0, currentDownvotes - 1),
        });
      }
    } else {
      // Create new vote
      await ctx.db.insert("votes", {
        userId,
        setlistId: args.setlistId,
        voteType: args.voteType,
        songVotes: args.songVotes,
        createdAt: Date.now(),
      });

      // Update setlist vote counts
      if (isAccurate) {
        await ctx.db.patch(args.setlistId, {
          upvotes: (setlist.upvotes || 0) + 1,
        });
      } else {
        await ctx.db.patch(args.setlistId, {
          downvotes: (setlist.downvotes || 0) + 1,
        });
      }
    }

    return { success: true };
  },
});

export const getSetlistVotes = query({
  args: { setlistId: v.id("setlists") },
  returns: v.object({
    total: v.number(),
    accurate: v.number(),
    inaccurate: v.number(),
    accuracy: v.number(),
    votes: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_setlist", (q) => q.eq("setlistId", args.setlistId))
      .collect();

    const totalVotes = votes.length;
    const accurateVotes = votes.filter(v => v.voteType === "accurate").length;
    
    // Real-time accuracy calculation
    const accuracy = totalVotes > 0 ? Math.round((accurateVotes / totalVotes) * 100) : 0;
    
    return {
      total: totalVotes,
      accurate: accurateVotes,
      inaccurate: totalVotes - accurateVotes,
      accuracy,
      votes: votes, // Real-time updates!
    };
  },
});

// Legacy vote function for backward compatibility
export const vote = mutation({
  args: {
    setlistId: v.id("setlists"),
    voteType: v.literal("up"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to vote");
    }

    const setlist = await ctx.db.get(args.setlistId);
    if (!setlist) {
      throw new Error("Setlist not found");
    }

    // Can't vote on official setlists
    if (setlist.isOfficial) {
      throw new Error("Cannot vote on official setlists");
    }

    // Check if user already voted
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_user_and_setlist", (q) =>
        q.eq("userId", userId).eq("setlistId", args.setlistId)
      )
      .first();

    if (existingVote) {
      // Toggle off if already upvoted
      await ctx.db.delete(existingVote._id);
      await ctx.db.patch(args.setlistId, {
        upvotes: Math.max(0, (setlist.upvotes || 0) - 1),
      });
      return "removed";
    }

    // New upvote
    await ctx.db.insert("votes", {
      userId,
      setlistId: args.setlistId,
      voteType: "accurate",
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.setlistId, {
      upvotes: (setlist.upvotes || 0) + 1,
    });
    return "added";
  },
});

export const getUserVote = query({
  args: { setlistId: v.id("setlists") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    
    const vote = await ctx.db
      .query("votes")
      .withIndex("by_user_and_setlist", (q) =>
        q.eq("userId", userId).eq("setlistId", args.setlistId)
      )
      .first();
    
    return vote?.voteType || null;
  },
});

export const getByUser = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    
    const limit = args.limit || 10;
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    // Enrich with show data
    return await Promise.all(
      setlists.map(async (setlist) => {
        const show = await ctx.db.get(setlist.showId);
        return { ...setlist, show };
      })
    );
  },
});

export const autoGenerateSetlist = internalMutation({
  args: {
    showId: v.id("shows"),
    artistId: v.id("artists"),
  },
  handler: async (ctx, args) => {
    // CRITICAL: Check if a setlist already exists for this show
    const existingSetlist = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .first();

    // Get all songs for this artist
    const artistSongs = await ctx.db
      .query("artistSongs")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .collect();

    // ENHANCED: If no songs found, schedule catalog import before failing
    if (artistSongs.length === 0) {
      console.log(`⚠️ No songs found for artist ${args.artistId}, scheduling catalog import`);
      
      // Try to trigger catalog import for this artist
      try {
        // Get artist details to pass artist name
        const artist = await ctx.db.get(args.artistId);
        if (artist) {
          void ctx.scheduler.runAfter(0, internal.spotify.syncArtistCatalog, {
            artistId: args.artistId,
            artistName: artist.name,
          });
          console.log(`📅 Scheduled catalog import for artist ${artist.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to schedule catalog import for artist ${args.artistId}:`, error);
      }
      
      return null;
    }

    // Get the actual song records and filter out live/remix versions
    const songs = await Promise.all(
      artistSongs.map(async (artistSong) => {
        return await ctx.db.get(artistSong.songId);
      })
    );

    const studioSongs = songs
      .filter((song): song is NonNullable<typeof song> => song !== null)
      .filter(song => !song.isLive && !song.isRemix)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0)); // Sort by popularity

    if (studioSongs.length === 0) {
      console.log(`No studio songs found for artist ${args.artistId}, skipping setlist generation`);
      return null;
    }

    // Select 5 random songs from the catalog, weighted towards more popular songs
    const selectedSongs: Array<{title: string, album?: string, duration?: number, songId?: Id<"songs">}> = [];
    const songsToChooseFrom = [...studioSongs];
    const numSongs = Math.min(5, songsToChooseFrom.length);

    if (existingSetlist && Array.isArray(existingSetlist.songs) && existingSetlist.songs.length >= numSongs) {
      return existingSetlist._id;
    }

    for (let i = 0; i < numSongs; i++) {
      // Weighted random selection - higher popularity songs have better chance
      const totalPopularity = songsToChooseFrom.reduce((sum, song) => sum + (song.popularity || 1), 0);

      // SAFEGUARD: if total popularity somehow collapses to 0, fall back to uniform random
      const randomValueSeed = totalPopularity > 0 ? Math.random() * totalPopularity : Math.random() * songsToChooseFrom.length;

      let running = randomValueSeed;
      let selectedIndex = 0;
      for (let j = 0; j < songsToChooseFrom.length; j++) {
        const weight = Math.max(1, songsToChooseFrom[j].popularity || 0);
        running -= totalPopularity > 0 ? weight : 1;
        if (running <= 0) {
          selectedIndex = j;
          break;
        }
      }

      const selectedSong = songsToChooseFrom[selectedIndex];
      selectedSongs.push({
        title: selectedSong.title,
        album: selectedSong.album,
        duration: selectedSong.durationMs,
        songId: selectedSong._id,
      });
      songsToChooseFrom.splice(selectedIndex, 1); // Remove to avoid duplicates
    }

    // Create or update the auto-generated setlist
    if (existingSetlist) {
      await ctx.db.patch(existingSetlist._id, {
        songs: selectedSongs,
        lastUpdated: Date.now(),
        source: existingSetlist.source ?? "user_submitted",
        isOfficial: existingSetlist.isOfficial ?? false,
        confidence: existingSetlist.confidence ?? 0.3,
        upvotes: existingSetlist.upvotes ?? 0,
        downvotes: existingSetlist.downvotes ?? 0,
      });
      console.log(`Refreshed auto-generated setlist for show ${args.showId} with ${selectedSongs.length} songs`);
      return existingSetlist._id;
    }

    const setlistId = await ctx.db.insert("setlists", {
      showId: args.showId,
      userId: undefined, // System-generated
      songs: selectedSongs,
      verified: false,
      source: "user_submitted",
      lastUpdated: Date.now(),
      isOfficial: false,
      confidence: 0.3, // Lower confidence for auto-generated
      upvotes: 0,
      downvotes: 0,
    });

    console.log(`Auto-generated setlist for show ${args.showId} with ${selectedSongs.length} songs`);
    return setlistId;
  },
});

// Internal function to update setlist with actual setlist data from setlist.fm
export const updateWithActualSetlist = internalMutation({
  args: {
    showId: v.id("shows"),
    actualSetlist: v.array(v.object({
      title: v.string(),
      setNumber: v.number(),
      encore: v.boolean(),
      album: v.optional(v.any()),
      duration: v.optional(v.number()),
    })),
    setlistfmId: v.string(),
    setlistfmData: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const setlistsForShow = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .collect();

    const predictionSetlist = setlistsForShow.find((setlist: any) => !setlist.isOfficial && !setlist.userId)
      ?? setlistsForShow.find((setlist: any) => !setlist.isOfficial)
      ?? null;

    const officialSetlist = setlistsForShow.find((setlist: any) => setlist.isOfficial) ?? null;

    const predictedSongLookup = new Map<string, any>();
    if (predictionSetlist?.songs) {
      for (const song of predictionSetlist.songs as any[]) {
        const title = typeof song === "string" ? song : song?.title;
        if (!title) continue;
        predictedSongLookup.set(title.toLowerCase().trim(), song);
      }
    }

    const calculateAccuracy = (predictedSongs: any[]) => {
      if (!predictedSongs || predictedSongs.length === 0) {
        return 0;
      }
      const predictedTitles = predictedSongs
        .map((song: any) => (typeof song === "string" ? song : song?.title))
        .filter((title: string | undefined) => Boolean(title))
        .map((title: string) => title.toLowerCase().trim());

      const actualTitles = args.actualSetlist
        .map((song) => song.title.toLowerCase().trim());

      if (predictedTitles.length === 0 || actualTitles.length === 0) {
        return 0;
      }

      const correctPredictions = predictedTitles.filter((title) => actualTitles.includes(title)).length;
      const pct = Math.round((correctPredictions / predictedTitles.length) * 100);
      return Number.isFinite(pct) ? pct : 0;
    };

    if (predictionSetlist) {
      await ctx.db.patch(predictionSetlist._id, {
        actualSetlist: args.actualSetlist,
        setlistfmId: args.setlistfmId,
        setlistfmData: args.setlistfmData,
        lastUpdated: Date.now(),
        accuracy: calculateAccuracy(predictionSetlist.songs || []),
        comparedAt: Date.now(),
      });
    }

    if (officialSetlist) {
      await ctx.db.patch(officialSetlist._id, {
        actualSetlist: args.actualSetlist,
        setlistfmId: args.setlistfmId,
        setlistfmData: args.setlistfmData,
        lastUpdated: Date.now(),

      });
    } else {
      // Create new official setlist with actual setlist data
      await ctx.db.insert("setlists", {
        showId: args.showId,
        userId: undefined,
        songs: [], // Empty predictions (this is the official setlist)
        actualSetlist: args.actualSetlist,
        verified: true,
        source: "setlistfm",
        lastUpdated: Date.now(),
        isOfficial: true,
        confidence: 1.0,
        upvotes: 0,
        downvotes: 0,
        setlistfmId: args.setlistfmId,
        setlistfmData: args.setlistfmData,
      });
    }

    await ctx.db.patch(args.showId, {
      status: "completed",
      setlistfmId: args.setlistfmId,
      lastSynced: Date.now(),
    });

    return null;
  },
});

// Get setlist with vote integration for show pages
export const getSetlistWithVotes = query({
  args: { showId: v.id("shows") },
  returns: v.union(v.object({
    actualSetlist: v.array(v.object({
      title: v.string(),
      setNumber: v.number(),
      encore: v.boolean(),
      album: v.optional(v.any()),
      duration: v.optional(v.number()),
      voteCount: v.optional(v.number()),
      wasPredicted: v.boolean(),
    })),
    unpredictedSongs: v.array(v.object({
      title: v.string(),
      album: v.optional(v.string()),
      duration: v.optional(v.number()),
      songId: v.optional(v.id("songs")),
      voteCount: v.number(),
    })),
    setlistfmData: v.optional(v.any()),
    hasActualSetlist: v.boolean(),
  }), v.null()),
  handler: async (ctx, args) => {
    // Get all setlists for this show
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .collect();

    if (setlists.length === 0) {
      return null;
    }

    // Find the setlist with actual setlist data (from setlist.fm)
    const officialSetlist = setlists.find(s => s.actualSetlist && s.actualSetlist.length > 0);
    
    if (!officialSetlist || !officialSetlist.actualSetlist) {
      return null;
    }

    // Get all song votes for this show
    const allVotes = await ctx.db
      .query("songVotes")
      .withIndex("by_setlist", (q) => q.eq("setlistId", officialSetlist._id))
      .collect();

    // Count votes by song title
    const votesByTitle = new Map<string, number>();
    for (const vote of allVotes) {
      const current = votesByTitle.get(vote.songTitle) || 0;
      votesByTitle.set(vote.songTitle, current + 1);
    }

    // Get all predicted songs from user setlists
    const predictedSongs = new Set<string>();
    const unpredictedSongsMap = new Map<string, any>();
    
    for (const setlist of setlists) {
      for (const song of setlist.songs || []) {
        predictedSongs.add(song.title.toLowerCase().trim());
        unpredictedSongsMap.set(song.title, {
          title: song.title,
          album: song.album,
          duration: song.duration,
          songId: song.songId,
          voteCount: votesByTitle.get(song.title) || 0,
        });
      }
    }

    // Process actual setlist with vote counts
    const actualSetlistWithVotes = officialSetlist.actualSetlist.map(song => ({
      title: song.title,
      setNumber: song.setNumber || 1,
      encore: song.encore || false,
      album: song.album,
      duration: song.duration,
      voteCount: votesByTitle.get(song.title) || 0,
      wasPredicted: predictedSongs.has(song.title.toLowerCase().trim()),
    }));

    // Find songs that were predicted but not played
    const unpredictedSongs = Array.from(unpredictedSongsMap.values()).filter(song => 
      !officialSetlist.actualSetlist!.some(actualSong => 
        actualSong.title.toLowerCase().trim() === song.title.toLowerCase().trim()
      )
    );

    return {
      actualSetlist: actualSetlistWithVotes,
      unpredictedSongs,
      setlistfmData: officialSetlist.setlistfmData,
      hasActualSetlist: true,
    };
  },
});

export const refreshMissingAutoSetlists = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    generated: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 60;
    const upcomingShows = await ctx.db
      .query("shows")
      .withIndex("by_status", (q) => q.eq("status", "upcoming"))
      .take(limit);

    let processed = 0;
    let generated = 0;

    for (const show of upcomingShows) {
      processed += 1;

      // Skip shows without artist reference
      if (!show.artistId) {
        continue;
      }

      const existingSetlist = await ctx.db
        .query("setlists")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .first();

      if (existingSetlist) {
        continue;
      }

      try {
        await ctx.runMutation(internal.setlists.autoGenerateSetlist, {
          showId: show._id,
          artistId: show.artistId,
        });
        generated += 1;
      } catch (error) {
        console.error("Failed to auto-generate setlist", {
          showId: show._id,
          artistId: show.artistId,
          error,
        });
      }
    }

    return { processed, generated };
  },
});

// Public action: ensure an auto-generated prediction setlist exists for a show
export const ensureAutoSetlistForShow = action({
  args: { showId: v.id("shows") },
  returns: v.object({ created: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ created: boolean; message: string }> => {
    console.log(`🔍 Checking if setlist exists for show ${args.showId}...`);
    
    // If a prediction setlist already exists with songs, do nothing
    const setlists = await ctx.runQuery(api.setlists.getByShow, { showId: args.showId });
    const hasPrediction = (setlists || []).some((s: any) => !s.isOfficial && !s.userId && Array.isArray(s.songs) && s.songs.length > 0);
    
    if (hasPrediction) {
      console.log(`✅ Prediction setlist already exists for show ${args.showId}`);
      return { created: false, message: "Setlist already exists" };
    }

    const show = await ctx.runQuery(api.shows.getById, { id: args.showId });
    if (!show) {
      console.log(`❌ Show ${args.showId} not found`);
      return { created: false, message: "Show not found" };
    }

    console.log(`🎵 Creating auto-generated setlist for show ${args.showId}, artist ${show.artistId}...`);

    try {
      const setlistId = await ctx.runMutation(internal.setlists.autoGenerateSetlist, {
        showId: args.showId,
        artistId: show.artistId,
      });
      
      if (setlistId) {
        console.log(`✅ Created setlist ${setlistId} for show ${args.showId}`);
        return { created: true, message: "Setlist created successfully" };
      } else {
        console.log(`⚠️ Auto-generate returned null (likely no songs available yet) for show ${args.showId}`);
        return { created: false, message: "No songs available to generate setlist" };
      }
    } catch (error) {
      console.error(`❌ Failed to create setlist for show ${args.showId}:`, error);
      return { created: false, message: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});

// Public action: refresh missing auto-setlists in bulk
export const refreshMissingAutoSetlistsAction = action({
  args: { limit: v.optional(v.number()) },
  returns: v.object({ processed: v.number(), generated: v.number() }),
  handler: async (ctx, args): Promise<{ processed: number; generated: number }> => {
    const result = await ctx.runMutation(internal.setlists.refreshMissingAutoSetlists, { limit: args.limit });
    return result as { processed: number; generated: number };
  },
});

export const createFromApi = internalMutation({
  args: { 
    showId: v.id("shows"),
    data: v.any(),
  },
  returns: v.id("setlists"),
  handler: async (ctx, args) => {
    const songs = Array.isArray(args.data.songs) ? args.data.songs : [];
    const setlistId = await ctx.db.insert("setlists", {
      showId: args.showId,
      setlistfmId: args.data.id || undefined,
      songs: songs.map((s: any) => ({ title: s.title || s, album: s.album, duration: s.duration, songId: s.songId })),
      actualSetlist: songs.map((s: any) => ({ title: s.title || s, setNumber: s.setNumber, encore: s.encore })),
      isOfficial: true,
      verified: true,
      source: "setlistfm" as const,
      lastUpdated: Date.now(),
    });
    return setlistId;
  },
});
