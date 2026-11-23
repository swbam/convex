"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { internalRef } from "./adminHelpers";
import { RELATED_REPERTOIRE, selectRepertoireTracks } from "./lib/spotifyRepertoire";



const SPOTIFY_HTTP_TIMEOUT_MS = 30_000;
const SPOTIFY_MAX_ATTEMPTS = 3;
const STRICT_ALBUM_FILTER = process.env.SPOTIFY_STRICT_MODE !== "false";

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = SPOTIFY_HTTP_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  maxAttempts: number = SPOTIFY_MAX_ATTEMPTS
): Promise<Response> {
  let attempt = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastError: any;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetchWithTimeout(url, init);
      const retryableStatus =
        response.status === 429 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;

      if (!retryableStatus || attempt >= maxAttempts) {
        return response;
      }

      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const backoffMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds * 1000, 30_000)
        : Math.min(500 * 2 ** (attempt - 1), 5_000);
      console.warn(
        `Spotify returned ${response.status}; retrying (${attempt}/${maxAttempts})`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        console.error(`Spotify fetch failed after ${attempt} attempts`, error);
        throw error;
      }
      const backoffMs = Math.min(500 * 2 ** (attempt - 1), 5_000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError ?? new Error("Spotify fetchWithRetry failed");
}

// GENIUS Spotify API helpers
async function fetchAllSpotifyPages<T>(initialUrl: string, accessToken: string): Promise<T[]> {
  const allItems: T[] = [];
  let nextUrl: string | null = initialUrl;

  while (nextUrl) {
    const response = await fetchWithRetry(
      nextUrl,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Spotify pagination failed (${response.status} ${response.statusText})`,
      );
    }

    const data: any = await response.json();
    allItems.push(...(data.items || []));
    nextUrl = data.next;

    // GENIUS rate limiting - Spotify recommends max 180 requests per minute
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  return allItems;
}

async function batchFetchAlbumTracks(albumIds: string[], accessToken: string) {
  const failedAlbumIds: string[] = [];
  const tracksByAlbum = new Map<string, any[]>();

  // Process in batches of 10 albums to be respectful of API limits
  const batchSize = 10;
  for (let i = 0; i < albumIds.length; i += batchSize) {
    const batch = albumIds.slice(i, i + batchSize);

    // Fetch albums in parallel within batch
    const promises = batch.map(async (albumId) => {
      try {
        const tracksUrl = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`;
        const tracks = await fetchAllSpotifyPages(tracksUrl, accessToken);
        return { albumId, tracks };
      } catch (error) {
        console.log(`Failed to fetch tracks for album ${albumId}:`, error);
        failedAlbumIds.push(albumId);
        return { albumId, tracks: [] };
      }
    });

    const results = await Promise.all(promises);
    for (const { albumId, tracks } of results) {
      tracksByAlbum.set(albumId, tracks);
    }

    // Rate limit between batches
    if (i + batchSize < albumIds.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return { tracksByAlbum, failedAlbumIds };
}

// Cache the Spotify client-credentials "app token" across action invocations
// in the same isolate. The token is valid ~1 hour; re-fetching it on every
// catalog/basics/top-tracks call added latency and risked throttling the
// token endpoint. Refresh slightly early (60s skew).
let cachedSpotifyAppToken: { token: string; expiresAt: number } | null = null;

async function getSpotifyAppToken(
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const now = Date.now();
  if (cachedSpotifyAppToken && cachedSpotifyAppToken.expiresAt > now + 60_000) {
    return cachedSpotifyAppToken.token;
  }

  const tokenResponse = await fetchWithRetry("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenResponse.ok) {
    return null;
  }

  const tokenData = await tokenResponse.json();
  const token = tokenData.access_token as string | undefined;
  if (!token) return null;

  const expiresInMs = (Number(tokenData.expires_in) || 3600) * 1000;
  cachedSpotifyAppToken = { token, expiresAt: now + expiresInMs };
  return token;
}

/**
 * Resolve the canonical Spotify artist without allowing a broad name search
 * to silently switch an existing Convex artist to a different Spotify entity.
 * Stored Spotify IDs are authoritative. Name search is only a bootstrap
 * fallback, and prefers an exact normalized name match among the first results.
 */
async function resolveSpotifyArtist(
  accessToken: string,
  artistName: string,
  spotifyId?: string,
): Promise<any | null> {
  if (spotifyId) {
    const artistResponse = await fetchWithRetry(
      `https://api.spotify.com/v1/artists/${encodeURIComponent(spotifyId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (artistResponse.ok) {
      return await artistResponse.json();
    }

    // A removed/merged Spotify artist can legitimately 404. Other failures
    // are transient or authorization related, so fail the sync instead of
    // risking catalog corruption by selecting a similarly named artist.
    if (artistResponse.status !== 404) {
      throw new Error(
        `Spotify artist lookup failed (${artistResponse.status} ${artistResponse.statusText})`,
      );
    }
  }

  const params = new URLSearchParams({
    q: `artist:${artistName}`,
    type: "artist",
    limit: "5",
  });
  const searchResponse = await fetchWithRetry(
    `https://api.spotify.com/v1/search?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!searchResponse.ok) {
    throw new Error(
      `Spotify artist search failed (${searchResponse.status} ${searchResponse.statusText})`,
    );
  }

  const searchData: any = await searchResponse.json();
  const artists: any[] = searchData.artists?.items ?? [];
  const normalizedName = artistName.trim().toLocaleLowerCase();
  return (
    artists.find(
      (candidate) =>
        String(candidate?.name ?? "").trim().toLocaleLowerCase() === normalizedName,
    ) ??
    artists[0] ??
    null
  );
}

// Public action to trigger Spotify data enrichment
export const enrichArtistData = action({
  args: {
    artistId: v.id("artists"),
    artistName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runAction(internalRef.spotify.syncArtistCatalog, {
      artistId: args.artistId,
      artistName: args.artistName,
    });
    return null;
  },
});

// NEW: Lightweight Spotify basics sync (just artist metadata, no catalog)
export const enrichArtistBasics = internalAction({
  args: {
    artistId: v.id("artists"),
    artistName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.log("Spotify credentials not configured");
      return null;
    }

    try {
      // Get a cached Spotify app token (client-credentials)
      const accessToken = await getSpotifyAppToken(clientId, clientSecret);
      if (!accessToken) {
        console.warn('Failed to get Spotify access token for basics');
        return null;
      }

      const artist = await ctx.runQuery(internalRef.artists.getByIdInternal, {
        id: args.artistId,
      });
      const spotifyArtist = await resolveSpotifyArtist(
        accessToken,
        args.artistName,
        artist?.spotifyId,
      );

      if (!spotifyArtist) {
        console.log(`No Spotify artist found for basics: ${args.artistName}`);
        return null;
      }

      // Update artist with JUST the basics (not full catalog)
      await ctx.runMutation(internalRef.artists.updateSpotifyData, {
        artistId: args.artistId,
        spotifyId: spotifyArtist.id,
        followers: spotifyArtist.followers?.total,
        popularity: spotifyArtist.popularity,
        genres: spotifyArtist.genres || [],
        images: spotifyArtist.images?.map((img: any) => img.url) || [],
      });
      await ctx.runMutation(internalRef.artists.recordAutomationSync, {
        artistId: args.artistId,
        lastSpotifyBasicsSyncAt: Date.now(),
      });

      console.log(`✅ Updated artist ${args.artistName} with Spotify basics (ID: ${spotifyArtist.id})`);
      return null;
    } catch (error) {
      console.error("Failed to sync Spotify basics:", error);
      return null;
    }
  },
});

// Fast path: import a small set of Spotify top tracks for an artist.
// This is used to quickly seed an initial prediction setlist (5 songs) without waiting
// for a full catalog import (albums + all tracks).
export const importArtistTopTracks = internalAction({
  args: {
    artistId: v.id("artists"),
    artistName: v.string(),
    maxTracks: v.optional(v.number()),
  },
  returns: v.object({
    imported: v.number(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn("⚠️ Spotify credentials not configured - skipping top tracks import");
      return { imported: 0, reason: "missing_spotify_credentials" };
    }

    // Import more top tracks for better initial experience (while full catalog syncs in background)
    const maxTracks = Math.max(1, Math.min(args.maxTracks ?? 25, 50));

    try {
      // Get a cached Spotify app token (client-credentials)
      const accessToken = await getSpotifyAppToken(clientId, clientSecret);
      if (!accessToken) {
        console.warn("Failed to get Spotify access token for top tracks");
        return { imported: 0, reason: "spotify_token_failed" };
      }

      const artist = await ctx.runQuery(internalRef.artists.getByIdInternal, {
        id: args.artistId,
      });
      const spotifyArtist = await resolveSpotifyArtist(
        accessToken,
        args.artistName,
        artist?.spotifyId,
      );

      if (!spotifyArtist) {
        console.log(`⚠️ No Spotify artist found for top tracks: ${args.artistName}`);
        return { imported: 0, reason: "spotify_artist_not_found" };
      }

      // Update artist basics (id + images + popularity) so the UI can show Spotify media quickly.
      try {
        await ctx.runMutation(internalRef.artists.updateSpotifyData, {
          artistId: args.artistId,
          spotifyId: spotifyArtist.id,
          followers: (() => {
            const followers = spotifyArtist.followers?.total;
            return typeof followers === "number" && Number.isFinite(followers)
              ? followers
              : undefined;
          })(),
          popularity: (() => {
            const popularity = spotifyArtist.popularity;
            return typeof popularity === "number" && Number.isFinite(popularity)
              ? popularity
              : undefined;
          })(),
          genres: spotifyArtist.genres || [],
          images: spotifyArtist.images?.map((img: any) => img.url) || [],
        });
      } catch {
        // ignore
      }

      // Fetch top tracks
      const topTracksResponse = await fetchWithRetry(
        `https://api.spotify.com/v1/artists/${spotifyArtist.id}/top-tracks?market=US`,
        {
          headers: { "Authorization": `Bearer ${accessToken}` },
        }
      );

      if (!topTracksResponse.ok) {
        console.error(`❌ Spotify top-tracks failed for ${args.artistName}: ${topTracksResponse.status} ${topTracksResponse.statusText}`);
        return { imported: 0, reason: "spotify_top_tracks_failed" };
      }

      const topTracksData: any = await topTracksResponse.json();
      const tracks: any[] = Array.isArray(topTracksData.tracks) ? topTracksData.tracks : [];
      const limited = tracks.slice(0, maxTracks);

      let imported = 0;
      for (const track of limited) {
        if (!track?.id || !track?.name) continue;
        const title = String(track.name);
        const lowerTitle = title.toLowerCase();
        const isLive = /\blive\b/.test(lowerTitle);
        const isRemix = /\bremix\b/.test(lowerTitle);

        try {
          const songId = await ctx.runMutation(internalRef.songs.create, {
            title,
            album: track.album?.name ? String(track.album.name) : undefined,
            spotifyId: String(track.id),
            durationMs: typeof track.duration_ms === "number" ? track.duration_ms : undefined,
            popularity: typeof track.popularity === "number" ? track.popularity : 0,
            trackNo: typeof track.track_number === "number" ? track.track_number : undefined,
            isLive,
            isRemix,
          });

          await ctx.runMutation(internalRef.artistSongs.create, {
            artistId: args.artistId,
            songId,
            isPrimaryArtist: true,
          });

          imported += 1;
        } catch (error) {
          console.error(`❌ Failed to import top track ${title} for ${args.artistName}:`, error);
        }
      }

      return { imported };
    } catch (error) {
      console.error("Failed to import Spotify top tracks:", error);
      return { imported: 0, reason: error instanceof Error ? error.message : String(error) };
    }
  },
});

export const syncArtistCatalog = internalAction({
  args: {
    artistId: v.id("artists"),
    artistName: v.string(),
    force: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn("⚠️ Spotify credentials not configured - skipping catalog sync");
      console.warn("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in Convex dashboard");
      return null;
    }

    // CRITICAL FIX: Enhanced deduplication with catalogSyncAttemptedAt
    const artist = await ctx.runQuery(internalRef.artists.getByIdInternal, { id: args.artistId });

    if (!artist) {
      console.log(`❌ Artist not found: ${args.artistId}`);
      return null;
    }

    const attemptedAt = await ctx.runMutation(internalRef.catalogSync.begin, { artistId: args.artistId, force: args.force });
    if (attemptedAt === null) return null;
    const result: {
      albumsExpected: number; albumsFailed: number; tracksExpected: number; tracksImported: number;
      failedAlbumIds: string[]; failedTrackIds: string[]; error?: string;
    } = { albumsExpected: 0, albumsFailed: 0, tracksExpected: 0, tracksImported: 0,
      failedAlbumIds: [], failedTrackIds: [] };

    console.log(`🎵 Starting catalog sync for ${args.artistName} (Last attempt: ${artist.catalogSyncAttemptedAt ? new Date(artist.catalogSyncAttemptedAt).toISOString() : 'never'})`);

    try {
      // Get a cached Spotify app token (client-credentials)
      const accessToken = await getSpotifyAppToken(clientId, clientSecret);
      if (!accessToken) {
        throw new Error('Failed to get Spotify access token');
      }

      const spotifyArtist = await resolveSpotifyArtist(
        accessToken,
        args.artistName,
        artist.spotifyId,
      );

      if (!spotifyArtist) throw new Error("No matching Spotify artist found");

      // Update artist with Spotify data - THIS IS CRITICAL FOR DATA INTEGRITY
      await ctx.runMutation(internalRef.artists.updateSpotifyData, {
        artistId: args.artistId,
        spotifyId: spotifyArtist.id,
        followers: (() => {
          const followers = spotifyArtist.followers?.total;
          return typeof followers === 'number' && Number.isFinite(followers) ? followers : undefined;
        })(),
        popularity: (() => {
          const popularity = spotifyArtist.popularity;
          return typeof popularity === 'number' && Number.isFinite(popularity) ? popularity : undefined;
        })(),
        genres: spotifyArtist.genres || [],
        images: spotifyArtist.images?.map((img: any) => img.url) || [],
      });

      console.log(`✅ Updated artist ${args.artistName} with Spotify ID: ${spotifyArtist.id}`);

      const sources = [spotifyArtist, ...(RELATED_REPERTOIRE[spotifyArtist.id] ?? [])];
      const artistIds = new Set<string>(sources.map(source => source.id));
      const albumsById = new Map<string, any>();
      for (const source of sources) {
        // Paginate every release group. Live albums and deluxe bonus songs are
        // valid repertoire; track credits below exclude unrelated compilation tracks.
        const albums = await fetchAllSpotifyPages<any>(
          `https://api.spotify.com/v1/artists/${source.id}/albums?include_groups=album,single,compilation&market=US&limit=50`, accessToken);
        for (const album of albums) {
          if (album.album_group === "appears_on" || /\b(karaoke|backing tracks)\b/i.test(album.name)) continue;
          albumsById.set(album.id, album);
        }
      }
      const catalogAlbums = [...albumsById.values()];
      let songsImported = 0;

      // GENIUS BATCH PROCESSING: Fetch all tracks efficiently
      const albumIds = catalogAlbums.map(album => album.id);
      result.albumsExpected = albumIds.length;
      const { tracksByAlbum, failedAlbumIds } = await batchFetchAlbumTracks(albumIds, accessToken);
      result.albumsFailed = failedAlbumIds.length;
      result.failedAlbumIds = failedAlbumIds;

      // Collect all tracks with album information for duplicate detection
      const allTracks: any[] = [];
      for (const album of catalogAlbums) {
        const tracks = tracksByAlbum.get(album.id) || [];
        for (const track of tracks) {
          allTracks.push({
            ...track,
            album_info: album, // Add full album info
          });
        }
      }

      console.log(`📊 Collected ${allTracks.length} total tracks from ${catalogAlbums.length} albums`);

      const originalTracks = selectRepertoireTracks(allTracks, artistIds);
      result.tracksExpected = originalTracks.length;
      // A bounded mutation per batch replaces two round trips per song.
      for (let offset = 0; offset < originalTracks.length; offset += 100) {
        const batch = originalTracks.slice(offset, offset + 100);
        try {
          const merged = await ctx.runMutation(internalRef.catalogRepertoire.mergeSpotifyTracks, {
            artistId: args.artistId,
            tracks: batch.map(track => {
              const credited = track.artists.find((a: any) => artistIds.has(a.id));
              return { title: track.repertoireTitle, album: track.album_info.name, spotifyId: track.id,
                sourceArtistName: credited.name, sourceSpotifyArtistId: credited.id, sourceTrackTitle: track.name };
            }),
          });
          songsImported += merged.processed;
          result.tracksImported = songsImported;
        } catch (error) {
          result.failedTrackIds.push(...batch.map(track => String(track.id)));
          console.error("Catalog batch failed", error);
        }
      }

      await ctx.runMutation(internalRef.catalogSync.finish, {
        artistId: args.artistId, attemptedAt, result,
      });
      console.log(`Catalog import for ${args.artistName}: ${songsImported}/${originalTracks.length} tracks, ${result.albumsFailed} failed albums`);
      // Existing scheduled prediction generation remains separate from catalog ingestion.
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Catalog import failed";
      await ctx.runMutation(internalRef.catalogSync.finish, {
        artistId: args.artistId, attemptedAt, result,
      });

      // Track critical catalog sync failure
      await ctx.runMutation(internalRef.errorTracking.logError, {
        operation: "spotify_catalog_sync",
        error: error instanceof Error ? error.message : String(error),
        context: {
          artistId: args.artistId,
          artistName: args.artistName,
        },
        severity: "error",
      });
    }
    return null;
  },
});

// Not used anymore - album filtering done inline above

// ULTRA-STRICT: Studio songs ONLY - exclude all variations
function isStudioSong(songName: string, albumName: string): boolean {
  const songLower = songName.toLowerCase().trim();
  const albumLower = albumName.toLowerCase().trim();

  // Skip pure intro/outro/interlude tracks
  if (["intro", "outro", "interlude", "skit", "prelude", "segue"].includes(songLower)) {
    return false;
  }

  // Regex-based word-boundary filtering to avoid accidental matches (e.g., "Alive")
  const songRejectPatterns: RegExp[] = [
    /\blive\b/i,
    /\blive\s+at\b/i,
    /\blive\s+from\b/i,
    /\blive\s+version\b/i,
    /\bremix\b/i,
    /\brmx\b/i,
    /\bedit\b/i,
    /\bradio\s+edit\b/i,
    /\bextended(\s+version)?\b/i,
    /\bacoustic\b/i,
    /\bunplugged\b/i,
    /\bstripped\b/i,
    /\bdemo\b/i,
    /\balternate(\s+take|\s+version)?\b/i,
    /\bouttake\b/i,
    /\brough\s+mix\b/i,
    /\bwork\s+in\s+progress\b/i,
    /\binstrumental\b/i,
    /\bkaraoke\b/i,
    /\bbacking\s+track\b/i,
    /\b(acapella|a cappella)\b/i,
    /\bcommentary\b/i,
    /\binterview\b/i,
    /\bspoken\s+word\b/i,
    /\bvoice\s+memo\b/i,
  ];

  const albumRejectPatterns: RegExp[] = [
    /\blive\b/i,
    /\bconcert\b/i,
    /\btour\b/i,
    /\bunplugged\b/i,
    /\bacoustic\b/i,
    /\bstripped\b/i,
    /\bremix(es|ed)?\b/i,
    /\bdemo(s)?\b/i,
  ];

  const strictAlbumPatterns: RegExp[] = [
    /\bdeluxe\b/i,
    /\bexpanded\b/i,
    /\btour\s+edition\b/i,
    /\banniversary\b/i,
    /\bspecial\s+edition\b/i,
    /\bsuper\s+deluxe\b/i,
    /\bbonus\s+track\b/i,
    /\bremaster(ed)?\b/i,
  ];

  if (songRejectPatterns.some((pattern) => pattern.test(songName))) {
    console.log(`🚫 Excluded song (title): ${songName}`);
    return false;
  }

  if (albumRejectPatterns.some((pattern) => pattern.test(albumName))) {
    console.log(`🚫 Excluded song (album contains non-studio keyword): ${songName} from ${albumName}`);
    return false;
  }

  if (STRICT_ALBUM_FILTER && strictAlbumPatterns.some((pattern) => pattern.test(albumName))) {
    console.log(`🚫 Excluded song (strict album filter): ${songName} from ${albumName}`);
    return false;
  }

  // Validate length
  if (songLower.length === 0 || songLower.length > 100) {
    console.log(`🚫 Excluded song (length): ${songName} (length: ${songLower.length})`);
    return false;
  }

  return true;
}

