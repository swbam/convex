import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useEffect, useState } from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useDebounce<T extends (...args: any[]) => any>(callback: T, delay: number) {
  const [debouncedCallback, setDebouncedCallback] = useState(callback);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCallback(() => callback);
    }, delay);

    return () => clearTimeout(handler);
  }, [callback, delay]);

  return debouncedCallback;
}

// Heuristic selection of the best hero image from a list of URLs
// Prefers wide 16:9 Ticketmaster images, then largest-looking URLs
export function selectBestImageUrl(urls: Array<string | undefined | null>): string | undefined {
  const valid = (urls || []).filter((u): u is string => typeof u === 'string' && u.length > 0);
  if (valid.length === 0) return undefined;

  const score = (url: string) => {
    let s = 0;
    const lower = url.toLowerCase();

    // HIGHEST PRIORITY: Ticketmaster images (often provide wide, high-quality variants)
    if (lower.includes('ticketmaster') || lower.includes('tm-') || lower.includes('app.ticketmaster.com')) s += 150;

    // VERY HIGH: 16x9 aspect ratio hints (perfect for hero backgrounds)
    if (lower.includes('16x9') || lower.includes('ratio=16') || lower.includes('16_9') || lower.includes('aspect=16:9')) s += 100;

    // HIGH: Retina/high DPI images
    if (lower.includes('retina') || lower.includes('@2x') || lower.includes('@3x') || lower.includes('dpr=2')) s += 80;

    // HIGH: Explicit larger width query params (wider is better for backgrounds)
    const widthMatch = lower.match(/[?&]w=(\d+)/) || lower.match(/width=(\d+)/) || lower.match(/size=(\d+)/);
    if (widthMatch && widthMatch[1]) {
      const width = parseInt(widthMatch[1]!, 10);
      s += Math.min(120, width / 10); // Max bonus of 120 for very wide images
    }

    // MEDIUM: Height params (for aspect ratio estimation)
    const heightMatch = lower.match(/[?&]h=(\d+)/) || lower.match(/height=(\d+)/);
    if (heightMatch && widthMatch) {
      const width = parseInt(widthMatch[1]!, 10);
      const height = parseInt(heightMatch[1]!, 10);
      const ratio = width / height;
      if (ratio >= 1.5 && ratio <= 2.0) s += 50; // Bonus for wide landscape images
    }

    // MEDIUM: Quality hints
    if (lower.includes('quality=high') || lower.includes('q=100') || lower.includes('q=90')) s += 40;

    // MEDIUM: Specific size classes that are typically wider
    if (lower.includes('huge') || lower.includes('xlarge') || lower.includes('banner')) s += 50;
    if (lower.includes('large') || lower.includes('cover')) s += 30;

    // LOW: Slight preference for longer URLs (often carry transformation hints)
    s += Math.min(20, Math.floor(lower.length / 150));

    // PENALTY: De-prioritize Spotify CDN square images (typically 640x640 or smaller)
    if (lower.includes('i.scdn.co')) {
      s -= 30;
      // But give back some points if it's explicitly a large Spotify image
      if (lower.includes('640x640') || lower.includes('300x300')) s += 10;
    }

    // PENALTY: Thumbnail-sized images
    if (lower.includes('thumb') || lower.includes('small') || lower.includes('icon')) s -= 50;

    return s;
  };

  return valid
    .slice()
    .sort((a, b) => score(b) - score(a))[0];
}
