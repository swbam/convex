export type ProviderImage = { url?: string; width?: number; height?: number; ratio?: string; fallback?: boolean; attribution?: string };
export function safeImageUrl(value: string | undefined) {
  if (!value) return undefined;
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password ? u.href : undefined; } catch { return undefined; }
}
export function selectFestivalImages(images: ProviderImage[] = []) {
  const valid = images.filter(i => safeImageUrl(i.url) && !i.fallback && (i.width ?? 0) >= 300 && (i.height ?? 0) > 0);
  const landscape = valid.filter(i => Math.abs(i.width! / i.height! - 16 / 9) < 0.3);
  const pool = (landscape.length ? landscape : valid).sort((a, b) => a.width! - b.width!);
  const hero = pool.find(i => i.width! >= 1200) ?? pool[pool.length - 1];
  const card = pool.find(i => i.width! >= 640) ?? hero;
  return hero ? { imageUrl: safeImageUrl(hero.url)!, imageCardUrl: safeImageUrl(card?.url)!, imageAttribution: hero.attribution } : undefined;
}
export function festivalView<T extends { imageUrl?: string; imageCardUrl?: string; imageOverrideUrl?: string; imageAttribution?: string; endDate: string; startDate: string; status: string }>(f: T) {
  const today = new Date().toISOString().slice(0, 10);
  return { ...f, imageUrl: f.imageOverrideUrl || f.imageUrl, imageCardUrl: f.imageOverrideUrl || f.imageCardUrl || f.imageUrl,
    imageAttribution: f.imageOverrideUrl ? undefined : f.imageAttribution,
    status: f.endDate < today ? "completed" : f.startDate <= today ? "ongoing" : f.status === "completed" || f.status === "ongoing" ? "announced" : f.status };
}
