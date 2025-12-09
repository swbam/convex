import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, ArrowLeft, User, Share2, ChevronRight, Ticket } from 'lucide-react';
import { PortableText } from '@portabletext/react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getPostBySlug, getRecentPosts, urlFor, type BlogPost } from '../lib/sanity';
import { AppLayout } from '../components/AppLayout';
import { SEOHead } from '../components/SEOHead';

// Type for affiliate link data
interface AffiliateLink {
  name: string;
  slug: string;
  ticketUrl?: string;
  websiteUrl?: string;
  year: number;
  location: string;
}

// Custom components for rendering Portable Text - Medium/Substack inspired
const portableTextComponents = {
  types: {
    image: ({ value }: { value: { asset: { _ref: string }; alt?: string; caption?: string } }) => {
      if (!value?.asset?._ref) return null;
      return (
        <figure className="my-8 -mx-4 sm:mx-0">
          <img
            src={urlFor(value).width(1200).url()}
            alt={value.alt || ''}
            className="w-full sm:rounded-lg"
          />
          {value.caption && (
            <figcaption className="text-center text-sm text-muted-foreground mt-3 px-4 sm:px-0">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
  },
  block: {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-2xl sm:text-3xl font-bold mt-12 mb-4 text-foreground tracking-tight">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-xl sm:text-2xl font-bold mt-10 mb-4 text-foreground tracking-tight border-b border-border/50 pb-2">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-lg sm:text-xl font-semibold mt-8 mb-3 text-foreground">{children}</h3>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="text-base sm:text-lg font-semibold mt-6 mb-2 text-foreground">{children}</h4>
    ),
    normal: ({ children }: { children?: React.ReactNode }) => (
      <p className="text-[17px] leading-[1.8] mb-6 text-foreground/85" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{children}</p>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-[3px] border-primary pl-5 my-8 text-lg italic text-muted-foreground" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
        {children}
      </blockquote>
    ),
  },
  marks: {
    link: ({ children, value }: { children?: React.ReactNode; value?: { href: string } }) => {
      const rel = !value?.href?.startsWith('/') ? 'noopener noreferrer' : undefined;
      const target = !value?.href?.startsWith('/') ? '_blank' : undefined;
      return (
        <a
          href={value?.href}
          rel={rel}
          target={target}
          className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors"
        >
          {children}
        </a>
      );
    },
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-bold text-foreground">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic">{children}</em>
    ),
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="bg-secondary/60 px-1.5 py-0.5 rounded text-sm font-mono text-foreground">{children}</code>
    ),
  },
  list: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <ul className="space-y-3 mb-6 ml-6 text-[17px]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{children}</ul>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal space-y-3 mb-6 ml-6 text-[17px]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-foreground/85 leading-[1.7] pl-2 relative before:content-['•'] before:absolute before:-left-4 before:text-primary before:font-bold">{children}</li>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-foreground/85 leading-[1.7]">{children}</li>
    ),
  },
};

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all festivals with affiliate links from Convex
  const allFestivals = useQuery(api.festivals.getAllWithAffiliateLinks) ?? [];

  useEffect(() => {
    async function fetchData() {
      if (!slug) return;
      setIsLoading(true);
      
      const [postData, recentData] = await Promise.all([
        getPostBySlug(slug),
        getRecentPosts(),
      ]);
      
      if (!postData) {
        navigate('/blog', { replace: true });
        return;
      }
      
      setPost(postData);
      // Filter out current post from related posts
      setRelatedPosts(recentData.filter((p) => p.slug.current !== slug).slice(0, 3));
      setIsLoading(false);
    }
    fetchData();
  }, [slug, navigate]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Helper to find matching festival for a text string
  const findMatchingFestival = useCallback((text: string): AffiliateLink | null => {
    if (!allFestivals.length) return null;
    
    const lowerText = text.toLowerCase();
    
    // Festival name patterns to match (without year suffix)
    const festivalPatterns = [
      'coachella', 'bonnaroo', 'lollapalooza', 'austin city limits', 'acl',
      'edc', 'electric daisy carnival', 'ultra', 'stagecoach', 
      'governors ball', "governor's ball", 'firefly', 'bottlerock',
      'outside lands', 'electric forest', 'summerfest', 'shaky knees',
      'hangout', 'when we were young', 'rolling loud', 'primavera'
    ];
    
    for (const pattern of festivalPatterns) {
      if (lowerText.includes(pattern)) {
        // Find the matching festival in our data
        const match = allFestivals.find(f => 
          f.name.toLowerCase().includes(pattern) ||
          pattern.includes(f.name.toLowerCase().replace(/\s+\d{4}$/, ''))
        );
        if (match && (match.ticketUrl || match.websiteUrl)) {
          return match;
        }
      }
    }
    
    return null;
  }, [allFestivals]);

  // Create affiliate-enhanced PortableText components
  const affiliateTextComponents = useMemo(() => ({
    ...portableTextComponents,
    block: {
      ...portableTextComponents.block,
      h2: ({ children }: { children?: React.ReactNode }) => {
        // Check if heading contains a festival name
        const text = typeof children === 'string' ? children : 
          (Array.isArray(children) ? children.join('') : '');
        const match = findMatchingFestival(text);
        
        if (match && (match.ticketUrl || match.websiteUrl)) {
          return (
            <h2 className="text-xl sm:text-2xl font-bold mt-10 mb-4 text-foreground tracking-tight border-b border-border/50 pb-2 flex items-center justify-between gap-3 flex-wrap">
              <span>{children}</span>
              <a 
                href={match.ticketUrl || match.websiteUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-colors px-3 py-1.5 rounded-full shadow-sm"
              >
                <Ticket className="w-3.5 h-3.5" />
                Get Tickets
              </a>
            </h2>
          );
        }
        
        return <h2 className="text-xl sm:text-2xl font-bold mt-10 mb-4 text-foreground tracking-tight border-b border-border/50 pb-2">{children}</h2>;
      },
    },
  }), [findMatchingFestival]);

  const handleShare = async () => {
    if (navigator.share && post) {
      await navigator.share({
        title: post.title,
        text: post.excerpt || '',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      // Could show a toast here
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
          <div className="animate-pulse space-y-6">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-12 bg-muted rounded w-3/4" />
            <div className="flex gap-4">
              <div className="h-4 bg-muted rounded w-32" />
              <div className="h-4 bg-muted rounded w-24" />
            </div>
            <div className="aspect-[16/9] bg-muted rounded-xl" />
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 bg-muted rounded w-full" />
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!post) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Post not found</h1>
          <Link to="/blog" className="text-primary hover:underline">
            Back to blog
          </Link>
        </div>
      </AppLayout>
    );
  }

  const seoDescription = post.seoDescription || post.excerpt || `Read "${post.title}" on the setlists.live blog.`;
  const seoTitle = post.seoTitle || `${post.title} | setlists.live Blog`;

  // Generate a gradient background if no image
  const heroImageUrl = post.mainImage?.asset 
    ? urlFor(post.mainImage).width(1920).height(1080).url() 
    : null;

  return (
    <AppLayout>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={`/blog/${post.slug.current}`}
        ogImage={post.mainImage?.asset ? urlFor(post.mainImage).width(1200).height(630).url() : undefined}
        ogType="article"
      />

      <article className="relative">
        {/* Hero Header - Full Width Medium Style */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative min-h-[50vh] sm:min-h-[55vh] flex items-end overflow-hidden"
          style={{ 
            marginLeft: 'calc(-50vw + 50%)', 
            marginRight: 'calc(-50vw + 50%)', 
            width: '100vw',
            maxWidth: '100vw'
          }}
        >
          {/* Background Image or Gradient - True Full Width */}
          <div className="absolute inset-0">
            {heroImageUrl ? (
              <img
                src={heroImageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
            )}
            {/* Dark Overlay - Gradient from bottom for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
          </div>

          {/* Back Button - Floating */}
          <Link
            to="/blog"
            className="absolute top-4 left-4 sm:left-6 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Back
          </Link>

          {/* Share Button - Floating */}
          <button
            onClick={handleShare}
            className="absolute top-4 right-4 sm:right-6 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all"
          >
            <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Share
          </button>

          {/* Content */}
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12">
            <div className="max-w-3xl mx-auto">
              {/* Categories */}
              {post.categories && post.categories.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="flex flex-wrap gap-2 mb-4"
                >
                  {post.categories.map((cat) => (
                    <Link
                      key={cat.slug.current}
                      to={`/blog?category=${cat.slug.current}`}
                      className="px-2.5 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-sm transition-colors"
                    >
                      {cat.title}
                    </Link>
                  ))}
                </motion.div>
              )}

              {/* Title */}
              <motion.h1 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight text-white mb-4"
                style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
              >
                {post.title}
              </motion.h1>

              {/* Excerpt */}
              {post.excerpt && (
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="text-sm sm:text-base text-white/80 mb-5 max-w-2xl"
                >
                  {post.excerpt}
                </motion.p>
              )}

              {/* Meta */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs sm:text-sm text-white/70"
              >
                {post.author && (
                  <div className="flex items-center gap-2">
                    {post.author.image ? (
                      <img
                        src={urlFor(post.author.image).width(32).height(32).url()}
                        alt={post.author.name}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-white/30"
                      />
                    ) : (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-white/80" />
                      </div>
                    )}
                    <span className="font-medium text-white">{post.author.name}</span>
                  </div>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(post.publishedAt)}
                </span>
                {post.readingTime && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {post.readingTime} min read
                  </span>
                )}
              </motion.div>
            </div>
          </div>
        </motion.header>

        {/* Body Content */}
        <div className="bg-background">
          <div className="mx-auto px-4 sm:px-6 py-8 sm:py-10 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-headings:font-bold prose-p:text-muted-foreground prose-p:leading-relaxed prose-a:text-primary prose-strong:text-foreground"
            >
              {post.body && (
                <PortableText value={post.body} components={affiliateTextComponents} />
              )}
            </motion.div>

            {/* Author Bio Card */}
            {post.author && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="mt-10 p-4 sm:p-5 bg-secondary/30 rounded-xl flex items-center gap-3"
              >
                {post.author.image ? (
                  <img
                    src={urlFor(post.author.image).width(64).height(64).url()}
                    alt={post.author.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Written by</p>
                  <p className="font-semibold text-sm sm:text-base">{post.author.name}</p>
                </div>
              </motion.div>
            )}

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
              <div className="mt-12 pt-8 border-t border-border">
                <h2 className="text-lg sm:text-xl font-bold mb-4">Continue Reading</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {relatedPosts.map((relatedPost) => (
                    <motion.div
                      key={relatedPost._id}
                      whileHover={{ y: -2 }}
                      className="glass-card rounded-lg overflow-hidden group"
                    >
                      <Link to={`/blog/${relatedPost.slug.current}`}>
                        <div className="aspect-[16/9] overflow-hidden">
                          {relatedPost.mainImage?.asset ? (
                            <img
                              src={urlFor(relatedPost.mainImage).width(400).height(225).url()}
                              alt={relatedPost.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-black flex items-center justify-center">
                              <span className="text-2xl">🎵</span>
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                            {relatedPost.title}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {formatDate(relatedPost.publishedAt)}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="mt-10 glass-card rounded-xl p-6 sm:p-8 text-center bg-gradient-to-br from-primary/5 to-secondary/10">
              <h3 className="text-lg sm:text-xl font-bold mb-2">Discover More Music</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                Explore upcoming shows and vote on setlists for your favorite artists
              </p>
              <Link
                to="/shows"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Browse Shows
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </article>
    </AppLayout>
  );
}

