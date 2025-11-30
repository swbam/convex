"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

// Type workaround for Convex deep type instantiation issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalRef = internal as any;

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
    try {
      return await fetchWithTimeout(url, init);
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= maxAttempts) {
        console.error(`Spotify fetch failed after ${attempt} attempts for ${url}:`, error);
        throw error;
      }
      const backoffMs = 500 * attempt;
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
      console.log(`Spotify API error: ${response.status} ${response.statusText}`);
      break;
    }

    const data: any = await response.json();
    allItems.push(...(data.items || []));
    nextUrl = data.next;

    // GENIUS rate limiting - Spotify recommends max 180 requests per minute
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  return allItems;
}

async function batchFetchAlbumTracks(albumIds: string[], accessToken: string): Promise<Map<string, any[]>> {
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

  return tracksByAlbum;
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
      // Get access token
      const tokenResponse = await fetchWithRetry(
        "https://accounts.spotify.com/api/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
          body: "grant_type=client_credentials",
        }
      );

      if (!tokenResponse.ok) {
        console.warn('Failed to get Spotify access token for basics');
        return null;
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Search for artist (lightweight call)
      const searchResponse = await fetchWithRetry(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(args.artistName)}&type=artist&limit=1`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      if (!searchResponse.ok) return null;

      const searchData = await searchResponse.json();
      const artists = searchData.artists?.items || [];
      
      if (artists.length === 0) {
        console.log(`No Spotify artist found for basics: ${args.artistName}`);
        return null;
      }

      const spotifyArtist = artists[0];
      
      // Update artist with JUST the basics (not full catalog)
      await ctx.runMutation(internalRef.artists.updateSpotifyData, {
        artistId: args.artistId,
        spotifyId: spotifyArtist.id,
        followers: spotifyArtist.followers?.total,
        popularity: spotifyArtist.popularity,
        genres: spotifyArtist.genres || [],
        images: spotifyArtist.images?.map((img: any) => img.url) || [],
      });

      console.log(`✅ Updated artist ${args.artistName} with Spotify basics (ID: ${spotifyArtist.id})`);
      return null;
    } catch (error) {
      console.error("Failed to sync Spotify basics:", error);
      return null;
    }
  },
});

export const syncArtistCatalog = internalAction({
  args: {
    artistId: v.id("artists"),
    artistName: v.string(),
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

    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;
    const MAX_CONSECUTIVE_FAILURES = 3;

    // CIRCUIT BREAKER: Check if artist is in backoff period due to repeated failures
    if (artist.catalogSyncBackoffUntil && now < artist.catalogSyncBackoffUntil) {
      const hoursRemaining = Math.round((artist.catalogSyncBackoffUntil - now) / 1000 / 60 / 60);
      console.log(`🚫 Circuit breaker active for ${args.artistName} - ${artist.catalogSyncFailureCount || 0} consecutive failures. Backoff for ${hoursRemaining} more hours.`);
      return null;
    }

    // CRITICAL: Check catalogSyncStatus to prevent race conditions
    // Only skip if actively syncing (prevents duplicate concurrent syncs)
    // NOTE: "pending" should NOT block sync - it just means sync was requested but never completed
    if (artist.catalogSyncStatus === "syncing") {
      console.log(`⏭️ Skipping catalog sync for ${args.artistName} - sync already in progress`);
      return null;
    }

    // CRITICAL: Check catalogSyncAttemptedAt (NOT lastSynced) to prevent duplicate syncs
    // The lastSynced field is for general artist metadata, not catalog sync specifically.
    // Using lastSynced here would incorrectly skip catalog sync for newly created artists.
    // EXCEPTION: If catalog sync failed or is pending, allow retry after 1 hour instead of 24 hours
    const RETRY_DELAY_FOR_INCOMPLETE = 60 * 60 * 1000; // 1 hour
    const isIncomplete = artist.catalogSyncStatus === "failed" || artist.catalogSyncStatus === "pending" || artist.catalogSyncStatus === "never";
    const dedupeWindow = isIncomplete ? RETRY_DELAY_FOR_INCOMPLETE : TWENTY_FOUR_HOURS;
    const recentlyAttempted = artist.catalogSyncAttemptedAt && (now - artist.catalogSyncAttemptedAt) < dedupeWindow;

    if (recentlyAttempted) {
      const minutesAgo = Math.round((now - (artist.catalogSyncAttemptedAt || 0)) / 1000 / 60);
      console.log(`⏭️ Skipping catalog sync for ${args.artistName} - attempted ${minutesAgo} minutes ago (status: ${artist.catalogSyncStatus})`);
      return null;
    }

    // Mark sync as in progress BEFORE starting
    await ctx.runMutation(internalRef.artists.updateSyncStatus, {
      artistId: args.artistId,
      catalogSyncAttemptedAt: now,
      catalogSyncStatus: "syncing",
    });

    console.log(`🎵 Starting catalog sync for ${args.artistName} (Last attempt: ${artist.catalogSyncAttemptedAt ? new Date(artist.catalogSyncAttemptedAt).toISOString() : 'never'})`);

    try {
      // Get access token
      const tokenResponse = await fetchWithRetry(
        "https://accounts.spotify.com/api/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
          body: "grant_type=client_credentials",
        }
      );

      if (!tokenResponse.ok) {
        throw new Error('Failed to get Spotify access token');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Search for artist
      const searchResponse = await fetchWithRetry(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(args.artistName)}&type=artist&limit=1`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      if (!searchResponse.ok) {
        console.error(`❌ Spotify search failed for ${args.artistName}: ${searchResponse.status} ${searchResponse.statusText}`);
        await ctx.runMutation(internalRef.artists.updateSyncStatus, {
          artistId: args.artistId,
          catalogSyncStatus: "failed",
        });
        return null;
      }

      const searchData = await searchResponse.json();
      const artists = searchData.artists?.items || [];
      
      if (artists.length === 0) {
        console.log(`⚠️ No Spotify artist found for: ${args.artistName}`);
        await ctx.runMutation(internalRef.artists.updateSyncStatus, {
          artistId: args.artistId,
          catalogSyncStatus: "failed",
        });
        return null;
      }

      const spotifyArtist = artists[0];
      
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

      // GENIUS: Fetch all albums with advanced filtering at API level
      const albumsUrl = `https://api.spotify.com/v1/artists/${spotifyArtist.id}/albums?include_groups=album,single&market=US&limit=50`;
      const albums = await fetchAllSpotifyPages(albumsUrl, accessToken);

      console.log(`📀 Total albums found: ${albums.length}`);

      let songsImported = 0;

      // FIXED: More intelligent album filtering - keep ALL studio albums and singles
      const studioAlbums = (albums as any[])
        .filter(album => {
          // Skip compilations and appears_on
          if (album.album_type === 'compilation') return false;
          if (album.album_group === 'appears_on') return false;
          
          const albumName = album.name.toLowerCase();
          
          // ONLY exclude clear non-studio types:
          const exclude = [
            // Live albums (must have "live" as standalone word or in parentheses)
            ' live ', '(live)', '[live]', 'live at', 'live from',
            // True compilations (not studio albums with "collection" in subtitle)
            'greatest hits', 'best of',
            // Soundtracks
            'soundtrack',
            // Karaoke/Instrumental compilations
            'karaoke', 'instrumental album',
          ];
          
          // More precise matching - avoid false positives
          const matchedExclude = exclude.find(k => {
            if (k.startsWith(' ') && k.endsWith(' ')) {
              // Word boundary check for " live "
              return albumName.includes(k);
            }
            return albumName.includes(k);
          });
          
          if (matchedExclude) {
            console.log(`❌ Filtered album: ${album.name} (matched: ${matchedExclude})`);
            return false;
          }
          
          console.log(`✅ Keeping album: ${album.name} (${album.album_type})`);
          return true;
        })
        .sort((a, b) => {
          // Sort by release date (oldest first = prefer original versions)
          return new Date(a.release_date).getTime() - new Date(b.release_date).getTime();
        });
      
      console.log(`🎯 Filtered to ${studioAlbums.length} pure studio albums from ${albums.length} total`);

      // GENIUS BATCH PROCESSING: Fetch all tracks efficiently
      const albumIds = studioAlbums.map(album => album.id);
      const tracksByAlbum = await batchFetchAlbumTracks(albumIds, accessToken);
      
      // Collect all tracks with album information for duplicate detection
      const allTracks: any[] = [];
      for (const album of studioAlbums) {
        const tracks = tracksByAlbum.get(album.id) || [];
        for (const track of tracks) {
          allTracks.push({
            ...track,
            album_info: album, // Add full album info
          });
        }
      }
      
      console.log(`📊 Collected ${allTracks.length} total tracks from ${studioAlbums.length} albums`);

      // GENIUS DUPLICATE DETECTION: Filter original tracks only
      const originalTracks = await filterOriginalTracks(allTracks, args.artistId, ctx);

      console.log(`🎯 Filtered to ${originalTracks.length} original studio tracks (from ${allTracks.length} total, ${((originalTracks.length / allTracks.length) * 100).toFixed(1)}% kept)`);

      // CRITICAL FIX: Track import progress every 50 songs to detect caps
      console.log(`📝 Beginning import of ${originalTracks.length} songs...`);

      for (let i = 0; i < originalTracks.length; i++) {
        const track = originalTracks[i];

        try {
          // Create song with full metadata
          const songId = await ctx.runMutation(internalRef.songs.create, {
            title: track.name,
            album: track.album_info.name,
            spotifyId: track.id,
            durationMs: track.duration_ms,
            popularity: track.popularity || 0,
            trackNo: track.track_number,
            isLive: false,
            isRemix: false,
          });

          // Link artist to song (with duplicate prevention)
          await ctx.runMutation(internalRef.artistSongs.create, {
            artistId: args.artistId,
            songId,
            isPrimaryArtist: true,
          });

          songsImported++;

          // Progress logging every 50 songs
          if ((i + 1) % 50 === 0) {
            console.log(`📊 Progress: ${i + 1}/${originalTracks.length} songs processed (${songsImported} imported)`);
          }
        } catch (error) {
          console.error(`❌ Failed to import song ${track.name}:`, error);
          // Track error for monitoring
          await ctx.runMutation(internalRef.errorTracking.logError, {
            operation: "spotify_song_import",
            error: error instanceof Error ? error.message : String(error),
            context: {
              artistId: args.artistId,
              artistName: args.artistName,
              additionalData: { songTitle: track.name, album: track.album_info?.name },
            },
            severity: "warning",
          });
        }
      }

      console.log(`✅ Catalog sync completed for ${args.artistName}: ${songsImported}/${originalTracks.length} songs imported successfully`);

      // Mark catalog sync as completed
      await ctx.runMutation(internalRef.artists.updateSyncStatus, {
        artistId: args.artistId,
        catalogSyncStatus: songsImported > 0 ? "completed" : "failed",
      });

      // CRITICAL FIX: Removed post-sync setlist generation to prevent infinite cascade
      // The cron job 'refresh-auto-setlists' will handle setlist generation separately
      // This prevents: catalog sync → auto-generate setlists → trigger more syncs → infinite loop
      // 
      // Previously this code auto-generated setlists for ALL artist shows after sync,
      // which would trigger NEW catalog syncs if those shows also had no songs.
      // This created exponential growth: 1 sync → 20 setlists → 20 syncs → 400 setlists...
      //
      // Setlist generation now happens ONLY via:
      // 1. Cron: 'refresh-auto-setlists' (every 12h, batch of 20)
      // 2. Manual: admin triggers via dashboard
      console.log(`✅ Catalog sync complete for ${args.artistName}: ${songsImported} songs imported`);
      console.log(`ℹ️  Setlist generation will be handled by cron job (refresh-auto-setlists)`)
      
      // CIRCUIT BREAKER: Reset failure count on success
      if (songsImported > 0) {
        await ctx.runMutation(internalRef.artists.updateSyncStatus, {
          artistId: args.artistId,
          catalogSyncFailureCount: 0,
          catalogSyncLastFailure: undefined,
          catalogSyncBackoffUntil: undefined,
        });
      }

    } catch (error) {
      console.error("Failed to sync Spotify catalog:", error);
      
      // CIRCUIT BREAKER: Increment failure count and apply backoff
      const currentFailures = (artist.catalogSyncFailureCount || 0) + 1;
      const backoffHours = currentFailures >= 3 ? 72 : 0; // 72h backoff after 3 failures
      const backoffUntil = backoffHours > 0 ? now + (backoffHours * 60 * 60 * 1000) : undefined;
      
      console.error(`❌ Catalog sync failure ${currentFailures} for ${args.artistName}${backoffHours > 0 ? ` - applying ${backoffHours}h backoff` : ''}`);
      
      // Mark as failed and update circuit breaker state
      await ctx.runMutation(internalRef.artists.updateSyncStatus, {
        artistId: args.artistId,
        catalogSyncStatus: "failed",
        catalogSyncFailureCount: currentFailures,
        catalogSyncLastFailure: now,
        catalogSyncBackoffUntil: backoffUntil,
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

// Removed isHighQualityStudioAlbum - was filtering out too many legitimate albums
// Now relying on isStudioAlbum only for simpler, more inclusive filtering

// GENIUS duplicate detection and original track filtering
async function filterOriginalTracks(allTracks: any[], artistId: string, ctx: any): Promise<any[]> {
  // Group tracks by normalized title to detect duplicates
  const trackGroups = new Map<string, any[]>();
  
  for (const track of allTracks) {
    if (!isStudioSong(track.name, track.album_info.name)) continue;
    
    // Normalize title for duplicate detection
    const normalizedTitle = normalizeTrackTitle(track.name);
    
    if (!trackGroups.has(normalizedTitle)) {
      trackGroups.set(normalizedTitle, []);
    }
    trackGroups.get(normalizedTitle)!.push(track);
  }
  
  const originalTracks: any[] = [];
  
  // For each group of tracks with same title, pick the best one
  for (const [title, tracks] of trackGroups) {
    if (tracks.length === 1) {
      originalTracks.push(tracks[0]);
    } else {
      // Multiple versions - pick the best one using genius logic
      const bestTrack = selectBestTrackVersion(tracks);
      originalTracks.push(bestTrack);
      
      console.log(`🔍 Duplicate detected for "${title}": ${tracks.length} versions, selected from "${bestTrack.album_info.name}"`);
    }
  }
  
  return originalTracks;
}

// Normalize track title for duplicate detection
function normalizeTrackTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    // Remove common variations
    .replace(/\(.*?\)/g, '') // Remove parentheses content
    .replace(/\[.*?\]/g, '') // Remove bracket content  
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s]/g, '') // Remove special characters
    .trim();
}

// Select the best version when multiple tracks have same title
function selectBestTrackVersion(tracks: any[]): any {
  return tracks.sort((a, b) => {
    // Prefer albums over singles
    const albumTypeScore = (track: any) => {
      if (track.album_info.album_type === 'album') return 3;
      if (track.album_info.album_type === 'single') return 2;
      return 1;
    };
    
    // Prefer non-deluxe versions (aggressive detection)
    const isDeluxe = (track: any) => {
      const albumName = track.album_info.name.toLowerCase();
      return albumName.includes('deluxe') || albumName.includes('expanded') || 
             albumName.includes('special') || albumName.includes('remaster') ||
             albumName.includes('edition') || albumName.includes('3am') ||
             albumName.includes('til dawn') || albumName.includes('vault') ||
             albumName.includes('complete') || albumName.includes('enhanced') ||
             albumName.includes('[') || albumName.includes('(from the vault)');
    };
    
    // Prefer higher popularity
    const popularityScore = (track: any) => track.popularity || 0;
    
    // Prefer shorter duration (original versions are usually not extended)
    const durationScore = (track: any) => -(track.duration_ms || 0); // Negative for shorter preference
    
    // Calculate composite score
    const scoreA = albumTypeScore(a) * 1000 + (isDeluxe(a) ? 0 : 500) + popularityScore(a);
    const scoreB = albumTypeScore(b) * 1000 + (isDeluxe(b) ? 0 : 500) + popularityScore(b);
    
    return scoreB - scoreA;
  })[0];
}
