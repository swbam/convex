import { urlFor, type BlogPost } from "./sanity";
const blogHeaderImages: Record<string, string> = {
    'concert-tours-2025-2026-city-guide': 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1200&h=675&fit=crop&q=80',
    'music-festivals-2026-complete-guide': 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&h=675&fit=crop&q=80',
    'complete-guide-concert-setlists': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=675&fit=crop&q=80',
    'ultimate-guide-us-music-festivals-2026': 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=675&fit=crop&q=80',
    'best-setlist-apps-websites-2025': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=675&fit=crop&q=80',
  };


export function getBlogImage(post: BlogPost, width = 1200): string | undefined {
  if (post.mainImage?.asset) return urlFor(post.mainImage).width(width).height(Math.round(width * 9 / 16)).url();
  return blogHeaderImages[post.slug.current]?.replace(/w=\d+&h=\d+/, `w=${width}&h=${Math.round(width * 9 / 16)}`);
}
export function formatBlogDate(value: string) { return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); }
