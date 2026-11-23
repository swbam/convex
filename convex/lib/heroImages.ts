export type HeroImage = { url: string; width?: number; height?: number };
export function httpsImage(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url.toString();
  } catch { /* Missing/invalid provider image. */ }
}
export function selectHeroImage(images: any[]): HeroImage | undefined {
  const candidates = (Array.isArray(images) ? images : []).filter(i => httpsImage(i?.url) && !i.fallback);
  // Keep the provider's optimized header renditions ahead of raw SOURCE files.
  // Only use URLs actually returned by the provider; never synthesize a variant.
  const preferredTypes = ["TABLET_LANDSCAPE_LARGE_16_9", "RETINA_LANDSCAPE_16_9", "TABLET_LANDSCAPE_16_9", "RETINA_PORTRAIT_16_9"];
  const rank = (i: any) => {
    const landscape = i.ratio === "16_9" || (i.width > 0 && i.height > 0 && Math.abs(i.width / i.height - 16 / 9) < 0.15);
    return (landscape ? 100000 : 0) + (Number(i.width) || 0);
  };
  const optimized = preferredTypes.map(type => candidates.find(i => new URL(i.url).pathname.includes(type))).find(Boolean);
  const best = optimized || candidates.sort((a, b) => rank(b) - rank(a))[0];
  return best ? { url: httpsImage(best.url)!, ...(best.width > 0 && best.height > 0 ? { width: best.width, height: best.height } : {}) } : undefined;
}
