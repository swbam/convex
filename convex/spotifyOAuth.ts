import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

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
        console.error("Failed to fetch followed artists:", await followedResponse.text());
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
        console.error("Failed to fetch top artists:", await topResponse.text());
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
  handler: async (ctx, args) => {
    console.log("🎵 Starting complete Spotify import...");

    try {
      // Fetch Spotify data
      const spotifyData = await ctx.runAction(internal.spotifyOAuth.fetchUserSpotifyData, {
        accessToken: args.accessToken,
      });

      console.log(`📊 Fetched ${spotifyData.followedArtists.length} followed and ${spotifyData.topArtists.length} top artists`);

      // Import to database
      const result = await ctx.runAction(api.spotifyAuth.importUserSpotifyArtistsWithToken, spotifyData);

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
