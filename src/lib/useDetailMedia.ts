import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
type Media = { heroUrl?: string; avatarUrl?: string; spotifyUrl?: string };
const cache = new Map<string, { expiresAt: number; value: Promise<Media> }>();

// Reuse media between artist/show navigation; reveal a hero only after it decodes.
// Keys and cleanup prevent a slow previous page's response painting the new artist.
export function useDetailMedia(kind: "artist" | "venue", id: string | undefined) {
  const artistImages = useAction(api.media.getArtistImages);
  const venueImage = useAction(api.media.getVenueImage);
  const key = `${kind}:${id ?? ""}`;
  const [loaded, setLoaded] = useState<{ key: string; media: Media }>();
  useEffect(() => {
    if (!id) return;
    let active = true;
    let entry = cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      const value: Promise<Media> = (kind === "artist" ? artistImages({ artistId: id as Id<"artists"> }) : venueImage({ venueId: id as Id<"venues"> }))
        .then(async media => {
          if (media.heroUrl) {
            const image = new Image(); image.src = media.heroUrl;
            try { await image.decode(); } catch { return { ...media, heroUrl: undefined }; }
          }
          return media;
        });
      entry = { expiresAt: Date.now() + 30 * 60_000, value }; cache.set(key, entry);
      if (cache.size > 40) cache.delete(cache.keys().next().value!);
    }
    void entry.value.then(media => { if (active) setLoaded({ key, media }); }).catch(() => { cache.delete(key); });
    return () => { active = false; };
  }, [key, id, kind, artistImages, venueImage]);
  return loaded?.key === key ? loaded.media : undefined;
}
