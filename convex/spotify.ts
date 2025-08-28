"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
      return;
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

      if (!searchResponse.ok) return;

      const searchData = await searchResponse.json();
      const artist = searchData.artists?.items?.[0];
      
      if (!artist) return;

      // Update artist with Spotify data
      await ctx.runMutation(internal.artists.updateSpotifyData, {
        artistId: args.artistId,
        spotifyId: artist.id,
        followers: artist.followers?.total,
        popularity: artist.popularity,
        genres: artist.genres || [],
        images: artist.images?.map((img: any) => img.url) || [],
      });

      // Get artist's albums
      const albumsResponse = await fetch(
        `https://api.spotify.com/v1/artists/${artist.id}/albums?include_groups=album,single&market=US&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!albumsResponse.ok) return;

      const albumsData = await albumsResponse.json();
      
      for (const album of albumsData.items || []) {
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
        
        const albumTitleLower: string = (album.name || '').toLowerCase();
        const albumIsLive = /(\blive\b|\bconcert\b|at\b.*\blive\b)/i.test(album.name || '');
        const albumIsAcoustic = /(acoustic|unplugged)/i.test(album.name || '');
        const albumIsRemix = /(remix|re\-?mix|mix\)|mixed)/i.test(album.name || '');
        const albumIsLocalhost = albumTitleLower.includes('localhost:3001');

        for (const track of tracksData.items || []) {
          const title: string = track.name || '';
          const titleLower = title.toLowerCase();

          // Comprehensive studio-only filter (title + album level)
          const isLive = /(\blive\b|\bconcert\b|\(live\)|\- live)/i.test(title) || albumIsLive;
          const isRemix = /(remix|re\-?mix|\bmix\b|mixed)/i.test(title) || albumIsRemix;
          const isAcoustic = /(acoustic|unplugged)/i.test(title) || albumIsAcoustic;
          const isDemo = /(demo|rough|sketch|outtake|alternate|alt\.|alt version|alternative take)/i.test(title);
          const isBonus = /(bonus|b\-?side)/i.test(title);
          const isRadioEdit = /(radio edit)/i.test(title);
          const isInstrumental = /(instrumental)/i.test(title);
          const isCommentary = /(commentary)/i.test(title);

          // Skip non-studio material entirely
          if (isLive || isRemix || isAcoustic || isDemo || isBonus || isRadioEdit || isInstrumental || isCommentary || albumIsLocalhost) {
            continue;
          }

          // Deduplicate by Spotify ID before creating
          const existing = await ctx.runQuery(internal.songs.getBySpotifyIdInternal, { spotifyId: track.id });
          let songId;
          if (existing) {
            songId = existing._id;
          } else {
            // Title-level duplicate check (normalize title)
            const normalizedTitle = titleLower
              .replace(/\(feat\.[^)]+\)/gi, '')
              .replace(/\[feat\.[^\]]+\]/gi, '')
              .replace(/\s+-\s+.*$/g, '') // remove trailing descriptors after dash
              .replace(/\s*\(.*?\)\s*/g, ' ') // remove parenthetical
              .replace(/\s{2,}/g, ' ')
              .trim();

            // If a different Spotify ID exists with same normalized title for this artist, reuse it
            // (we'll rely on artistSongs relation to check duplicates at link time)
            songId = await ctx.runMutation(internal.songs.createFromSpotify, {
              title: normalizedTitle || track.name,
              album: album.name,
              spotifyId: track.id,
              durationMs: track.duration_ms,
              popularity: (track as any).popularity || 0,
              trackNo: track.track_number,
              isLive: false,
              isRemix: false,
            });
          }

          // Link to artist
          await ctx.runMutation(internal.artistSongs.create, {
            artistId: args.artistId,
            songId,
            isPrimaryArtist: true,
          });
        }

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error("Failed to sync Spotify catalog:", error);
    }
    return null;
  },
});
