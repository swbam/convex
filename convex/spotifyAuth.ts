import { mutation, action, query, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

// Store Spotify access token for a user (called after Spotify OAuth)
export const storeSpotifyTokens = mutation({
  args: {
    spotifyId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Update user with Spotify ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");
    
    await ctx.db.patch(user._id, {
      spotifyId: args.spotifyId,
    });
    
    // Store tokens in a separate secure table (not implemented here for simplicity)
    // In production, you'd want to store these encrypted
    
    return user._id;
  },
});

// Import user's Spotify artists with data from frontend
export const importUserSpotifyArtistsWithToken = action({
  args: {
    followedArtists: v.array(v.object({
      id: v.string(),
      name: v.string(),
      genres: v.array(v.string()),
      images: v.array(v.object({ url: v.string() })),
      followers: v.object({ total: v.number() }),
      popularity: v.number(),
    })),
    topArtists: v.array(v.object({
      id: v.string(),
      name: v.string(),
      genres: v.array(v.string()),
      images: v.array(v.object({ url: v.string() })),
      followers: v.object({ total: v.number() }),
      popularity: v.number(),
    })),
  },
  returns: v.object({
    imported: v.number(),
    correlated: v.number(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user?.appUser) throw new Error("User not found");
    
    console.log("🎵 Importing user's Spotify artists...");
    
    try {
      // Combine and deduplicate artists
      const allArtists = new Map();
      
      // Add followed artists
      args.followedArtists.forEach((artist) => {
        allArtists.set(artist.id, {
          spotifyId: artist.id,
          name: artist.name,
          genres: artist.genres || [],
          images: artist.images?.map((img) => img.url) || [],
          followers: artist.followers?.total || 0,
          popularity: artist.popularity || 0,
          isFollowed: true,
          isTopArtist: false,
        });
      });
      
      // Add/update with top artists
      args.topArtists.forEach((artist, index) => {
        const existing = allArtists.get(artist.id);
        if (existing) {
          existing.isTopArtist = true;
          existing.topArtistRank = index + 1;
        } else {
          allArtists.set(artist.id, {
            spotifyId: artist.id,
            name: artist.name,
            genres: artist.genres || [],
            images: artist.images?.map((img) => img.url) || [],
            followers: artist.followers?.total || 0,
            popularity: artist.popularity || 0,
            isFollowed: false,
            isTopArtist: true,
            topArtistRank: index + 1,
          });
        }
      });
      
      console.log(`📊 Found ${allArtists.size} unique artists from Spotify`);
      
      // Get user ID
      const user = await ctx.runQuery(api.auth.loggedInUser);
      if (!user?.appUser) throw new Error("User not found");
      
      let imported = 0;
      let correlated = 0;
      
      // Process artists in priority order (top artists first, then by popularity)
      const sortedArtists = Array.from(allArtists.values()).sort((a, b) => {
        // Prioritize top artists
        if (a.isTopArtist && !b.isTopArtist) return -1;
        if (!a.isTopArtist && b.isTopArtist) return 1;
        if (a.isTopArtist && b.isTopArtist) {
          return (a.topArtistRank || 999) - (b.topArtistRank || 999);
        }
        // Then by popularity
        return b.popularity - a.popularity;
      });
      
      // Process each artist
      for (const spotifyArtist of sortedArtists) {
        try {
          // Check if artist exists in our DB by Spotify ID
          const existingArtist = await ctx.runQuery(api.artists.getBySpotifyId, {
            spotifyId: spotifyArtist.spotifyId,
          });
          
          let artistId = existingArtist?._id;
          
          if (!existingArtist) {
            // Search by name as fallback
            const byName = await ctx.runQuery(api.artists.getByName, {
              name: spotifyArtist.name,
            });
            
            if (byName) {
              // Update existing artist with Spotify data
              await ctx.runMutation(internal.artists.updateSpotifyData, {
                artistId: byName._id,
                spotifyId: spotifyArtist.spotifyId,
                followers: spotifyArtist.followers,
                popularity: spotifyArtist.popularity,
                genres: spotifyArtist.genres,
                images: spotifyArtist.images,
              });
              artistId = byName._id;
              correlated++;
            } else {
              // Create new artist
              artistId = await ctx.runMutation(internal.artists.create, {
                name: spotifyArtist.name,
                spotifyId: spotifyArtist.spotifyId,
                image: spotifyArtist.images[0] || undefined,
                genres: spotifyArtist.genres,
                popularity: spotifyArtist.popularity,
                followers: spotifyArtist.followers,
                lastSynced: Date.now(),
              });
              imported++;
              
              // Schedule background sync for shows and full catalog (don't await)
              void ctx.scheduler.runAfter(0, internal.spotify.syncArtistCatalog, {
                artistId,
                artistName: spotifyArtist.name,
              });
              
              // Try to find and sync shows from Ticketmaster (don't await)
              void ctx.scheduler.runAfter(1000, internal.ticketmaster.searchAndSyncArtistShows, {
                artistId,
                artistName: spotifyArtist.name,
              });
            }
          } else {
            correlated++;
          }
          
          // Track this artist for the user
          if (artistId) {
            await ctx.runMutation(internal.spotifyAuth.trackUserArtist, {
              userId: user.appUser._id,
              artistId,
              isFollowed: spotifyArtist.isFollowed,
              isTopArtist: spotifyArtist.isTopArtist,
              topArtistRank: spotifyArtist.topArtistRank,
            });
          }
          
        } catch (error) {
          console.error(`Failed to process artist ${spotifyArtist.name}:`, error);
        }
      }
      
      console.log(`✅ Imported ${imported} new artists, correlated ${correlated} existing artists`);
      
      return {
        imported,
        correlated,
        message: `Successfully imported ${imported} new artists and found ${correlated} existing artists from your Spotify`,
      };
      
    } catch (error) {
      console.error("❌ Failed to import Spotify artists:", error);
      throw new Error(`Failed to import Spotify artists: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
});

// Track user's Spotify artist relationship
export const trackUserArtist = internalMutation({
  args: {
    userId: v.id("users"),
    artistId: v.id("artists"),
    isFollowed: v.boolean(),
    isTopArtist: v.boolean(),
    topArtistRank: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if relationship already exists
    const existing = await ctx.db
      .query("userSpotifyArtists")
      .withIndex("by_user_artist", (q) => 
        q.eq("userId", args.userId).eq("artistId", args.artistId)
      )
      .first();
    
    if (existing) {
      // Update existing relationship
      await ctx.db.patch(existing._id, {
        isFollowed: args.isFollowed,
        isTopArtist: args.isTopArtist,
        topArtistRank: args.topArtistRank,
        lastUpdated: Date.now(),
      });
    } else {
      // Create new relationship
      await ctx.db.insert("userSpotifyArtists", {
        userId: args.userId,
        artistId: args.artistId,
        isFollowed: args.isFollowed,
        isTopArtist: args.isTopArtist,
        topArtistRank: args.topArtistRank,
        importedAt: Date.now(),
        lastUpdated: Date.now(),
      });
    }
    
    console.log(`✅ Tracked artist ${args.artistId} for user ${args.userId}`);
    return null;
  },
});

// Get user's Spotify artists with upcoming shows
export const getUserSpotifyArtists = query({
  args: { 
    limit: v.optional(v.number()),
    onlyWithShows: v.optional(v.boolean()),
  },
  returns: v.array(v.object({
    artist: v.any(),
    isFollowed: v.boolean(),
    isTopArtist: v.boolean(),
    topArtistRank: v.optional(v.number()),
    upcomingShowsCount: v.number(),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", identity.subject))
      .first();
    
    if (!user || !user.spotifyId) return [];
    
    const limit = args.limit || 50;
    const onlyWithShows = args.onlyWithShows ?? true;
    
    // Get user's Spotify artists
    const userArtists = await ctx.db
      .query("userSpotifyArtists")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    
    // Sort by priority: top artists first, then by rank
    const sortedUserArtists = userArtists.sort((a, b) => {
      if (a.isTopArtist && !b.isTopArtist) return -1;
      if (!a.isTopArtist && b.isTopArtist) return 1;
      if (a.isTopArtist && b.isTopArtist) {
        return (a.topArtistRank || 999) - (b.topArtistRank || 999);
      }
      return 0;
    });
    
    // Fetch artist details with upcoming shows
    const results = [];
    
    for (const userArtist of sortedUserArtists.slice(0, limit)) {
      const artist = await ctx.db.get(userArtist.artistId);
      if (!artist) continue;
      
      // Count upcoming shows
      const upcomingShows = await ctx.db
        .query("shows")
        .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
        .filter((q) => q.eq(q.field("status"), "upcoming"))
        .collect();
      
      const upcomingShowsCount = upcomingShows.length;
      
      // Skip if no shows and onlyWithShows is true
      if (onlyWithShows && upcomingShowsCount === 0) continue;
      
      results.push({
        artist,
        isFollowed: userArtist.isFollowed,
        isTopArtist: userArtist.isTopArtist,
        topArtistRank: userArtist.topArtistRank,
        upcomingShowsCount,
      });
    }
    
    return results;
  },
});

export const refreshUserTokens = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("🔄 Refreshing Spotify tokens...");
    const usersWithTokens = await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("spotifyId"), null) && q.neq(q.field("spotifyRefreshToken"), null))
      .take(50); // Limit per run

    let refreshed = 0;
    for (const user of usersWithTokens) {
      try {
        const refreshToken = user.spotifyRefreshToken; // Assume field exists
        const response = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: { "Authorization": `Basic ${btoa(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          await ctx.db.patch(user._id, {
            spotifyAccessToken: data.access_token,
            spotifyTokenExpiresAt: Date.now() + data.expires_in * 1000,
          });
          refreshed++;
          console.log(`✅ Refreshed token for user ${user._id}`);
        } else {
          console.error(`❌ Failed refresh for user ${user._id}: ${response.status}`);
          // Optionally revoke or mark invalid
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error refreshing for user ${user._id}:`, error);
      }
    }

    console.log(`✅ Spotify refresh complete: ${refreshed} tokens updated`);
    return null;
  },
});

