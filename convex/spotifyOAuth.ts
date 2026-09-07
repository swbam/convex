import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apiRef = api as any;

/** Retrieve the signed-in user's linked provider token on the server only.
 * This links a Spotify listener account; it never proves artist ownership.
 * Clerk manages this credential's refresh lifecycle. Do not invent a refresh
 * token or overwrite separately stored Spotify credentials with guessed expiry.
 */
export const importLinkedSpotify = action({
  args: {},
  returns: v.object({ success: v.boolean(), message: v.string(), imported: v.number(), correlated: v.number() }),
  handler: async (ctx): Promise<{ success: boolean; message: string; imported: number; correlated: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.runQuery(apiRef.auth.loggedInUser, {});
    if (!user?.appUser) throw new Error("Finish setting up your account before syncing Spotify");
    const secret = process.env.CLERK_SECRET_KEY;
    if (!secret) throw new Error("Spotify account sync is not configured");

    const credentials = await fetch(
      `https://api.clerk.com/v1/users/${encodeURIComponent(identity.subject)}/oauth_access_tokens/oauth_spotify?paginated=true`,
      { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(20000) },
    );
    if (!credentials.ok) throw new Error("Unable to access linked Spotify. Please reconnect and try again.");
    const payload = await credentials.json();
    const tokens: Array<{ token?: string }> = Array.isArray(payload) ? payload : payload?.data ?? [];
    const token = tokens.find(item => typeof item.token === "string" && item.token.length > 0)?.token;
    if (!token) throw new Error("Connect your Spotify account before syncing");
    const profileResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000),
    });
    if (!profileResponse.ok) throw new Error("Spotify connection expired or unavailable. Please reconnect.");
    const profile = await profileResponse.json();
    if (typeof profile.id !== "string" || !profile.id) throw new Error("Spotify account could not be identified");
    const result = await ctx.runAction(apiRef.spotifyOAuth.completeSpotifyImport, { accessToken: token });
    if (result.success) {
      await ctx.runMutation(internal.spotifyAuthQueries.setUserSpotifyId, { userId: user.appUser._id, spotifyId: profile.id });
    }
    return result;
  },
});

/**
 * Fetch user's Spotify data using OAuth access token
 * This action is called after successful Spotify OAuth login
 */
export const fetchUserSpotifyData = action({
  args: {
    accessToken: v.string(),
  },
  returns: v.object({
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
  }),
  handler: async (ctx, args) => {
    if (!(await ctx.auth.getUserIdentity())) throw new Error("Not authenticated");
    console.log("🎵 Fetching Spotify data with OAuth token...");
    
    try {
      // Fetch followed artists (up to 50)
      const followedResponse = await fetch(
        "https://api.spotify.com/v1/me/following?type=artist&limit=50",
        {
          headers: {
            Authorization: `Bearer ${args.accessToken}`,
          },
        }
      );

      if (!followedResponse.ok) {
        throw new Error(`Spotify API error: ${followedResponse.status}`);
      }

      const followedData = await followedResponse.json();
      const followedArtists = followedData.artists?.items || [];

      // Fetch top artists (up to 50, long term)
      const topResponse = await fetch(
        "https://api.spotify.com/v1/me/top/artists?limit=50&time_range=long_term",
        {
          headers: {
            Authorization: `Bearer ${args.accessToken}`,
          },
        }
      );

      if (!topResponse.ok) {
        throw new Error(`Spotify API error: ${topResponse.status}`);
      }

      const topData = await topResponse.json();
      const topArtists = topData.items || [];

      console.log(`✅ Fetched ${followedArtists.length} followed artists and ${topArtists.length} top artists`);

      return {
        followedArtists: followedArtists.map((artist: any) => ({
          id: artist.id,
          name: artist.name,
          genres: artist.genres || [],
          images: artist.images || [],
          followers: artist.followers || { total: 0 },
          popularity: artist.popularity || 0,
        })),
        topArtists: topArtists.map((artist: any) => ({
          id: artist.id,
          name: artist.name,
          genres: artist.genres || [],
          images: artist.images || [],
          followers: artist.followers || { total: 0 },
          popularity: artist.popularity || 0,
        })),
      };
    } catch (error) {
      console.error("❌ Error fetching Spotify data:", error);
      throw error;
    }
  },
});

/**
 * Complete Spotify import flow - fetch data and import to database
 */
export const completeSpotifyImport = action({
  args: {
    accessToken: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    imported: v.number(),
    correlated: v.number(),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    message: string;
    imported: number;
    correlated: number;
  }> => {
    console.log("🎵 Starting complete Spotify import...");

    try {
      // Fetch Spotify data
      const spotifyData: {
        followedArtists: Array<{
          id: string;
          name: string;
          genres: string[];
          images: Array<{ url: string }>;
          followers: { total: number };
          popularity: number;
        }>;
        topArtists: Array<{
          id: string;
          name: string;
          genres: string[];
          images: Array<{ url: string }>;
          followers: { total: number };
          popularity: number;
        }>;
      } = await ctx.runAction(apiRef.spotifyOAuth.fetchUserSpotifyData, {
        accessToken: args.accessToken,
      });

      console.log(`📊 Fetched ${spotifyData.followedArtists.length} followed and ${spotifyData.topArtists.length} top artists`);

      // Import to database
      const result: {
        imported: number;
        correlated: number;
        message: string;
      } = await ctx.runAction(apiRef.spotifyAuth.importUserSpotifyArtistsWithToken, spotifyData);

      console.log(`✅ Import complete: ${result.imported} imported, ${result.correlated} correlated`);

      return {
        success: true,
        message: result.message,
        imported: result.imported,
        correlated: result.correlated,
      };
    } catch (error) {
      console.error("❌ Spotify import failed:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        imported: 0,
        correlated: 0,
      };
    }
  },
});
