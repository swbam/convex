import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./auth";
import { internal, api } from "./_generated/api";

// Check if user is admin
const requireAdmin = async (ctx: any) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Admin access required");
  }

  return user;
};

// Get all users for admin management
export const getAllUsers = query({
  args: { 
    limit: v.optional(v.number()),
    role: v.optional(v.union(v.literal("user"), v.literal("admin")))
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const limit = args.limit || 50;
    let query = ctx.db.query("users");
    
    const users = await query
      .order("desc")
      .take(limit);
    
    // Filter by role if specified
    if (args.role) {
      return users.filter(user => user.role === args.role);
    }
    
    return users;
  },
});

// Ban/unban user
export const toggleUserBan = mutation({
  args: {
    userId: v.id("users"),
    banned: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    await ctx.db.patch(args.userId, {
      role: args.banned ? "banned" : "user",
    });
    
    return null;
  },
});

// Flag content for review
export const flagContent = mutation({
  args: {
    contentType: v.union(v.literal("setlist"), v.literal("vote"), v.literal("comment")),
    contentId: v.string(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to flag content");
    }

    await ctx.db.insert("contentFlags", {
      reporterId: userId,
      contentType: args.contentType,
      contentId: args.contentId,
      reason: args.reason,
      status: "pending",
      createdAt: Date.now(),
    });
    
    return null;
  },
});

// Get flagged content for admin review
export const getFlaggedContent = query({
  args: { 
    status: v.optional(v.union(v.literal("pending"), v.literal("reviewed"), v.literal("dismissed")))
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    if (args.status) {
      // Narrowed branch ensures type for withIndex closure
      const flags = await ctx.db
        .query("contentFlags")
        .withIndex("by_status", (q) => q.eq("status", args.status as "pending" | "reviewed" | "dismissed"))
        .order("desc")
        .take(50);
      return flags;
    } else {
      const flags = await ctx.db
        .query("contentFlags")
        .order("desc")
        .take(50);
      return flags;
    }
  },
});

// Verify setlist as official
export const verifySetlist = mutation({
  args: {
    setlistId: v.id("setlists"),
    verified: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    await ctx.db.patch(args.setlistId, {
      verified: args.verified,
      isOfficial: args.verified,
    });
    
    return null;
  },
});

// Get admin dashboard stats
export const getAdminStats = query({
  args: {},
  returns: v.object({
    totalUsers: v.number(),
    totalArtists: v.number(),
    totalShows: v.number(),
    totalSetlists: v.number(),
    totalVotes: v.number(),
    pendingFlags: v.number(),
    recentActivity: v.array(v.any()),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    
    // Get counts
    const [users, artists, shows, setlists, votes, flags] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("artists").collect(),
      ctx.db.query("shows").collect(),
      ctx.db.query("setlists").collect(),
      ctx.db.query("votes").collect(),
      ctx.db.query("contentFlags").withIndex("by_status", (q) => q.eq("status", "pending")).collect(),
    ]);

    // Get recent activity (last 10 setlists)
    const recentSetlists = await ctx.db
      .query("setlists")
      .order("desc")
      .take(10);

    const recentActivity = await Promise.all(
      recentSetlists.map(async (setlist) => {
        const show = await ctx.db.get(setlist.showId);
        const artist = show ? await ctx.db.get(show.artistId) : null;
        const venue = show ? await ctx.db.get(show.venueId) : null;
        
        return {
          type: "setlist_created",
          setlist,
          show: show ? { ...show, artist, venue } : null,
          timestamp: setlist._creationTime,
        };
      })
    );

    return {
      totalUsers: users.length,
      totalArtists: artists.length,
      totalShows: shows.length,
      totalSetlists: setlists.length,
      totalVotes: votes.length,
      pendingFlags: flags.length,
      recentActivity,
    };
  },
});

// Trigger trending artists sync
export const syncTrendingArtists = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    artistsProcessed: v.number(),
  }),
  handler: async (ctx) => {
    // Check admin permissions in action context
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      console.log("🎤 Admin triggered trending artists sync...");
      
      // Fetch trending artists from Ticketmaster API
      const trendingArtists: any[] = await ctx.runAction(api.ticketmaster.getTrendingArtists, { limit: 30 });
      
      if (!trendingArtists || trendingArtists.length === 0) {
        return {
          success: false,
          message: "No trending artists data retrieved from Ticketmaster API",
          artistsProcessed: 0,
        };
      }

      // Process trending artists to ensure they exist in database
      const processedArtists: any[] = [];
      for (const artist of trendingArtists) {
        try {
          // Check if artist exists
          const existingArtist = await ctx.runQuery(internal.artists.getByTicketmasterIdInternal, { 
            ticketmasterId: artist.ticketmasterId 
          });
          
          if (!existingArtist) {
            // Import the artist
            console.log(`🎤 Importing trending artist: ${artist.name}`);
            await ctx.runAction(api.ticketmaster.triggerFullArtistSync, {
              ticketmasterId: artist.ticketmasterId,
              artistName: artist.name,
              genres: artist.genres || [],
              images: artist.images || [],
            });
          }
          
          processedArtists.push(artist);
        } catch (error) {
          console.error(`Failed to process artist ${artist.name}:`, error);
          processedArtists.push(artist);
        }
      }
      
      // Save to database tables for fast querying
      await ctx.runMutation(internal.trending.saveTrendingArtists, { artists: processedArtists });
      
      console.log(`✅ Successfully synced and saved ${processedArtists.length} trending artists to database`);
      
      return {
        success: true,
        message: `Successfully synced ${processedArtists.length} trending artists`,
        artistsProcessed: processedArtists.length,
      };
      
    } catch (error) {
      console.error("❌ Failed to sync trending artists:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
        artistsProcessed: 0,
      };
    }
  },
});

// Trigger trending shows sync
export const syncTrendingShows = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    showsProcessed: v.number(),
  }),
  handler: async (ctx) => {
    // Check admin permissions in action context
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      console.log("🎵 Admin triggered trending shows sync...");
      
      // Fetch trending shows from Ticketmaster API
      const trendingShows: any[] = await ctx.runAction(api.ticketmaster.getTrendingShows, { limit: 50 });
      
      if (!trendingShows || trendingShows.length === 0) {
        return {
          success: false,
          message: "No trending shows data retrieved from Ticketmaster API",
          showsProcessed: 0,
        };
      }

      // Process trending shows to ensure artist data is properly linked
      const processedShows: any[] = [];
      for (const show of trendingShows) {
        try {
          // Check if artist exists in database
          let artistId: string | null = null;
          if (show.artistTicketmasterId) {
            const artist = await ctx.runQuery(internal.artists.getByTicketmasterIdInternal, { 
              ticketmasterId: show.artistTicketmasterId 
            });
            
            if (artist) {
              artistId = artist._id;
            } else {
              // Import the artist if not exists
              console.log(`🎤 Importing artist for show: ${show.artistName}`);
              artistId = await ctx.runAction(api.ticketmaster.triggerFullArtistSync, {
                ticketmasterId: show.artistTicketmasterId,
                artistName: show.artistName,
                genres: [],
                images: show.artistImage ? [show.artistImage] : [],
              });
            }
          }
          
          processedShows.push({
            ...show,
            artistId: artistId || null,
          });
        } catch (error) {
          console.error(`Failed to process show for ${show.artistName}:`, error);
          processedShows.push(show);
        }
      }
      
      // Save to database tables for fast querying
      await ctx.runMutation(internal.trending.saveTrendingShows, { shows: processedShows });
      
      console.log(`✅ Successfully synced and saved ${processedShows.length} trending shows to database`);
      
      return {
        success: true,
        message: `Successfully synced ${processedShows.length} trending shows`,
        showsProcessed: processedShows.length,
      };
      
    } catch (error) {
      console.error("❌ Failed to sync trending shows:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
        showsProcessed: 0,
      };
    }
  },
});

// Trigger both trending syncs (convenience function)  
export const syncAllTrending = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    artistsProcessed: v.number(),
    showsProcessed: v.number(),
  }),
  handler: async (ctx): Promise<{
    success: boolean;
    message: string;
    artistsProcessed: number;
    showsProcessed: number;
  }> => {
    // Check admin permissions in action context
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser || user.appUser.role !== "admin") {
      throw new Error("Admin access required");
    }

    try {
      console.log("🚀 Admin triggered complete trending sync...");
      
      // Run both syncs sequentially to avoid overwhelming the API
      const artistsResult = await ctx.runAction(api.admin.syncTrendingArtists, {});
      const showsResult = await ctx.runAction(api.admin.syncTrendingShows, {});
      
      const bothSucceeded = artistsResult.success && showsResult.success;
      
      return {
        success: bothSucceeded,
        message: bothSucceeded 
          ? `Successfully synced ${artistsResult.artistsProcessed} artists and ${showsResult.showsProcessed} shows`
          : `Artists: ${artistsResult.message} | Shows: ${showsResult.message}`,
        artistsProcessed: artistsResult.artistsProcessed,
        showsProcessed: showsResult.showsProcessed,
      };
      
    } catch (error) {
      console.error("❌ Failed to sync all trending data:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred",
        artistsProcessed: 0,
        showsProcessed: 0,
      };
    }
  },
});
