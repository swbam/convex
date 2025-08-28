"use node";

import { action, internalAction, internalMutation, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const syncSpotifyArtists = action({
  args: {},
  returns: v.object({ synced: v.number() }),
  handler: async (ctx: ActionCtx) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.log("Spotify credentials not configured");
      return { synced: 0 };
    }

    try {
      // Get Spotify access token
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get Spotify token');
      }

      const tokenData = await tokenResponse.json();

      // Get artists that need updating (haven't been synced in 24 hours)
      const staleArtists: any[] = await ctx.runQuery(api.artists.getStaleArtists, {
        olderThan: Date.now() - 24 * 60 * 60 * 1000,
      });

      for (const artist of staleArtists) {
        try {
          // Get updated artist data from Spotify
          const spotifyResponse = await fetch(
            `https://api.spotify.com/v1/artists/${artist.spotifyId}`,
            {
              headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
            }
          );

          if (spotifyResponse.ok) {
            const spotifyData = await spotifyResponse.json();
            
            await ctx.runMutation(api.artists.updateArtist, {
              artistId: artist._id,
              name: spotifyData.name,
              image: spotifyData.images?.[0]?.url,
              genres: spotifyData.genres || [],
              popularity: spotifyData.popularity || 0,
              followers: spotifyData.followers?.total || 0,
              lastSynced: Date.now(),
            });

            // Sync complete catalog for this artist
            await syncArtistCompleteCatalog(ctx, artist._id, artist.spotifyId, tokenData.access_token);
          }
        } catch (error) {
          console.error(`Failed to sync artist ${artist.spotifyId}:`, error);
        }

        // Rate limiting: wait 1 second between artists to respect API limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Also discover new trending artists
      await discoverTrendingArtists(ctx, tokenData.access_token);

      return { synced: staleArtists.length };
    } catch (error) {
      console.error("Spotify sync error:", error);
      return { synced: 0 };
    }
  },
});

export const syncTicketmasterShows = action({
  args: {},
  returns: v.object({ synced: v.number() }),
  handler: async (ctx: ActionCtx) => {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      console.log("Ticketmaster API key not configured");
      return { synced: 0 };
    }

    try {
      let syncedCount = 0;
      
      // Get upcoming music events
      const response = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&size=200&sort=date,asc&apikey=${apiKey}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch Ticketmaster events');
      }

      const data = await response.json();
      const events = data._embedded?.events || [];

      for (const event of events) {
        const synced = await syncEventFromTicketmaster(ctx, event);
        if (synced) syncedCount++;

        // Rate limiting: wait 500ms between events to respect API limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return { synced: syncedCount };
    } catch (error) {
      console.error("Ticketmaster sync error:", error);
      return { synced: 0 };
    }
  },
});

export const syncSetlistFm = action({
  args: {},
  returns: v.object({ synced: v.number() }),
  handler: async (ctx: ActionCtx) => {
    const apiKey = process.env.SETLISTFM_API_KEY;
    if (!apiKey) {
      console.log("Setlist.fm API key not configured");
      return { synced: 0 };
    }

    try {
      let syncedCount = 0;

      // Get recent setlists from setlist.fm
      const response = await fetch(
        `https://api.setlist.fm/rest/1.0/search/setlists?p=1`,
        {
          headers: {
            'x-api-key': apiKey,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch setlists from setlist.fm');
      }

      const data = await response.json();
      const setlists = data.setlist || [];

      for (const setlist of setlists) {
        const synced = await syncSetlistFromSetlistFm(ctx, setlist);
        if (synced) syncedCount++;

        // Rate limiting: wait 200ms between setlists to respect API limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      return { synced: syncedCount };
    } catch (error) {
      console.error("Setlist.fm sync error:", error);
      return { synced: 0 };
    }
  },
});

// Helper functions
async function discoverTrendingArtists(ctx: ActionCtx, accessToken: string) {
  try {
    // Get trending playlists to find popular artists
    const playlistResponse = await fetch(
      'https://api.spotify.com/v1/browse/featured-playlists?limit=10',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!playlistResponse.ok) return;

    const playlistData = await playlistResponse.json();
    const playlists = playlistData.playlists?.items || [];

    // Process each playlist to extract trending artists
    for (const playlist of playlists.slice(0, 3)) {
      const tracksResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json();
        const tracks = tracksData.items || [];

        for (const item of tracks) {
          if (item.track?.artists) {
            for (const artist of item.track.artists) {
              await syncArtistFromSpotify(ctx, artist, accessToken);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error discovering trending artists:", error);
  }
}

async function syncArtistFromSpotify(ctx: ActionCtx, spotifyArtist: any, accessToken: string) {
  try {
    // Check if artist already exists by Spotify ID
    const existingArtist = await ctx.runQuery(api.artists.getBySpotifyId, { 
      spotifyId: spotifyArtist.id 
    });
    
    if (!existingArtist) {
      // Get full artist details
      const artistResponse = await fetch(
        `https://api.spotify.com/v1/artists/${spotifyArtist.id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (artistResponse.ok) {
        const fullArtist = await artistResponse.json();
        
        const artistId = await ctx.runMutation(internal.artists.create, {
          name: fullArtist.name,
          spotifyId: fullArtist.id,
          image: fullArtist.images?.[0]?.url,
          genres: fullArtist.genres || [],
          popularity: fullArtist.popularity || 0,
          followers: fullArtist.followers?.total || 0,
          lastSynced: Date.now(),
        });

        // Sync artist's complete studio catalog
        await syncArtistCompleteCatalog(ctx, artistId, fullArtist.id, accessToken);
      }
    }
  } catch (error) {
    console.error("Error syncing artist from Spotify:", error);
  }
}

async function syncArtistCompleteCatalog(ctx: ActionCtx, artistId: string, spotifyId: string, accessToken: string) {
  try {
    // Get ALL albums for the artist
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const albumsResponse = await fetch(
        `https://api.spotify.com/v1/artists/${spotifyId}/albums?include_groups=album,single&market=US&limit=${limit}&offset=${offset}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!albumsResponse.ok) break;

      const albumsData = await albumsResponse.json();
      const albums = albumsData.items || [];

      if (albums.length === 0) {
        hasMore = false;
        break;
      }

      // Process each album
      for (const album of albums) {
        // Get tracks for this album
        const tracksResponse = await fetch(
          `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=50`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (tracksResponse.ok) {
          const tracksData = await tracksResponse.json();
          const tracks = tracksData.tracks?.items || [];

          for (const track of tracks) {
            // ONLY STUDIO SONGS - COMPREHENSIVE FILTERING
            if (isStudioSong(track.name, album.name)) {
              // Check if song already exists by Spotify ID
              const existingSong = await ctx.runQuery(api.songs.getBySpotifyId, { 
                spotifyId: track.id 
              });

              if (!existingSong) {
                const songId = await ctx.runMutation(internal.songs.create, {
                  name: track.name,
                  artist: album.artists?.[0]?.name || "",
                  album: album.name,
                  duration: track.duration_ms,
                  spotifyId: track.id,
                  popularity: track.popularity || 0,
                  isStudio: true,
                });

                // Create artist-song relationship
                await ctx.runMutation(internal.artistSongs.create, {
                  artistId: artistId as Id<"artists">,
                  songId,
                  isPrimaryArtist: true,
                });
              }
            }
          }
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      offset += limit;
      if (albums.length < limit) {
        hasMore = false;
      }

      // Rate limiting between album batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Synced complete catalog for artist ${artistId}`);
  } catch (error) {
    console.error("Error syncing artist complete catalog:", error);
  }
}

function isStudioSong(trackTitle: string, albumTitle: string): boolean {
  const trackTitleLower = trackTitle.toLowerCase();
  const albumTitleLower = albumTitle.toLowerCase();
  
  // Exclude live recordings
  if (trackTitleLower.includes('live') || 
      trackTitleLower.includes('concert') ||
      albumTitleLower.includes('live') ||
      albumTitleLower.includes('concert')) {
    return false;
  }
  
  // Exclude remixes
  if (trackTitleLower.includes('remix') ||
      trackTitleLower.includes('mix)') ||
      trackTitleLower.includes('radio edit') ||
      trackTitleLower.includes('club mix') ||
      trackTitleLower.includes('dance mix')) {
    return false;
  }
  
  // Exclude acoustic versions
  if (trackTitleLower.includes('acoustic') ||
      trackTitleLower.includes('unplugged') ||
      trackTitleLower.includes('stripped')) {
    return false;
  }
  
  // Exclude demos and outtakes
  if (trackTitleLower.includes('demo') ||
      trackTitleLower.includes('rough') ||
      trackTitleLower.includes('sketch') ||
      trackTitleLower.includes('outtake') ||
      trackTitleLower.includes('alternate') ||
      trackTitleLower.includes('alternative')) {
    return false;
  }
  
  // Exclude remasters and deluxe editions bonus tracks
  if (trackTitleLower.includes('bonus') ||
      trackTitleLower.includes('b-side') ||
      (albumTitleLower.includes('deluxe') && trackTitleLower.includes('bonus'))) {
    return false;
  }
  
  return true;
}

async function syncEventFromTicketmaster(ctx: ActionCtx, event: any): Promise<boolean> {
  try {
    // Extract artist info
    const attraction = event._embedded?.attractions?.[0];
    if (!attraction) return false;

    // Get or create artist
    let artist = await ctx.runQuery(api.artists.getByTicketmasterId, { 
      ticketmasterId: attraction.id 
    });
    
    if (!artist) {
      // Try to find by name
      artist = await ctx.runQuery(api.artists.getByName, { name: attraction.name });
      
      if (!artist) {
        // Create new artist
        const artistId = await ctx.runMutation(internal.artists.create, {
          name: attraction.name,
          spotifyId: "", // Will be filled later by Spotify sync
          image: attraction.images?.[0]?.url,
          genres: attraction.classifications?.[0]?.genre?.name ? [attraction.classifications[0].genre.name] : [],
          popularity: 0,
          followers: 0,
          lastSynced: Date.now(),
        });
        artist = await ctx.runQuery(api.artists.getById, { id: artistId });
      }
    }

    // Extract venue info
    const venue = event._embedded?.venues?.[0];
    if (!venue || !artist) return false;

    let venueRecord = await ctx.runQuery(internal.venues.getByTicketmasterIdInternal, { 
      ticketmasterId: venue.id 
    });

    if (!venueRecord) {
      const venueId = await ctx.runMutation(internal.venues.createInternal, {
        name: venue.name,
        city: venue.city?.name || "",
        state: venue.state?.stateCode,
        country: venue.country?.name || "",
        address: venue.address?.line1,
        capacity: venue.capacity,
        lat: venue.location?.latitude ? parseFloat(venue.location.latitude) : undefined,
        lng: venue.location?.longitude ? parseFloat(venue.location.longitude) : undefined,
        ticketmasterId: venue.id,
      });
      venueRecord = await ctx.runQuery(internal.venues.getByIdInternal, { id: venueId });
    }

    // Create show if it doesn't exist
    const eventDate = event.dates?.start?.localDate;
    if (!eventDate || !venueRecord) return false;

    const existingShow = await ctx.runQuery(internal.shows.getByArtistAndDateInternal, {
      artistId: artist._id,
      date: eventDate,
    });

    if (!existingShow) {
      await ctx.runMutation(internal.shows.createInternal, {
        artistId: artist._id,
        venueId: venueRecord._id,
        date: eventDate,
        startTime: event.dates?.start?.localTime,
        status: "upcoming",
        ticketmasterId: event.id,
        ticketUrl: event.url,
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error syncing Ticketmaster event:", error);
    return false;
  }
}

async function syncSetlistFromSetlistFm(ctx: ActionCtx, setlist: any): Promise<boolean> {
  try {
    // Find matching show by artist name and date
    const artistName = setlist.artist?.name;
    const eventDate = setlist.eventDate;
    
    if (!artistName || !eventDate) return false;

    // Find artist
    const artist = await ctx.runQuery(api.artists.getByName, { name: artistName });
    if (!artist) return false;

    // Find show
    const show = await ctx.runQuery(internal.shows.getByArtistAndDateInternal, {
      artistId: artist._id,
      date: eventDate,
    });

    if (!show) return false;

    // Check if setlist already exists
    const existingSetlists = await ctx.runQuery(api.setlists.getByShow, { 
      showId: show._id 
    });

    // Parse songs from setlist
    const songs = [];
    let order = 1;

    if (setlist.sets?.set) {
      for (const set of setlist.sets.set) {
        if (set.song) {
          for (const song of set.song) {
            songs.push({
              name: song.name,
              artist: song.cover?.name || undefined,
              encore: set.encore || false,
              order: order++,
            });
          }
        }
      }
    }

    if (songs.length === 0) return false;

    if (existingSetlists && existingSetlists.length > 0) {
      // Update existing setlist
      // Replace official setlist via createOfficial
      await ctx.runMutation(internal.setlists.createOfficial, {
        showId: show._id,
        songs: songs.map((s: any) => ({ title: s.name })),
        setlistfmId: setlist.id,
      });
    } else {
      // Create new setlist
      await ctx.runMutation(internal.setlists.createOfficial, {
        showId: show._id,
        songs: songs.map((s: any) => ({ title: s.name })),
        setlistfmId: setlist.id,
      });
    }

    return true;
  } catch (error) {
    console.error("Error syncing setlist from setlist.fm:", error);
    return false;
  }
}