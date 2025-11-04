import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { mutation, action, query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

const ENCRYPTION_SECRET = process.env.SPOTIFY_TOKEN_ENC_KEY;

const getEncryptionKey = () => {
  if (!ENCRYPTION_SECRET) {
    throw new Error("Missing SPOTIFY_TOKEN_ENC_KEY environment variable for token encryption");
  }
  return createHash("sha256").update(ENCRYPTION_SECRET).digest();
};

const encryptToken = (token: string) => {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
};

const decryptToken = (token?: string | null) => {
  if (!token) return undefined;
  try {
    if (!ENCRYPTION_SECRET) {
      console.warn("SPOTIFY_TOKEN_ENC_KEY is not set; returning stored token as-is.");
      return token;
    }

    const [ivB64, authTagB64, payloadB64] = token.split(":");
    if (!ivB64 || !authTagB64 || !payloadB64) {
      return undefined;
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const payload = Buffer.from(payloadB64, "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Failed to decrypt Spotify token:", error);
    return undefined;
  }
};

// Store Spotify access token for a user (called after Spotify OAuth)
export const storeSpotifyTokens = mutation({
  args: {
    spotifyId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    tokenType: v.optional(v.string()),
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

    const now = Date.now();
    const existingRecord = await ctx.db
      .query("spotifyTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const encryptedAccessToken = encryptToken(args.accessToken);
    const encryptedRefreshToken = args.refreshToken ? encryptToken(args.refreshToken) : undefined;

    if (existingRecord) {
      await ctx.db.patch(existingRecord._id, {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken ?? existingRecord.refreshToken,
        expiresAt: args.expiresAt,
        scope: args.scope ?? existingRecord.scope,
        tokenType: args.tokenType ?? existingRecord.tokenType,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("spotifyTokens", {
        userId: user._id,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: args.expiresAt,
        scope: args.scope,
        tokenType: args.tokenType,
        updatedAt: now,
      });
    }
    return user._id;
  },
});

export const listStoredSpotifyTokens = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("spotifyTokens").collect();
  },
});

export const updateStoredSpotifyToken = internalMutation({
  args: {
    tokenId: v.id("spotifyTokens"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    tokenType: v.optional(v.string()),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tokenId, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      scope: args.scope,
      tokenType: args.tokenType,
      updatedAt: args.updatedAt,
    });
    return null;
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
        isFollowed: !!userArtist.isFollowed,
        isTopArtist: !!userArtist.isTopArtist,
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
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn("⚠️ Spotify client credentials missing; skipping token refresh.");
      return null;
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRecords = await ctx.runQuery(internal.spotifyAuth.listStoredSpotifyTokens, {});

    let refreshed = 0;
    for (const record of tokenRecords) {
      try {
        const refreshToken = decryptToken(record.refreshToken);
        if (!refreshToken) {
          continue;
        }

        const response = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
        } as RequestInit);

        if (response.ok) {
          const data = await response.json();
          const newAccessToken: string | undefined = data.access_token;
          const newRefreshToken: string | undefined = data.refresh_token;
          const expiresIn: number = typeof data.expires_in === "number" ? data.expires_in : 3600;
          const scope: string | undefined = data.scope;
          const tokenType: string | undefined = data.token_type;

          if (!newAccessToken) {
            console.warn(`⚠️ Spotify refresh response missing access_token for user ${record.userId}`);
            continue;
          }

          await ctx.runMutation(internal.spotifyAuth.updateStoredSpotifyToken, {
            tokenId: record._id,
            accessToken: encryptToken(newAccessToken),
            refreshToken: newRefreshToken ? encryptToken(newRefreshToken) : record.refreshToken,
            expiresAt: Date.now() + expiresIn * 1000,
            scope: scope ?? record.scope,
            tokenType: tokenType ?? record.tokenType,
            updatedAt: Date.now(),
          });

          console.log(`✅ Refreshed Spotify token for user ${record.userId}`);
          refreshed++;
        } else {
          const body = await response.text();
          console.error(`❌ Failed Spotify refresh for user ${record.userId}: ${response.status} – ${body}`);
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error refreshing Spotify token for user ${record.userId}:`, error);
      }
    }

    console.log(`✅ Spotify refresh complete: ${refreshed} tokens updated`);
    return null;
  },
});
