"use node";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { action, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apiRef = api as any;

const ENCRYPTION_SECRET = process.env.SPOTIFY_TOKEN_ENC_KEY;

const getEncryptionKey = () => {
  if (!ENCRYPTION_SECRET) {
    // Fallback: no encryption key configured, caller should store tokens as-is.
    return null;
  }
  return createHash("sha256").update(ENCRYPTION_SECRET).digest();
};

const encryptToken = (token: string) => {
  const key = getEncryptionKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "SPOTIFY_TOKEN_ENC_KEY not set; storing Spotify token unencrypted in production.",
      );
    } else {
      console.warn(
        "SPOTIFY_TOKEN_ENC_KEY not set; storing Spotify token unencrypted (development).",
      );
    }
    return token;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
};

const decryptToken = (token?: string | null) => {
  if (!token) return undefined;
  try {
    const key = getEncryptionKey();
    // If no key, or token doesn't look like an encrypted payload, treat as plain text.
    if (!key || token.split(":").length !== 3) {
      return token;
    }

    const [ivB64, authTagB64, payloadB64] = token.split(":");
    if (!ivB64 || !authTagB64 || !payloadB64) {
      return token;
    }

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

// Store Spotify access token for a user (Node.js action for encryption)
export const storeSpotifyTokens = action({
  args: {
    spotifyId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    tokenType: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user: any = await ctx.runQuery(apiRef.auth.loggedInUser, {});
    if (!user?.appUser) throw new Error("User not found");
    
    await ctx.runMutation(internalRef.spotifyAuthQueries.setUserSpotifyId, {
      userId: user.appUser._id,
      spotifyId: args.spotifyId,
    });

    const encryptedAccessToken = encryptToken(args.accessToken);
    const encryptedRefreshToken = args.refreshToken ? encryptToken(args.refreshToken) : undefined;

    const now = Date.now();
    const existingRecord = await ctx.runQuery(internalRef.spotifyAuthQueries.getStoredSpotifyToken, {
      userId: user.appUser._id,
    });

    if (existingRecord) {
      await ctx.runMutation(internalRef.spotifyAuthQueries.updateStoredSpotifyToken, {
        tokenId: existingRecord._id,
        userId: user.appUser._id,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken ?? existingRecord.refreshToken,
        expiresAt: args.expiresAt,
        scope: args.scope ?? existingRecord.scope,
        tokenType: args.tokenType ?? existingRecord.tokenType,
        updatedAt: now,
      });
    } else {
      await ctx.runMutation(internalRef.spotifyAuthQueries.insertStoredSpotifyToken, {
        userId: user.appUser._id,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: args.expiresAt,
        scope: args.scope,
        tokenType: args.tokenType,
        updatedAt: now,
      });
    }

    return user.appUser._id;
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
    
    const user = await ctx.runQuery(apiRef.auth.loggedInUser, {});
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
      const user = await ctx.runQuery(apiRef.auth.loggedInUser, {});
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
          const existingArtist = await ctx.runQuery(apiRef.artists.getBySpotifyId, {
            spotifyId: spotifyArtist.spotifyId,
          });
          
          let artistId = existingArtist?._id;
          
          if (!existingArtist) {
            // Search by name as fallback
            const byName = await ctx.runQuery(apiRef.artists.getByName, {
              name: spotifyArtist.name,
            });
            
            if (byName) {
              // Update existing artist with Spotify data
              await ctx.runMutation(internalRef.artists.updateSpotifyData, {
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
              artistId = await ctx.runMutation(internalRef.artists.create, {
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
              void ctx.scheduler.runAfter(0, internalRef.spotify.syncArtistCatalog, {
                artistId,
                artistName: spotifyArtist.name,
              });
              
              // Try to find and sync shows from Ticketmaster (don't await)
              void ctx.scheduler.runAfter(1000, internalRef.ticketmaster.searchAndSyncArtistShows, {
                artistId,
                artistName: spotifyArtist.name,
              });
            }
          } else {
            correlated++;
          }
          
          // Track this artist for the user
          if (artistId) {
            await ctx.runMutation(internalRef.spotifyAuthQueries.trackUserArtist, {
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
    const tokenRecords = await ctx.runQuery(internalRef.spotifyAuthQueries.listStoredSpotifyTokens, {});

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

          await ctx.runMutation(internalRef.spotifyAuthQueries.updateStoredSpotifyToken, {
            tokenId: record._id,
            userId: record.userId,
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
