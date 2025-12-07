import { createClient, type SanityClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';
import type { SanityImageSource } from '@sanity/image-url/lib/types/types';

// Check if Sanity is configured
const SANITY_PROJECT_ID = import.meta.env.VITE_SANITY_PROJECT_ID;
const SANITY_DATASET = import.meta.env.VITE_SANITY_DATASET || 'production';
export const isSanityConfigured = !!SANITY_PROJECT_ID;

// Sanity client configuration
// You'll need to set these environment variables in your .env file:
// VITE_SANITY_PROJECT_ID=your-project-id
// VITE_SANITY_DATASET=production
export const sanityClient: SanityClient | null = isSanityConfigured
  ? createClient({
      projectId: SANITY_PROJECT_ID,
      dataset: SANITY_DATASET,
      useCdn: true, // Use CDN for faster reads in production
      apiVersion: '2024-01-01', // Use a date string
    })
  : null;

// Image URL builder (only if client exists)
const builder = sanityClient ? imageUrlBuilder(sanityClient) : null;

export function urlFor(source: SanityImageSource) {
  if (!builder) {
    // Return a placeholder image URL builder that returns empty string
    return {
      width: () => ({ height: () => ({ url: () => '' }) }),
      height: () => ({ url: () => '' }),
      url: () => '',
    } as ReturnType<typeof imageUrlBuilder>['image'];
  }
  return builder.image(source);
}

// Types for blog content
export interface Author {
  _id: string;
  name: string;
  slug: { current: string };
  image?: SanityImageSource;
  bio?: unknown[];
}

export interface Category {
  _id: string;
  title: string;
  slug: { current: string };
  description?: string;
}

export interface BlogPost {
  _id: string;
  title: string;
  slug: { current: string };
  author?: Author;
  mainImage?: SanityImageSource;
  categories?: Category[];
  publishedAt: string;
  excerpt?: string;
  body?: unknown[];
  readingTime?: number;
  seoTitle?: string;
  seoDescription?: string;
}

// GROQ queries
export const blogQueries = {
  // Get all published posts
  allPosts: `*[_type == "post" && publishedAt < now()] | order(publishedAt desc) {
    _id,
    title,
    slug,
    "author": author->{name, slug, image},
    mainImage,
    "categories": categories[]->{title, slug},
    publishedAt,
    excerpt,
    "readingTime": round(length(pt::text(body)) / 5 / 200)
  }`,

  // Get recent posts (for homepage)
  recentPosts: `*[_type == "post" && publishedAt < now()] | order(publishedAt desc)[0...6] {
    _id,
    title,
    slug,
    "author": author->{name, slug, image},
    mainImage,
    "categories": categories[]->{title, slug},
    publishedAt,
    excerpt,
    "readingTime": round(length(pt::text(body)) / 5 / 200)
  }`,

  // Get single post by slug
  postBySlug: `*[_type == "post" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    "author": author->{name, slug, image, bio},
    mainImage,
    "categories": categories[]->{title, slug},
    publishedAt,
    excerpt,
    body,
    "readingTime": round(length(pt::text(body)) / 5 / 200),
    seoTitle,
    seoDescription
  }`,

  // Get posts by category
  postsByCategory: `*[_type == "post" && $categorySlug in categories[]->slug.current && publishedAt < now()] | order(publishedAt desc) {
    _id,
    title,
    slug,
    "author": author->{name, slug, image},
    mainImage,
    "categories": categories[]->{title, slug},
    publishedAt,
    excerpt,
    "readingTime": round(length(pt::text(body)) / 5 / 200)
  }`,

  // Get all categories
  allCategories: `*[_type == "category"] | order(title asc) {
    _id,
    title,
    slug,
    description
  }`,

  // Get all post slugs (for sitemap)
  allPostSlugs: `*[_type == "post" && publishedAt < now()].slug.current`,
};

// Fetch functions
export async function getAllPosts(): Promise<BlogPost[]> {
  if (!sanityClient) {
    return [];
  }
  try {
    return await sanityClient.fetch(blogQueries.allPosts);
  } catch {
    console.error('Error fetching all posts');
    return [];
  }
}

export async function getRecentPosts(): Promise<BlogPost[]> {
  if (!sanityClient) {
    return [];
  }
  try {
    return await sanityClient.fetch(blogQueries.recentPosts);
  } catch {
    console.error('Error fetching recent posts');
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  if (!sanityClient) {
    return null;
  }
  try {
    return await sanityClient.fetch(blogQueries.postBySlug, { slug });
  } catch {
    console.error('Error fetching post by slug:', slug);
    return null;
  }
}

export async function getPostsByCategory(categorySlug: string): Promise<BlogPost[]> {
  if (!sanityClient) {
    return [];
  }
  try {
    return await sanityClient.fetch(blogQueries.postsByCategory, { categorySlug });
  } catch {
    console.error('Error fetching posts by category:', categorySlug);
    return [];
  }
}

export async function getAllCategories(): Promise<Category[]> {
  if (!sanityClient) {
    return [];
  }
  try {
    return await sanityClient.fetch(blogQueries.allCategories);
  } catch {
    console.error('Error fetching categories');
    return [];
  }
}

