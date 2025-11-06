"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Returns best hero (banner) and avatar (profile) image URLs for an artist
// - avatarUrl prefers the first Spotify image saved on the artist (square, images[0])
// - heroUrl prefers the widest Ticketmaster attraction image (ideally 16:9, largest width)
// Also returns a Spotify attribution URL when available
export const getArtistImages = action({
  args: { artistId: v.id("artists") },
  returns: v.object({
    avatarUrl: v.optional(v.string()),
    heroUrl: v.optional(v.string()),
    spotifyUrl: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const artist: any = await ctx.runQuery(api.artists.getById, { id: args.artistId });
    if (!artist) {
      return { };
    }

    // Avatar from Spotify images saved on artist
    const avatarUrl = Array.isArray(artist.images) && artist.images.length > 0 ? String(artist.images[0]) : undefined;
    const spotifyUrl = artist.spotifyId ? `https://open.spotify.com/artist/${artist.spotifyId}` : undefined;

    // Hero from Ticketmaster attraction images
    const apiKey = process.env.TICKETMASTER_API_KEY;
    let heroUrl: string | undefined = undefined;

    if (apiKey) {
      try {
        // Prefer lookup by Ticketmaster attraction ID when available
        if (artist.ticketmasterId) {
          const attrResp = await fetch(`https://app.ticketmaster.com/discovery/v2/attractions/${artist.ticketmasterId}.json?apikey=${apiKey}`);
          if (attrResp.ok) {
            const attraction = await attrResp.json();
            const images = Array.isArray(attraction.images) ? attraction.images : [];
            heroUrl = selectBestHero(images);
          }
        }

        // Fallback: search by keyword if no TM ID or no images found
        if (!heroUrl) {
          const searchResp = await fetch(`https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=${encodeURIComponent(artist.name)}&classificationName=music&size=1&apikey=${apiKey}`);
          if (searchResp.ok) {
            const data = await searchResp.json();
            const attraction = data._embedded?.attractions?.[0];
            const images = Array.isArray(attraction?.images) ? attraction.images : [];
            heroUrl = selectBestHero(images);
          }
        }
      } catch {
        // ignore
      }
    }

    return { avatarUrl, heroUrl, spotifyUrl };
  },
});

function selectBestHero(images: any[]): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  const sorted = images
    .filter((img) => img && img.url && img.width && img.height)
    .sort((a: any, b: any) => {
      // Prefer 16:9 aspect ratio; otherwise pick the widest
      const aRatioDelta = Math.abs(a.width / a.height - 16 / 9);
      const bRatioDelta = Math.abs(b.width / b.height - 16 / 9);
      if (Math.abs(aRatioDelta - bRatioDelta) > 0.1) return aRatioDelta - bRatioDelta;
      return b.width - a.width;
    });
  return sorted[0]?.url ? String(sorted[0].url) : undefined;
}


