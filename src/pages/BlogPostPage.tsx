import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import { Calendar, Clock, ArrowLeft, User, Share2, ChevronRight, Ticket, ChevronUp, BookOpen, Info } from 'lucide-react';
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

// Type for ToC items
interface TocItem {
  id: string;
  text: string;
  level: 'h2' | 'h3';
}

// Extract headings from Portable Text for Table of Contents
function extractHeadings(body: unknown[]): TocItem[] {
  if (!body || !Array.isArray(body)) return [];
  
  return body
    .filter((block: any) => block._type === 'block' && (block.style === 'h2' || block.style === 'h3'))
    .map((block: any, index: number) => {
      const text = block.children?.map((child: any) => child.text || '').join('') || '';
      const id = `heading-${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`;
      return {
        id,
        text,
        level: block.style as 'h2' | 'h3',
      };
    });
}

// Custom components for rendering Portable Text - Medium/Substack inspired
const createPortableTextComponents = (headingIndex: { current: number }) => ({
  types: {
    image: ({ value }: { value: { asset: { _ref: string }; alt?: string; caption?: string } }) => {
      if (!value?.asset?._ref) return null;
      return (
        <figure className="my-10 -mx-4 sm:mx-0">
          <img
            src={urlFor(value).width(1400).url()}
            alt={value.alt || ''}
            className="w-full sm:rounded-xl shadow-lg"
          />
          {value.caption && (
            <figcaption className="text-center text-sm text-muted-foreground mt-4 px-4 sm:px-0 italic">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
    code: ({ value }: { value: { code: string; language?: string } }) => {
      return (
        <div className="my-8 -mx-4 sm:mx-0">
          <div className="bg-slate-900 dark:bg-slate-950 rounded-none sm:rounded-xl overflow-hidden shadow-lg">
            {value.language && (
              <div className="px-4 py-2 bg-slate-800 dark:bg-slate-900 text-xs text-slate-400 font-mono border-b border-slate-700">
                {value.language}
              </div>
            )}
            <pre className="p-4 overflow-x-auto text-sm">
              <code className="text-slate-100 font-mono whitespace-pre">
                {value.code}
              </code>
            </pre>
          </div>
        </div>
      );
    },
  },
  block: {
    h1: ({ children }: { children?: React.ReactNode }) => {
      const text = typeof children === 'string' ? children : 
        (Array.isArray(children) ? children.join('') : '');
      const id = `heading-${headingIndex.current++}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`;
      return (
        <h1 id={id} className="text-3xl sm:text-4xl font-bold mt-16 mb-6 text-foreground tracking-tight scroll-mt-24">
          {children}
        </h1>
      );
    },
    h2: ({ children }: { children?: React.ReactNode }) => {
      const text = typeof children === 'string' ? children : 
        (Array.isArray(children) ? children.join('') : '');
      const id = `heading-${headingIndex.current++}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`;
      return (
        <h2 id={id} className="text-2xl sm:text-3xl font-bold mt-14 mb-5 text-foreground tracking-tight scroll-mt-24 border-b border-border/40 pb-3">
          {children}
        </h2>
      );
    },
    h3: ({ children }: { children?: React.ReactNode }) => {
      const text = typeof children === 'string' ? children : 
        (Array.isArray(children) ? children.join('') : '');
      const id = `heading-${headingIndex.current++}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`;
      return (
        <h3 id={id} className="text-xl sm:text-2xl font-semibold mt-10 mb-4 text-foreground scroll-mt-24">
          {children}
        </h3>
      );
    },
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="text-lg sm:text-xl font-semibold mt-8 mb-3 text-foreground">{children}</h4>
    ),
    normal: ({ children }: { children?: React.ReactNode }) => (
      <p className="text-lg leading-[1.85] mb-7 text-foreground/90" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
        {children}
      </p>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => {
      // Check if this is a "Key Takeaways" or navigation block
      const text = typeof children === 'string' ? children : '';
      const isKeyTakeaways = text.toLowerCase().includes('key takeaway') || 
                            text.toLowerCase().includes('quick navigation');
      
      if (isKeyTakeaways) {
        return (
          <div className="my-10 p-6 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 text-base leading-relaxed text-foreground/90" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                {children}
              </div>
            </div>
          </div>
        );
      }
      
      return (
        <blockquote className="border-l-4 border-primary/60 pl-6 my-10 text-xl italic text-muted-foreground" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          {children}
        </blockquote>
      );
    },
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
          className="text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary transition-colors font-medium"
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
      <code className="bg-secondary/80 px-2 py-1 rounded-md text-sm font-mono text-foreground">{children}</code>
    ),
  },
  list: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <ul className="space-y-4 mb-8 text-lg" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{children}</ul>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal space-y-4 mb-8 ml-6 text-lg" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-foreground/90 leading-[1.8] pl-2 ml-6 relative before:content-['•'] before:absolute before:-left-4 before:text-primary before:font-bold before:text-lg">
        {children}
      </li>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-foreground/90 leading-[1.8]">{children}</li>
    ),
  },
});

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeHeading, setActiveHeading] = useState<string>('');
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Reading progress
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

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
      setRelatedPosts(recentData.filter((p) => p.slug.current !== slug).slice(0, 3));
      setIsLoading(false);
    }
    fetchData();
  }, [slug, navigate]);

  // Track scroll position for ToC highlighting and scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
      
      // Find active heading
      const headings = document.querySelectorAll('h2[id], h3[id]');
      let current = '';
      headings.forEach((heading) => {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= 150) {
          current = heading.id;
        }
      });
      setActiveHeading(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Extract ToC from post body
  const tocItems = useMemo(() => {
    if (!post?.body) return [];
    return extractHeadings(post.body as unknown[]);
  }, [post?.body]);

  // Helper to find matching festival for a text string
  const findMatchingFestival = useCallback((text: string): AffiliateLink | null => {
    if (!allFestivals.length) return null;
    
    const lowerText = text.toLowerCase();
    const festivalPatterns = [
      'coachella', 'bonnaroo', 'lollapalooza', 'austin city limits', 'acl',
      'edc', 'electric daisy carnival', 'ultra', 'stagecoach', 
      'governors ball', "governor's ball", 'firefly', 'bottlerock',
      'outside lands', 'electric forest', 'summerfest', 'shaky knees',
      'hangout', 'when we were young', 'rolling loud', 'primavera'
    ];
    
    for (const pattern of festivalPatterns) {
      if (lowerText.includes(pattern)) {
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
  const headingIndexRef = useMemo(() => ({ current: 0 }), [post?.body]);
  
  const affiliateTextComponents = useMemo(() => {
    headingIndexRef.current = 0;
    const baseComponents = createPortableTextComponents(headingIndexRef);
    
    return {
      ...baseComponents,
      block: {
        ...baseComponents.block,
        h2: ({ children }: { children?: React.ReactNode }) => {
          const text = typeof children === 'string' ? children : 
            (Array.isArray(children) ? children.join('') : '');
          const id = `heading-${headingIndexRef.current++}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`;
          const match = findMatchingFestival(text);
          
          if (match && (match.ticketUrl || match.websiteUrl)) {
            return (
              <h2 id={id} className="text-2xl sm:text-3xl font-bold mt-14 mb-5 text-foreground tracking-tight scroll-mt-24 border-b border-border/40 pb-3 flex items-center justify-between gap-4 flex-wrap">
                <span>{children}</span>
                <a 
                  href={match.ticketUrl || match.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-colors px-4 py-2 rounded-full shadow-sm"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  Get Tickets
                </a>
              </h2>
            );
          }
          
          return (
            <h2 id={id} className="text-2xl sm:text-3xl font-bold mt-14 mb-5 text-foreground tracking-tight scroll-mt-24 border-b border-border/40 pb-3">
              {children}
            </h2>
          );
        },
      },
    };
  }, [findMatchingFestival, headingIndexRef]);

  const handleShare = async () => {
    if (navigator.share && post) {
      await navigator.share({
        title: post.title,
        text: post.excerpt || '',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const blogHeaderImages: Record<string, string> = {
    'concert-tours-2025-2026-city-guide': 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1920&h=1080&fit=crop&q=80',
    'music-festivals-2026-complete-guide': 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1920&h=1080&fit=crop&q=80',
    'complete-guide-concert-setlists': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1920&h=1080&fit=crop&q=80',
    'ultimate-guide-us-music-festivals-2026': 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1920&h=1080&fit=crop&q=80',
    'best-setlist-apps-websites-2025': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1920&h=1080&fit=crop&q=80',
  };

  const heroImageUrl = post.mainImage?.asset 
    ? urlFor(post.mainImage).width(1920).height(1080).url() 
    : blogHeaderImages[post.slug.current] || null;

  return (
    <AppLayout>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={`/blog/${post.slug.current}`}
        ogImage={post.mainImage?.asset ? urlFor(post.mainImage).width(1200).height(630).url() : (heroImageUrl || undefined)}
        ogType="article"
      />

      {/* Reading Progress Bar */}
      <motion.div
        className="fixed top-14 left-0 right-0 h-1 bg-primary origin-left z-50"
        style={{ scaleX }}
      />

      <article className="relative">
        {/* Hero Header - Full Width */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative min-h-[50vh] sm:min-h-[55vh] flex flex-col overflow-hidden"
        >
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30" />
          </div>

          {/* Top Bar - Breadcrumbs and Actions */}
          <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
              {/* Breadcrumbs */}
              <nav className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-white/70 overflow-hidden">
                <Link to="/" className="hover:text-white transition-colors flex-shrink-0">Home</Link>
                <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                <Link to="/blog" className="hover:text-white transition-colors flex-shrink-0">Blog</Link>
                {post.categories && post.categories.length > 0 && (
                  <>
                    <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                    <Link 
                      to={`/blog?category=${post.categories[0].slug.current}`}
                      className="hover:text-white transition-colors flex-shrink-0"
                    >
                      {post.categories[0].title}
                    </Link>
                  </>
                )}
              </nav>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  to="/blog"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Back</span>
                </Link>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              </div>
            </div>
          </div>

          {/* Hero Content - Title & Meta */}
          <div className="relative z-10 flex-1 flex items-end w-full px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12">
            <div className="max-w-4xl mx-auto w-full">
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
                      className="px-3 py-1 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-sm transition-colors uppercase tracking-wide"
                    >
                      {cat.title}
                    </Link>
                  ))}
                </motion.div>
              )}

              <motion.h1 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight text-white mb-5"
                style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
              >
                {post.title}
              </motion.h1>

              {post.excerpt && (
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="text-base sm:text-lg text-white/85 mb-6 max-w-3xl leading-relaxed"
                >
                  {post.excerpt}
                </motion.p>
              )}

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-white/70"
              >
                {post.author && (
                  <div className="flex items-center gap-2">
                    {post.author.image ? (
                      <img
                        src={urlFor(post.author.image).width(40).height(40).url()}
                        alt={post.author.name}
                        className="w-9 h-9 rounded-full object-cover border-2 border-white/30"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-white/80" />
                      </div>
                    )}
                    <span className="font-semibold text-white">{post.author.name}</span>
                  </div>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDate(post.publishedAt)}
                </span>
                {post.readingTime && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {post.readingTime} min read
                  </span>
                )}
              </motion.div>
            </div>
          </div>
        </motion.header>

        {/* Body Content with Sidebar ToC */}
        <div className="bg-background">
          <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-14 max-w-6xl">
            <div className="flex gap-10 lg:gap-16">
              {/* Main Content */}
              <div className="flex-1 max-w-3xl">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
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
                    className="mt-14 p-6 bg-secondary/30 rounded-2xl border border-border"
                  >
                    <div className="flex items-center gap-4">
                      {post.author.image ? (
                        <img
                          src={urlFor(post.author.image).width(80).height(80).url()}
                          alt={post.author.name}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                          <User className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Written by</p>
                        <p className="font-bold text-lg">{post.author.name}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Newsletter CTA */}
                <div className="mt-14 p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl border border-primary/20">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-3">Stay Updated</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Get the latest concert news, setlist predictions, and exclusive content delivered to your inbox.
                    </p>
                    <div className="flex gap-3 max-w-md mx-auto">
                      <input 
                        type="email" 
                        placeholder="Enter your email"
                        className="flex-1 px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <button className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors">
                        Subscribe
                      </button>
                    </div>
                  </div>
                </div>

                {/* Related Posts */}
                {relatedPosts.length > 0 && (
                  <div className="mt-16 pt-10 border-t border-border">
                    <h2 className="text-2xl font-bold mb-8">Continue Reading</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {relatedPosts.slice(0, 2).map((relatedPost) => (
                        <motion.div
                          key={relatedPost._id}
                          whileHover={{ y: -4 }}
                          className="glass-card rounded-xl overflow-hidden group"
                        >
                          <Link to={`/blog/${relatedPost.slug.current}`}>
                            <div className="aspect-[16/9] overflow-hidden">
                              {relatedPost.mainImage?.asset ? (
                                <img
                                  src={urlFor(relatedPost.mainImage).width(600).height(338).url()}
                                  alt={relatedPost.title}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-slate-800 to-black flex items-center justify-center">
                                  <span className="text-4xl">🎵</span>
                                </div>
                              )}
                            </div>
                            <div className="p-5">
                              <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                                {relatedPost.title}
                              </h3>
                              {relatedPost.excerpt && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                  {relatedPost.excerpt}
                                </p>
                              )}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(relatedPost.publishedAt)}
                                {relatedPost.readingTime && (
                                  <>
                                    <span>•</span>
                                    <span>{relatedPost.readingTime} min read</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Final CTA */}
                <div className="mt-14 glass-card rounded-2xl p-8 text-center bg-gradient-to-br from-primary/5 to-secondary/10">
                  <h3 className="text-xl font-bold mb-3">Discover More Music</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    Explore upcoming shows and vote on setlists for your favorite artists
                  </p>
                  <Link
                    to="/shows"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-full font-semibold hover:opacity-90 transition-opacity"
                  >
                    Browse Shows
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Sticky Sidebar ToC - Desktop Only */}
              {tocItems.length > 3 && (
                <aside className="hidden lg:block w-64 flex-shrink-0">
                  <div className="sticky top-24">
                    <div className="p-5 bg-secondary/30 rounded-xl border border-border">
                      <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground">
                        <BookOpen className="w-4 h-4" />
                        On This Page
                      </div>
                      <nav className="space-y-1">
                        {tocItems.map((item) => (
                          <a
                            key={item.id}
                            href={`#${item.id}`}
                            className={`block py-1.5 text-sm transition-colors ${
                              item.level === 'h3' ? 'pl-4' : ''
                            } ${
                              activeHeading === item.id
                                ? 'text-primary font-medium'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                            }}
                          >
                            {item.text}
                          </a>
                        ))}
                      </nav>
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </div>
        </div>
      </article>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToTop}
          className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
          aria-label="Scroll to top"
        >
          <ChevronUp className="w-5 h-5" />
        </motion.button>
      )}
    </AppLayout>
  );
}
