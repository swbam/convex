"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

// GENIUS Spotify API helpers
async function fetchAllSpotifyPages<T>(initialUrl: string, accessToken: string): Promise<T[]> {
  const allItems: T[] = [];
  let nextUrl: string | null = initialUrl;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

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
    await ctx.runAction(internal.spotify.syncArtistCatalog, {
      artistId: args.artistId,
      artistName: args.artistName,
    });
    return null;
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
      console.log("Spotify credentials not configured");
      return null;
    }

    try {
      // Get access token
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get Spotify access token');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Search for artist
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(args.artistName)}&type=artist&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!searchResponse.ok) return null;

      const searchData = await searchResponse.json();
      const artists = searchData.artists?.items || [];
      
      if (artists.length === 0) {
        console.log(`No Spotify artist found for: ${args.artistName}`);
        return null;
      }

      const spotifyArtist = artists[0];
      
      // Update artist with Spotify data - THIS IS CRITICAL FOR DATA INTEGRITY
      await ctx.runMutation(internal.artists.updateSpotifyData, {
        artistId: args.artistId,
        spotifyId: spotifyArtist.id,
        followers: spotifyArtist.followers?.total,
        popularity: spotifyArtist.popularity,
        genres: spotifyArtist.genres || [],
        images: spotifyArtist.images?.map((img: any) => img.url) || [],
      });

      console.log(`✅ Updated artist ${args.artistName} with Spotify ID: ${spotifyArtist.id}`);

      // GENIUS: Fetch all albums with advanced filtering at API level
      const albumsUrl = `https://api.spotify.com/v1/artists/${spotifyArtist.id}/albums?include_groups=album,single&market=US&limit=50`;
      const albums = await fetchAllSpotifyPages(albumsUrl, accessToken);

      console.log(`📀 Total albums found: ${albums.length}`);

      let songsImported = 0;

      // GENIUS ALBUM FILTERING: Advanced filtering with appears_on exclusion
      const studioAlbums = (albums as any[])
        .filter(album => {
          // Skip compilations and appears_on at API level
          if (album.album_type === 'compilation') return false;
          if (album.album_group === 'appears_on') return false;
          
          return isStudioAlbum(album.name) && isHighQualityStudioAlbum(album);
        })
        .sort((a, b) => {
          // Prioritize by album type: album > single
          const typeScore = (album: any) => album.album_type === 'album' ? 3 : 2;
          
          // Prioritize by release date (newer first for relevance)
          const dateScore = new Date(b.release_date).getTime() - new Date(a.release_date).getTime();
          
          return typeScore(b) - typeScore(a) || dateScore;
        })
        .slice(0, 15); // Limit to top 15 studio albums for performance
      
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
      
      console.log(`📊 Collected ${allTracks.length} tracks from ${studioAlbums.length} albums`);

      // GENIUS DUPLICATE DETECTION: Filter original tracks only
      const originalTracks = await filterOriginalTracks(allTracks, args.artistId, ctx);
      
      console.log(`🎯 Filtered to ${originalTracks.length} original studio tracks`);

      // Process filtered tracks
      for (const track of originalTracks) {
        try {
          // Create song with full metadata
          const songId = await ctx.runMutation(internal.songs.create, {
            title: track.name,
            album: track.album_info.name,
            spotifyId: track.id,
            durationMs: track.duration_ms,
            popularity: track.popularity || 0,
            trackNo: track.track_number,
            isLive: false,
            isRemix: false,
          });

          // Link artist to song
          await ctx.runMutation(internal.artistSongs.create, {
            artistId: args.artistId,
            songId,
            isPrimaryArtist: true,
          });

          songsImported++;
        } catch (error) {
          console.error(`Failed to import song ${track.name}:`, error);
        }
      }

      console.log(`✅ Catalog sync completed for ${args.artistName}: ${songsImported} songs imported`);

      // Auto-generate setlists for shows without them
      try {
        const artistShows = await ctx.runQuery(internal.shows.getAllByArtistInternal, { artistId: args.artistId });
        
        for (const show of artistShows) {
          const existingSetlists = await ctx.runQuery(api.setlists.getByShow, { showId: show._id });
          
          if (!existingSetlists || existingSetlists.length === 0) {
            await ctx.runMutation(internal.setlists.autoGenerateSetlist, {
              showId: show._id,
              artistId: args.artistId,
            });
          }
        }
      } catch (e) {
        console.error('Failed to auto-generate setlists after catalog import:', e);
      }

    } catch (error) {
      console.error("Failed to sync Spotify catalog:", error);
    }
    return null;
  },
});

// GENIUS studio album filtering system - ULTRATHINK 10x
function isStudioAlbum(albumName: string): boolean {
  const albumLower = albumName.toLowerCase().trim();
  
  // LIVE ALBUM KEYWORDS - Comprehensive list
  const liveKeywords = [
    'live at', 'live from', 'live in', 'live on', 'live session', 'live recording',
    'concert at', 'concert from', 'bootleg', 'acoustic session', 'unplugged',
    'bbc session', 'radio session', 'live performance', 'in concert',
    '(live)', '[live]', 'mtv unplugged', 'tiny desk', 'live lounge',
    'live acoustic', 'live version', 'concert recording', 'live album',
    'live ep', 'live tracks', 'performance', 'sessions', 'live studio',
    '- live', ' - live'
  ];
  
  // COMPILATION/REISSUE KEYWORDS
  const compilationKeywords = [
    'greatest hits', 'best of', 'collection', 'anthology', 'complete works',
    'essential', 'definitive', 'ultimate', 'platinum collection', 'gold',
    'retrospective', 'selected', 'hits', 'singles collection', 'compilation',
    'the very best', 'classics', 'masterpiece', 'legendary'
  ];
  
  // DELUXE/REISSUE KEYWORDS (often contain duplicate/live tracks)
  const deluxeKeywords = [
    'deluxe', 'deluxe edition', 'édition de luxe', 'expanded edition', 'special edition',
    'collector edition', 'anniversary edition', 'remaster', 'remastered', 'redux',
    'revisited', 'extended', 'super deluxe', 'platinum edition', 'limited edition',
    'bonus tracks', 'expanded', 'reissue', 'anniversary', 'collector\'s edition',
    'tour edition', 'tour version', 'concert edition', 'live edition'
  ];
  
  // SOUNDTRACK/MISC KEYWORDS
  const soundtrackKeywords = [
    'soundtrack', 'ost', 'original soundtrack', 'score', 'theme from',
    'music from', 'inspired by', 'songs from', 'motion picture'
  ];
  
  // Check all exclusion categories
  const isLive = liveKeywords.some(keyword => albumLower.includes(keyword));
  const isCompilation = compilationKeywords.some(keyword => albumLower.includes(keyword));
  const isDeluxe = deluxeKeywords.some(keyword => albumLower.includes(keyword));
  const isSoundtrack = soundtrackKeywords.some(keyword => albumLower.includes(keyword));
  
  // GENIUS LOGIC: Only accept pure studio albums
  return !isLive && !isCompilation && !isDeluxe && !isSoundtrack;
}

// GENIUS studio song filtering system - ULTRATHINK 10x
function isStudioSong(songName: string, albumName: string): boolean {
  const songLower = songName.toLowerCase().trim();
  const albumLower = albumName.toLowerCase().trim();
  
  // LIVE SONG KEYWORDS - Comprehensive
  const liveSongKeywords = [
    'live at', 'live from', 'live in', 'live on', 'live version', 'live recording',
    'concert at', 'concert from', 'concert version', 'bootleg', '(live)', '[live]',
    'acoustic live', 'acoustic version', 'acoustic session', 'unplugged version',
    'radio session', 'bbc session', 'live session', 'live acoustic', 'live performance',
    'live studio', 'live rehearsal', 'soundcheck', 'rehearsal', 'demo version',
    'live demo', 'live take', 'live cut', 'concert recording', '- live', ' - live'
  ];
  
  // REMIX/ALTERNATE VERSION KEYWORDS
  const remixKeywords = [
    'remix', 'rmx', 'rework', 'edit', 'mix)', 'version)', 'alternate version',
    'alternative version', 'radio edit', 'extended version', 'club mix', 'dance mix',
    'instrumental version', 'karaoke version', 'backing track', 'minus one',
    'clean version', 'explicit version', 'radio version', 'single version',
    'album version', 'original mix', 'vocal mix', 'dub mix', 'ambient mix'
  ];
  
  // COLLABORATION/FEATURE KEYWORDS (often duplicates)
  const featureKeywords = [
    'feat.', 'featuring', 'ft.', 'with', '(with ', 'duet with', 'vs.', 'versus',
    'and', ' x ', 'collaboration', 'collab'
  ];
  
  // BONUS/EXTRA TRACK KEYWORDS
  const bonusKeywords = [
    'bonus track', 'bonus', 'extra track', 'hidden track', 'secret track',
    'unlisted track', 'b-side', 'rare track', 'outtake', 'alternate take',
    'unreleased', 'vault track', 'deleted scene', 'cut track'
  ];
  
  // INSTRUMENTAL/KARAOKE KEYWORDS
  const instrumentalKeywords = [
    'instrumental', 'karaoke', 'backing track', 'playback', 'minus one',
    'without vocals', 'music only', 'track only', 'accompaniment'
  ];
  
  // Check all exclusion categories
  const isLive = liveSongKeywords.some(keyword => 
    songLower.includes(keyword) || albumLower.includes(keyword)
  );
  
  const isRemix = remixKeywords.some(keyword => 
    songLower.includes(keyword)
  );
  
  const hasFeatures = featureKeywords.some(keyword => 
    songLower.includes(keyword)
  );
  
  const isBonus = bonusKeywords.some(keyword => 
    songLower.includes(keyword) || albumLower.includes(keyword)
  );
  
  const isInstrumental = instrumentalKeywords.some(keyword => 
    songLower.includes(keyword)
  );
  
  // GENIUS LOGIC: Only accept pure studio songs
  const isPureStudio = !isLive && !isRemix && !hasFeatures && !isBonus && !isInstrumental;
  
  // Additional validation: Song title should be reasonable length and not contain weird characters
  const hasReasonableTitle = songLower.length >= 1 && songLower.length <= 100 && 
                            !songLower.includes('track ') && 
                            !songLower.match(/^(intro|outro|interlude|skit)$/);
  
  return isPureStudio && hasReasonableTitle;
}

// GENIUS high-quality studio album detection
function isHighQualityStudioAlbum(album: any): boolean {
  const albumName = album.name.toLowerCase().trim();
  
  // Check for minimum track count (avoid singles masquerading as albums)
  const minTracks = album.album_type === 'album' ? 8 : 3;
  if (album.total_tracks < minTracks) return false;
  
  // Avoid albums with suspicious patterns
  const suspiciousPatterns = [
    /\d{4}/, // Years in title often indicate reissues
    /vol\./i, // Volume numbers indicate compilations
    /part \d/i, // Part numbers
    /disc \d/i, // Disc numbers
    /cd \d/i, // CD numbers
    /\(disc \d\)/i, // Disc indicators
  ];
  
  const hasSuspiciousPattern = suspiciousPatterns.some(pattern => 
    pattern.test(albumName)
  );
  
  if (hasSuspiciousPattern) return false;
  
  // Prefer albums with reasonable names (not too long, not too short)
  if (albumName.length < 2 || albumName.length > 80) return false;
  
  // Avoid albums that are clearly not main releases
  const avoidPatterns = [
    'ep', 'single', 'maxi', 'promo', 'sampler', 'preview', 'teaser',
    'snippet', 'clip', 'trailer', 'demo tape', 'rough mix'
  ];
  
  const shouldAvoid = avoidPatterns.some(pattern => 
    albumName.includes(pattern)
  );
  
  return !shouldAvoid;
}

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
    
    // Prefer non-deluxe versions
    const isDeluxe = (track: any) => {
      const albumName = track.album_info.name.toLowerCase();
      return albumName.includes('deluxe') || albumName.includes('expanded') || 
             albumName.includes('special') || albumName.includes('remaster');
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