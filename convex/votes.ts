import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./auth";

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

    // Check if user already voted on this setlist
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("setlist", (q) => q.eq("setlistId", args.setlistId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (existingVote) {
      // Update existing vote
      await ctx.db.patch(existingVote._id, {
        voteType: args.voteType,
        songVotes: args.songVotes,
        createdAt: Date.now(), // Update timestamp
      });
      return { success: true, updated: true };
    } else {
      // Create new vote
      await ctx.db.insert("votes", {
        userId,
        setlistId: args.setlistId,
        voteType: args.voteType,
        songVotes: args.songVotes,
        createdAt: Date.now(),
      });
      return { success: true, updated: false };
    }
  },
});

export const getSetlistVotes = query({
  args: { setlistId: v.id("setlists") },
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("votes")
      .withIndex("setlist", (q) => q.eq("setlistId", args.setlistId))
      .collect();

    const totalVotes = votes.length;
    const accurateVotes = votes.filter(v => v.voteType === "accurate").length;
    const inaccurateVotes = votes.filter(v => v.voteType === "inaccurate").length;
    
    // Calculate accuracy percentage
    const accuracy = totalVotes > 0 ? (accurateVotes / totalVotes) * 100 : 0;

    // Analyze song-level votes
    const songVoteAnalysis = new Map();
    
    votes.forEach(vote => {
      if (vote.songVotes) {
        vote.songVotes.forEach(songVote => {
          const songName = songVote.songName;
          if (!songVoteAnalysis.has(songName)) {
            songVoteAnalysis.set(songName, {
              correct: 0,
              incorrect: 0,
              missing: 0,
              total: 0
            });
          }
          
          const analysis = songVoteAnalysis.get(songName);
          analysis[songVote.vote]++;
          analysis.total++;
          songVoteAnalysis.set(songName, analysis);
        });
      }
    });

    // Convert map to array for easier consumption
    const songVotes = Array.from(songVoteAnalysis.entries()).map(([songName, stats]) => ({
      songName,
      stats,
      accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0
    }));

    return {
      total: totalVotes,
      accurate: accurateVotes,
      inaccurate: inaccurateVotes,
      accuracy: Math.round(accuracy * 10) / 10, // Round to 1 decimal place
      votes: votes, // Real-time updates!
      songVotes: songVotes,
    };
  },
});

export const getUserVoteForSetlist = query({
  args: { setlistId: v.id("setlists") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("votes")
      .withIndex("setlist", (q) => q.eq("setlistId", args.setlistId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
  },
});

export const getRecentVotes = query({
  args: { 
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    return await ctx.db
      .query("votes")
      .order("desc")
      .take(limit);
  },
});

export const getVotesByUser = query({
  args: { 
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    return await ctx.db
      .query("votes")
      .withIndex("user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

export const deleteVote = mutation({
  args: { voteId: v.id("votes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to delete votes");
    }

    const vote = await ctx.db.get(args.voteId);
    if (!vote) {
      throw new Error("Vote not found");
    }

    // Only allow users to delete their own votes
    if (vote.userId !== userId) {
      throw new Error("Can only delete your own votes");
    }

    await ctx.db.delete(args.voteId);
    return { success: true };
  },
});

// Analytics functions for voting insights
export const getVotingStats = query({
  args: {},
  handler: async (ctx) => {
    const allVotes = await ctx.db.query("votes").collect();
    
    const totalVotes = allVotes.length;
    const accurateVotes = allVotes.filter(v => v.voteType === "accurate").length;
    const inaccurateVotes = allVotes.filter(v => v.voteType === "inaccurate").length;
    
    const overallAccuracy = totalVotes > 0 ? (accurateVotes / totalVotes) * 100 : 0;
    
    // Calculate votes per day (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentVotes = allVotes.filter(v => v.createdAt > thirtyDaysAgo);
    
    const votesPerDay = recentVotes.length / 30;
    
    return {
      totalVotes,
      accurateVotes,
      inaccurateVotes,
      overallAccuracy: Math.round(overallAccuracy * 10) / 10,
      votesPerDay: Math.round(votesPerDay * 10) / 10,
      recentVotesCount: recentVotes.length,
    };
  },
});

// Internal functions for system operations
export const getBySetlist = internalQuery({
  args: { setlistId: v.id("setlists") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("votes")
      .withIndex("setlist", (q) => q.eq("setlistId", args.setlistId))
      .collect();
  },
});

export const createVote = internalMutation({
  args: {
    userId: v.id("users"),
    setlistId: v.id("setlists"),
    voteType: v.union(v.literal("accurate"), v.literal("inaccurate")),
    songVotes: v.optional(v.array(v.object({
      songName: v.string(),
      vote: v.union(v.literal("correct"), v.literal("incorrect"), v.literal("missing")),
    }))),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("votes", {
      userId: args.userId,
      setlistId: args.setlistId,
      voteType: args.voteType,
      songVotes: args.songVotes,
      createdAt: args.createdAt,
    });
  },
});

export const deleteOldVotes = internalMutation({
  args: { cutoffDate: v.number() },
  handler: async (ctx, args) => {
    const oldVotes = await ctx.db
      .query("votes")
      .filter((q) => q.lt(q.field("createdAt"), args.cutoffDate))
      .collect();

    for (const vote of oldVotes) {
      await ctx.db.delete(vote._id);
    }

    return { deleted: oldVotes.length };
  },
});