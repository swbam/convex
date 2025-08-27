"use node";

import { query, mutation, action, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const triggerSync = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runAction(internal.sync.startTrendingSync, {});
    return "Sync triggered successfully";
  },
});

export const startTrendingSync = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting trending sync...");
    
    // Update sync status
    await ctx.runMutation(internal.syncStatus.updateStatus, {
      isActive: true,
      currentPhase: "trending_artists",
    });

    try {
      // Sync trending artists from Spotify - NO SAMPLE DATA
      await syncSpotifyTrending(ctx);
      
      // Sync trending shows from Ticketmaster
      await syncTicketmasterShows(ctx);
      
      // Check for completed shows and sync setlists
      await ctx.runAction(internal.setlistfm.checkCompletedShows, {});
      
      // Update trending scores
      await ctx.runMutation(internal.syncStatus.updateTrendingScores, {});
      
      // Mark sync as complete
      await ctx.runMutation(internal.syncStatus.updateStatus, {
        isActive: false,
        currentPhase: "idle",
        lastSync: Date.now(),
      });
      
      console.log("Trending sync completed successfully");
    } catch (error) {
      console.error("Trending sync failed:", error);
      await ctx.runMutation(internal.syncStatus.updateStatus, {
        isActive: false,
        currentPhase: "error",
        lastSync: Date.now(),
      });
    }
  },
});

async function syncSpotifyTrending(ctx: any) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.log("Spotify credentials not configured - NO DATA WILL BE AVAILABLE");
    return;
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

    // Get trending playlists to find popular artists
    const playlistResponse = await fetch(
      'https://api.spotify.com/v1/browse/featured-playlists?limit=10',
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!playlistResponse.ok) {
      throw new Error('Failed to fetch Spotify playlists');
    }

    const playlistData = await playlistResponse.json();
    const playlists = playlistData.playlists?.items || [];

    // Process each playlist to extract trending artists
    for (const playlist of playlists.slice(0, 3)) {
      const tracksResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        }
      );

      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json();
        const tracks = tracksData.items || [];

        for (const item of tracks) {
          if (item.track?.artists) {
            for (const artist of item.track.artists) {
              await syncArtistFromSpotify(ctx, artist, tokenData.access_token);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Spotify sync error:", error);
    // NO FALLBACK TO SAMPLE DATA
  }
}

async function syncArtistFromSpotify(ctx: any, spotifyArtist: any, accessToken: string) {
  const slug = spotifyArtist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  
  // Check if artist already exists
  let artist = await ctx.runQuery(internal.artists.getBySlugInternal, { slug });
  
  if (!artist) {
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
      
      const artistId = await ctx.runMutation(internal.artists.createInternal, {
        slug,
        name: fullArtist.name,
        spotifyId: fullArtist.id,
        genres: fullArtist.genres || [],
        images: fullArtist.images?.map((img: any) => img.url) || [],
        popularity: fullArtist.popularity || 0,
        followers: fullArtist.followers?.total || 0,
      });

      // Sync artist's COMPLETE STUDIO CATALOG
      await syncArtistCompleteCatalog(ctx, artistId, fullArtist.id, accessToken);
    }
  } else {
    // Update existing artist's trending score
    await ctx.runMutation(internal.artists.updateTrendingScore, {
      artistId: artist._id,
      score: (artist.trendingScore || 0) + 1,
    });
  }
}

async function syncArtistCompleteCatalog(ctx: any, artistId: string, spotifyId: string, accessToken: string) {
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
            // ONLY STUDIO SONGS - NO LIVE, NO REMIXES
            const isLive = track.name.toLowerCase().includes('live') || 
                          track.name.toLowerCase().includes('concert') ||
                          album.name.toLowerCase().includes('live');
            
            const isRemix = track.name.toLowerCase().includes('remix') ||
                           track.name.toLowerCase().includes('mix)') ||
                           track.name.toLowerCase().includes('version');

            if (isLive || isRemix) continue;

            // Check if song already exists by Spotify ID
            const existingSong = await ctx.runQuery(internal.songs.getBySpotifyIdInternal, { 
              spotifyId: track.id 
            });

            if (!existingSong) {
              const songId = await ctx.runMutation(internal.songs.createInternal, {
                title: track.name,
                album: album.name,
                spotifyId: track.id,
                durationMs: track.duration_ms,
                popularity: track.popularity || 0,
                trackNo: track.track_number,
                isLive: false,
                isRemix: false,
              });

              // Create artist-song relationship
              await ctx.runMutation(internal.artistSongs.create, {
                artistId,
                songId,
                isPrimaryArtist: true,
              });
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

async function syncTicketmasterShows(ctx: any) {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.log("Ticketmaster API key not configured");
    return;
  }

  try {
    // Get upcoming music events
    const response = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?classificationName=music&size=50&sort=date,asc&apikey=${apiKey}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Ticketmaster events');
    }

    const data = await response.json();
    const events = data._embedded?.events || [];

    for (const event of events) {
      await syncEventFromTicketmaster(ctx, event);
    }
  } catch (error) {
    console.error("Ticketmaster sync error:", error);
  }
}

async function syncEventFromTicketmaster(ctx: any, event: any) {
  try {
    // Extract artist info
    const attraction = event._embedded?.attractions?.[0];
    if (!attraction) return;

    const artistSlug = attraction.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Get or create artist
    let artist = await ctx.runQuery(internal.artists.getBySlugInternal, { slug: artistSlug });
    
    if (!artist) {
      const artistId = await ctx.runMutation(internal.artists.createInternal, {
        slug: artistSlug,
        name: attraction.name,
        ticketmasterId: attraction.id,
        genres: attraction.classifications?.[0]?.genre?.name ? [attraction.classifications[0].genre.name] : [],
        images: attraction.images?.map((img: any) => img.url) || [],
      });
      artist = await ctx.runQuery(internal.artists.getByIdInternal, { id: artistId });
    }

    // Extract venue info
    const venue = event._embedded?.venues?.[0];
    if (!venue) return;

    let venueRecord = await ctx.runQuery(internal.venues.getByTicketmasterIdInternal, { 
      ticketmasterId: venue.id 
    });

    if (!venueRecord) {
      const venueId = await ctx.runMutation(internal.venues.createInternal, {
        name: venue.name,
        city: venue.city?.name || "",
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
    if (!eventDate || !artist || !venueRecord) return;

    const existingShow = await ctx.runQuery(internal.shows.getByArtistAndDateInternal, {
      artistId: artist._id,
      date: eventDate,
    });

    if (!existingShow) {
      const showId = await ctx.runMutation(internal.shows.createInternal, {
        artistId: artist._id,
        venueId: venueRecord._id,
        date: eventDate,
        startTime: event.dates?.start?.localTime,
        status: "upcoming",
        ticketmasterId: event.id,
        ticketUrl: event.url,
      });

      // Auto-generate initial setlist for the new show
      await ctx.runMutation(internal.setlists.autoGenerateSetlist, {
        showId,
        artistId: artist._id,
      });
    }
  } catch (error) {
    console.error("Error syncing Ticketmaster event:", error);
  }
}
