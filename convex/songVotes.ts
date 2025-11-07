import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getAuthUserId } from "./auth";
import { Id } from "./_generated/dataModel";

// Vote on individual songs within setlists
export const voteOnSong = mutation({
  args: {
    setlistId: v.id("setlists"),
    songTitle: v.string(),
    voteType: v.literal("upvote"), // Only upvotes per ProductHunt style
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

    // Check if user already voted on this song in this setlist
    const existingVote = await ctx.db
      .query("songVotes")
      .withIndex("by_user_setlist_song", (q) =>
        q.eq("userId", effectiveUserId)
         .eq("setlistId", args.setlistId)
         .eq("songTitle", args.songTitle)
      )
      .first();

    if (existingVote) {
      // Remove existing vote (toggle off)
      await ctx.db.delete(existingVote._id);
      return null;
    }

    // Validate - one vote per user per song
    if (typeof effectiveUserId === "string" && effectiveUserId.startsWith("user_")) {
      // For authenticated users, check for any existing vote on this song
      const userVote = await ctx.db
        .query("songVotes")
        .withIndex("by_user_setlist_song", (q) =>
          q.eq("userId", effectiveUserId)
           .eq("setlistId", args.setlistId)
           .eq("songTitle", args.songTitle)
        )
        .first();

      if (userVote) {
        throw new Error("Already voted on this song");
      }
    }

    // For anonymous users, enforce limit of 1 total upvote
    if (typeof effectiveUserId === "string") {
      const totalVotes = await ctx.db
        .query("songVotes")
        .withIndex("by_user", (q) => q.eq("userId", effectiveUserId))
        .collect();

      if (totalVotes.length >= 1) {
        throw new Error("Anonymous users can only upvote one song total");
      }
    }

    // Create new vote
    await ctx.db.insert("songVotes", {
      userId: effectiveUserId,
      setlistId: args.setlistId,
      songTitle: args.songTitle,
      voteType: args.voteType,
      createdAt: Date.now(),
    });

    return null;
    } catch (error) {
      // Track voting errors
      await ctx.runMutation(internal.errorTracking.logError, {
        operation: "song_vote",
        error: error instanceof Error ? error.message : String(error),
        context: {
          setlistId: args.setlistId,
          additionalData: { songTitle: args.songTitle },
        },
        severity: "warning",
      });
      throw error;
    }
  }
});

// Get vote count for a specific song in a setlist
export const getSongVotes = query({
  args: { 
    setlistId: v.id("setlists"),
    songTitle: v.string()
  },
  returns: v.object({
    upvotes: v.number(),
    userVoted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    const votes = await ctx.db
      .query("songVotes")
      .withIndex("by_setlist_song", (q) => 
        q.eq("setlistId", args.setlistId)
         .eq("songTitle", args.songTitle)
      )
      .collect();

    const userVote = userId ? votes.find(v => v.userId === userId) : null;

    return {
      upvotes: votes.length,
      userVoted: !!userVote,
    };
  },
});

// Get all votes for a setlist (for displaying song popularity)
export const getSetlistSongVotes = query({
  args: { setlistId: v.id("setlists") },
  returns: v.array(v.object({
    songTitle: v.string(),
    upvotes: v.number(),
    userVoted: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    const votes = await ctx.db
      .query("songVotes")
      .withIndex("by_setlist", (q) => q.eq("setlistId", args.setlistId))
      .collect();

    // Group by song title
    const songVoteMap = new Map<string, { upvotes: number; userVoted: boolean }>();
    
    for (const vote of votes) {
      const current = songVoteMap.get(vote.songTitle) || { upvotes: 0, userVoted: false };
      current.upvotes++;
      if (userId && vote.userId === userId) {
        current.userVoted = true;
      }
      songVoteMap.set(vote.songTitle, current);
    }

    return Array.from(songVoteMap.entries()).map(([songTitle, data]) => ({
      songTitle,
      upvotes: data.upvotes,
      userVoted: data.userVoted,
    }));
  },
});

// Get all user votes for dashboard
export const getUserVotes = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const limit = args.limit || 50;

    const votes = await ctx.db
      .query("songVotes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
      
    return votes;
  },
});
