"use node";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { internalRef } from "./adminHelpers";
import { httpsImage, selectHeroImage, type HeroImage } from "./lib/heroImages";

const apiRef = api as any;
async function providerHero(ctx: ActionCtx, kind: "attractions" | "venues", providerId?: string): Promise<HeroImage | undefined> {
  if (!providerId) return;
  const key = `web-hero-v2:${kind}:${providerId}`;
  const cached = await ctx.runQuery(internalRef.mediaCache.get, { key });
  if (cached?.refreshAfter > Date.now()) return cached.image;
  if (!process.env.TICKETMASTER_API_KEY) return cached?.image;
  if (!await ctx.runMutation(internalRef.mediaCache.claim, { key })) return cached?.image;
  try {
    const url = new URL(`https://app.ticketmaster.com/discovery/v2/${kind}/${encodeURIComponent(providerId)}.json`);
    url.searchParams.set("apikey", process.env.TICKETMASTER_API_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error(`Media provider returned ${response.status}`);
    const data = await response.json();
    const image = selectHeroImage(data.images);
    await ctx.runMutation(internalRef.mediaCache.finish, { key, image, failed: false });
    return image;
  } catch {
    await ctx.runMutation(internalRef.mediaCache.finish, { key, failed: true });
    return cached?.image;
  }
}

// Headers and crawler metadata use the identical source, cached across all shows
// for this artist. Only a verified provider ID can select an attraction.
export const getArtistImages = action({
  args: { artistId: v.id("artists") },
  returns: v.object({ avatarUrl: v.optional(v.string()), heroUrl: v.optional(v.string()),
    heroWidth: v.optional(v.number()), heroHeight: v.optional(v.number()), spotifyUrl: v.optional(v.string()) }),
  handler: async (ctx, { artistId }) => {
    const artist = await ctx.runQuery(apiRef.artists.getById, { id: artistId });
    if (!artist) return {};
    const avatarUrl = artist.images?.map(httpsImage).find(Boolean);
    const image = await providerHero(ctx, "attractions", artist.ticketmasterId);
    return { avatarUrl, heroUrl: image?.url || avatarUrl, heroWidth: image?.width, heroHeight: image?.height,
      spotifyUrl: artist.spotifyId ? `https://open.spotify.com/artist/${artist.spotifyId}` : undefined };
  },
});

export const getVenueImage = action({
  args: { venueId: v.id("venues") },
  returns: v.object({ heroUrl: v.optional(v.string()), heroWidth: v.optional(v.number()), heroHeight: v.optional(v.number()) }),
  handler: async (ctx, { venueId }) => {
    const venue = await ctx.runQuery(apiRef.venues.getById, { id: venueId });
    if (!venue) return {};
    const image = await providerHero(ctx, "venues", venue.ticketmasterId);
    return { heroUrl: image?.url, heroWidth: image?.width, heroHeight: image?.height };
  },
});
