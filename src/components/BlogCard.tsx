import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import type { BlogPost } from '../lib/sanity';
import { getBlogImage, formatBlogDate } from '../lib/blogPresentation';

export function BlogCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  const image = getBlogImage(post, featured ? 1200 : 640);
  return <article className="content-card interactive-card min-w-0 overflow-hidden">
    <Link to={`/blog/${post.slug.current}`} className={`group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${featured ? 'lg:grid lg:grid-cols-2' : ''}`}>
      <div className="aspect-video overflow-hidden bg-secondary">
        {image ? <img src={image} alt={''} width={featured ? 1200 : 640} height={featured ? 675 : 360} loading={featured ? 'eager' : 'lazy'} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><BookOpen className="h-8 w-8 text-muted-foreground" /></div>}
      </div>
      <div className={`min-w-0 p-4 sm:p-5 ${featured ? 'lg:flex lg:flex-col lg:justify-center lg:p-7' : ''}`}>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{featured ? 'Featured guide' : post.categories?.[0]?.title || 'Concert guide'}</p>
        <h2 className={`${featured ? 'text-xl sm:text-2xl' : 'text-lg'} font-semibold leading-snug tracking-tight group-hover:underline underline-offset-4`}>{post.title}</h2>
        {post.excerpt && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>}
        <p className="mt-4 text-xs text-muted-foreground">{formatBlogDate(post.publishedAt)}{post.readingTime ? ` · ${post.readingTime} min read` : ''}</p>
        {featured && <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">Read guide<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span>}
      </div>
    </Link>
  </article>;
}
