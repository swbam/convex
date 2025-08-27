import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    showId: v.id("shows"),
    songs: v.array(v.string()),
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
        });
        return existing._id;
      }
    }
    
    return await ctx.db.insert("setlists", {
      showId: args.showId,
      userId: userId || undefined,
      songs: args.songs,
      isOfficial: args.isOfficial || false,
      confidence: 0.5,
      upvotes: 0,
      downvotes: 0,
    });
  },
});

export const createOfficial = internalMutation({
  args: {
    showId: v.id("shows"),
    songs: v.array(v.string()),
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
        setlistfmId: args.setlistfmId,
      });
      return existing._id;
    }

    return await ctx.db.insert("setlists", {
      showId: args.showId,
      userId: undefined,
      songs: args.songs,
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
  handler: async (ctx, args) => {
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .collect();

    // Get user data for each setlist
    const enrichedSetlists = await Promise.all(
      setlists.map(async (setlist) => {
        let username = "Anonymous";
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
          score: (setlist.upvotes || 0) - (setlist.downvotes || 0),
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

export const vote = mutation({
  args: {
    setlistId: v.id("setlists"),
    voteType: v.union(v.literal("up"), v.literal("down")),
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
      .query("setlistVotes")
      .withIndex("by_user_and_setlist", (q) => 
        q.eq("userId", userId).eq("setlistId", args.setlistId)
      )
      .first();

    if (existingVote) {
      if (existingVote.voteType === args.voteType) {
        // Remove vote if clicking same button
        await ctx.db.delete(existingVote._id);
        
        // Update setlist counts
        if (args.voteType === "up") {
          await ctx.db.patch(args.setlistId, {
            upvotes: Math.max(0, (setlist.upvotes || 0) - 1),
          });
        } else {
          await ctx.db.patch(args.setlistId, {
            downvotes: Math.max(0, (setlist.downvotes || 0) - 1),
          });
        }
        return "removed";
      } else {
        // Change vote type
        await ctx.db.patch(existingVote._id, {
          voteType: args.voteType,
        });
        
        // Update setlist counts
        if (args.voteType === "up") {
          await ctx.db.patch(args.setlistId, {
            upvotes: (setlist.upvotes || 0) + 1,
            downvotes: Math.max(0, (setlist.downvotes || 0) - 1),
          });
        } else {
          await ctx.db.patch(args.setlistId, {
            downvotes: (setlist.downvotes || 0) + 1,
            upvotes: Math.max(0, (setlist.upvotes || 0) - 1),
          });
        }
        return "changed";
      }
    } else {
      // New vote
      await ctx.db.insert("setlistVotes", {
        userId,
        setlistId: args.setlistId,
        voteType: args.voteType,
      });
      
      // Update setlist counts
      if (args.voteType === "up") {
        await ctx.db.patch(args.setlistId, {
          upvotes: (setlist.upvotes || 0) + 1,
        });
      } else {
        await ctx.db.patch(args.setlistId, {
          downvotes: (setlist.downvotes || 0) + 1,
        });
      }
      return "added";
    }
  },
});

export const getUserVote = query({
  args: { setlistId: v.id("setlists") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    
    const vote = await ctx.db
      .query("setlistVotes")
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
    // Check if a setlist already exists for this show
    const existingSetlist = await ctx.db
      .query("setlists")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .first();

    if (existingSetlist) {
      return existingSetlist._id; // Don't create duplicate
    }

    // Get all songs for this artist
    const artistSongs = await ctx.db
      .query("artistSongs")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .collect();

    if (artistSongs.length === 0) {
      console.log(`No songs found for artist ${args.artistId}, skipping setlist generation`);
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
    const selectedSongs: string[] = [];
    const songsToChooseFrom = [...studioSongs];
    const numSongs = Math.min(5, songsToChooseFrom.length);

    for (let i = 0; i < numSongs; i++) {
      // Weighted random selection - higher popularity songs have better chance
      const totalPopularity = songsToChooseFrom.reduce((sum, song) => sum + (song.popularity || 1), 0);
      let randomValue = Math.random() * totalPopularity;
      
      let selectedIndex = 0;
      for (let j = 0; j < songsToChooseFrom.length; j++) {
        randomValue -= (songsToChooseFrom[j].popularity || 1);
        if (randomValue <= 0) {
          selectedIndex = j;
          break;
        }
      }

      selectedSongs.push(songsToChooseFrom[selectedIndex].title);
      songsToChooseFrom.splice(selectedIndex, 1); // Remove to avoid duplicates
    }

    // Create the auto-generated setlist
    const setlistId = await ctx.db.insert("setlists", {
      showId: args.showId,
      userId: undefined, // System-generated
      songs: selectedSongs,
      isOfficial: false,
      confidence: 0.3, // Lower confidence for auto-generated
      upvotes: 0,
      downvotes: 0,
    });

    console.log(`Auto-generated setlist for show ${args.showId} with ${selectedSongs.length} songs`);
    return setlistId;
  },
});
