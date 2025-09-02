"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

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

      // Get ALL albums with pagination
      let albums = [];
      let offset = 0;
      const limit = 50;
      let hasMore = true;

      while (hasMore) {
        const albumsResponse = await fetch(
          `https://api.spotify.com/v1/artists/${spotifyArtist.id}/albums?include_groups=album,single,compilation&market=US&limit=${limit}&offset=${offset}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!albumsResponse.ok) break;

        const albumsData = await albumsResponse.json();
        const batchAlbums = albumsData.items || [];
        
        albums.push(...batchAlbums as any[]);
        
        console.log(`📀 Fetched ${batchAlbums.length} albums (total: ${albums.length})`);
        
        // Check if we have more albums to fetch
        if (batchAlbums.length < limit || offset + limit >= albumsData.total) {
          hasMore = false;
        } else {
          offset += limit;
          // Rate limiting between album batches
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      console.log(`📀 Total albums found: ${albums.length}`);

      let songsImported = 0;

      // Process each album
      for (const album of albums as any[]) {
        // Filter to studio albums only
        if (!isStudioAlbum(album.name)) continue;

        // Get album tracks
        const tracksResponse = await fetch(
          `https://api.spotify.com/v1/albums/${album.id}/tracks`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!tracksResponse.ok) continue;

        const tracksData = await tracksResponse.json();
        const tracks = tracksData.items || [];

        // Process each track
        for (const track of tracks as any[]) {
          if (!isStudioSong(track.name, album.name)) continue;

          try {
            // Create song
            const songId = await ctx.runMutation(internal.songs.create, {
              title: track.name, // Fixed: was 'name', should be 'title'
              album: album.name,
              spotifyId: track.id,
              durationMs: track.duration_ms, // Fixed: was 'duration', should be 'durationMs'
              popularity: track.popularity || 0,
              trackNo: track.track_number, // Added track number
              isLive: false, // Studio tracks are not live
              isRemix: false, // Filter out remixes in isStudioSong check
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

        // Rate limiting between albums
        await new Promise(resolve => setTimeout(resolve, 200));
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

// Helper function to determine if an album is likely to contain studio recordings
function isStudioAlbum(albumName: string): boolean {
  const liveKeywords = [
    'live at', 'live from', 'live in', 'concert at', 'bootleg', 
    'live recording', 'acoustic session', 'unplugged', 'bbc session',
    'radio session', 'live performance', '(live)', '[live]'
  ];
  
  const albumLower = albumName.toLowerCase();
  // Check if album name contains any live keywords
  const isLive = liveKeywords.some(keyword => albumLower.includes(keyword));
  
  // Also filter out obvious compilations that might have duplicate tracks
  const compilationKeywords = ['greatest hits', 'best of', 'collection', 'anthology'];
  const isCompilation = compilationKeywords.some(keyword => albumLower.includes(keyword));
  
  // Return true only if it's not live and not a compilation
  return !isLive && !isCompilation;
}

// Helper function to determine if a song is likely a studio recording
function isStudioSong(songName: string, albumName: string): boolean {
  const liveKeywords = [
    'live at ', 'concert at ', 'bootleg', '(live)', '(acoustic live)'
  ];
  
  const songLower = songName.toLowerCase();
  const albumLower = albumName.toLowerCase();
  
  return !liveKeywords.some(keyword => 
    songLower.includes(keyword) || albumLower.includes(keyword)
  );
}