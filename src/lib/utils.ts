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
    // Prefer Ticketmaster images (often provide wide variants)
    if (lower.includes('ticketmaster') || lower.includes('tm-') || lower.includes('app.ticketmaster.com')) s += 100;
    // Prefer 16x9-ish hints commonly present in TM CDN URLs
    if (lower.includes('16x9') || lower.includes('ratio=16') || lower.includes('16_9')) s += 60;
    // Prefer explicit larger width query params
    const widthMatch = lower.match(/[?&]w=(\d+)/) || lower.match(/width=(\d+)/);
    if (widthMatch && widthMatch[1]) s += Math.min(80, parseInt(widthMatch[1]!, 10) / 20);
    // Slight preference for longer URLs (often carry transformation hints)
    s += Math.min(20, Math.floor(lower.length / 100));
    // De-prioritize Spotify CDN square images a bit (still OK if nothing else)
    if (lower.includes('i.scdn.co')) s -= 10;
    return s;
  };

  return valid
    .slice()
    .sort((a, b) => score(b) - score(a))[0];
}
