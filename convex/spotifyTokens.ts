"use node";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

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

    const user = await ctx.runQuery(api.auth.loggedInUser, {});
    if (!user?.appUser) throw new Error("User not found");

    await ctx.runMutation(setUserSpotifyId, {
      userId: user.appUser._id,
      spotifyId: args.spotifyId,
    });

    const encryptedAccessToken = encryptToken(args.accessToken);
    const encryptedRefreshToken = args.refreshToken ? encryptToken(args.refreshToken) : undefined;

    const now = Date.now();
    const existingRecord = await ctx.runQuery(listStoredSpotifyToken, {
      userId: user.appUser._id,
    });

    if (existingRecord) {
      await ctx.runMutation(updateStoredSpotifyToken, {
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
      await ctx.runMutation(insertStoredSpotifyToken, {
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

export const listStoredSpotifyToken = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("spotifyTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const updateStoredSpotifyToken = internalMutation({
  args: {
    tokenId: v.id("spotifyTokens"),
    userId: v.id("users"),
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
      userId: args.userId,
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

export const insertStoredSpotifyToken = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    tokenType: v.optional(v.string()),
    updatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("spotifyTokens", {
      userId: args.userId,
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

export const setUserSpotifyId = internalMutation({
  args: {
    userId: v.id("users"),
    spotifyId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      spotifyId: args.spotifyId,
    });
    return null;
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

    const identityRows = await ctx.runQuery(scanAllTokenOwners, {});
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    let refreshed = 0;
    for (const record of identityRows) {
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

          await ctx.runMutation(updateStoredSpotifyToken, {
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

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error refreshing Spotify token for user ${record.userId}:`, error);
      }
    }

    console.log(`✅ Spotify refresh complete: ${refreshed} tokens updated`);
    return null;
  },
});

export const scanAllTokenOwners = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db.query("spotifyTokens").collect();
  },
});

// Expose helpers used by other modules
export const helpers = {
  encryptToken,
  decryptToken,
};

