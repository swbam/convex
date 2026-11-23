import { articleHeadingId, articleHeadingText } from "../lib/articleHeadings";
import { TicketLink } from "../components/TicketLink";
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useSpring, useReducedMotion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { BlogCard } from '../components/BlogCard';
import { getBlogImage } from '../lib/blogPresentation';
import { toast } from 'sonner';
import { Calendar, Clock, ArrowLeft, User, Share2, ChevronRight, Ticket, ChevronUp, BookOpen, Info } from 'lucide-react';
import { PortableText } from '@portabletext/react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getPostBySlug, getRecentPosts, urlFor, type BlogPost } from '../lib/sanity';
import { AppLayout } from '../components/AppLayout';


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
    .map((block: any) => {
      const text = articleHeadingText(block);
      const id = articleHeadingId(block);
      return {
        id,
        text,
        level: block.style as 'h2' | 'h3',
      };
    });
}

// Article content uses the same typography and controls as the public templates.
const createPortableTextComponents = () => ({
  types: {
    image: ({ value }: { value: { asset: { _ref: string }; alt?: string; caption?: string } }) => {
      if (!value?.asset?._ref) return null;
      return (
        <figure className="my-8">
          <img
            src={urlFor(value).width(1400).url()}
            alt={value.alt || ''}
            className="w-full rounded-[5px]"
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
        <div className="my-8">
          <div className="bg-slate-900 dark:bg-slate-950 rounded-none sm:rounded-[5px] overflow-hidden shadow-lg">
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
    // Skip h1 blocks entirely - the title is already shown in the hero header
    h1: () => null,
    h2: ({ children, value }: { children?: React.ReactNode; value?: any }) => {
      const id = articleHeadingId(value);
      return (
        <h2 id={id} className="text-xl sm:text-2xl font-semibold mt-10 mb-4 text-foreground tracking-tight scroll-mt-24 border-b border-border/40 pb-3">
          {children}
        </h2>
      );
    },
    h3: ({ children, value }: { children?: React.ReactNode; value?: any }) => {
      const id = articleHeadingId(value);
      return (
        <h3 id={id} className="text-lg sm:text-xl font-semibold mt-8 mb-3 text-foreground scroll-mt-24">
          {children}
        </h3>
      );
    },
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="text-lg sm:text-xl font-semibold mt-8 mb-3 text-foreground">{children}</h4>
    ),
    normal: ({ children }: { children?: React.ReactNode }) => (
      <p className="text-base sm:text-lg leading-relaxed mb-6 text-foreground/90">
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
          <div className="my-10 p-6 bg-secondary/40 border border-border rounded-[5px]">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 text-base leading-relaxed text-foreground/90">
                {children}
              </div>
            </div>
          </div>
        );
      }
      
      return (
        <blockquote className="border-l-4 border-border pl-6 my-10 text-xl italic text-muted-foreground">
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
          className="text-foreground underline underline-offset-4 decoration-primary/40 hover:decoration-primary transition-colors font-medium"
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
      <ul className="space-y-4 mb-8 text-base sm:text-lg">{children}</ul>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal space-y-4 mb-8 ml-6 text-base sm:text-lg">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-foreground/90 leading-[1.8] pl-2 ml-6 relative before:content-['•'] before:absolute before:-left-4 before:text-primary before:font-bold before:text-base sm:text-lg">
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

  const reduceMotion = useReducedMotion();

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
  const affiliateTextComponents = useMemo(() => {
    const baseComponents = createPortableTextComponents();
    
    return {
      ...baseComponents,
      block: {
        ...baseComponents.block,
        h2: ({ children, value }: { children?: React.ReactNode; value?: any }) => {
          const text = articleHeadingText(value);
          const id = articleHeadingId(value);
          const match = findMatchingFestival(text);
          
          if (match && (match.ticketUrl || match.websiteUrl)) {
            return (
              <h2 id={id} className="text-xl sm:text-2xl font-semibold mt-10 mb-4 text-foreground tracking-tight scroll-mt-24 border-b border-border/40 pb-3 flex items-center justify-between gap-4 flex-wrap">
                <span>{children}</span>
                <TicketLink
                  href={match.ticketUrl || match.websiteUrl} placement="blog_festival" properties={{ festival_slug: match.slug }}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="site-button brand-primary min-h-11 inline-flex items-center gap-2 px-4 text-sm font-medium"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  Get Tickets
                </TicketLink>
              </h2>
            );
          }
          
          return (
            <h2 id={id} className="text-xl sm:text-2xl font-semibold mt-10 mb-4 text-foreground tracking-tight scroll-mt-24 border-b border-border/40 pb-3">
              {children}
            </h2>
          );
        },
      },
    };
  }, [findMatchingFestival]);

  const handleShare = async () => {
    try {
      if (navigator.share && post) await navigator.share({ title: post.title, text: post.excerpt || '', url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); toast.success('Article link copied'); }
    } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) toast.error('Could not share this article. Please copy the link from your browser.'); }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
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
            <div className="aspect-[16/9] bg-muted rounded-[5px]" />
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


  const heroImageUrl = getBlogImage(post, 1600);

  return (
    <AppLayout>


      {/* Reading Progress Bar */}
      <motion.div
        className="fixed top-14 md:top-16 left-0 right-0 h-0.5 bg-foreground origin-left z-50"
        style={{ scaleX }}
      />

      <article className="relative">
        <motion.header initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="border-b border-border">
          <div className="public-page pb-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground"><Link to="/" className="hover:text-foreground">Home</Link><ChevronRight className="h-3 w-3" aria-hidden="true" /><Link to="/blog" className="hover:text-foreground">Blog</Link></nav>
              <Button variant="outline" onClick={handleShare} aria-label="Share article"><Share2 aria-hidden="true" />Share</Button>
            </div>
            {post.categories && <div className="mb-3 flex flex-wrap gap-3">{post.categories.map(cat=><Link key={cat.slug.current} to={`/blog?category=${cat.slug.current}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground hover:underline">{cat.title}</Link>)}</div>}
            <h1 className="page-title max-w-4xl">{post.title}</h1>
            {post.excerpt && <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">{post.excerpt}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
              {post.author && <span>{post.author.name}</span>}
              <span>{formatDate(post.publishedAt)}</span>
              {post.readingTime && <span>{post.readingTime} min read</span>}
            </div>
          </div>
          {heroImageUrl && <div className="public-page py-0"><img src={heroImageUrl} alt={''} width="1600" height="900" className="max-h-80 w-full aspect-[21/9] object-cover" /></div>}
        </motion.header>

        {/* Body Content with Sidebar ToC */}
        <div className="bg-background">
          <div className="public-page py-6 sm:py-8">
            <div className="flex min-w-0 gap-8 lg:gap-12">
              {/* Main Content */}
              <div className="article-body min-w-0 w-full flex-1 max-w-3xl">
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {post.body && (
                    <PortableText value={post.body} components={affiliateTextComponents} />
                  )}
                </motion.div>

                {/* Author Bio Card */}
                {post.author && (
                  <motion.div 
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-14 p-6 bg-secondary/30 rounded-[5px] border border-border"
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
                        <p className="font-bold text-base sm:text-lg">{post.author.name}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Related Posts */}
                {relatedPosts.length > 0 && (
                  <div className="mt-16 pt-10 border-t border-border">
                    <h2 className="text-2xl font-bold mb-8">Continue Reading</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {relatedPosts.slice(0, 2).map(relatedPost => <BlogCard key={relatedPost._id} post={relatedPost} />)}
                    </div>
                  </div>
                )}

                {/* Final CTA */}
                <div className="mt-10 border-y border-border py-6">
                  <h3 className="text-xl font-bold mb-3">Discover More Music</h3>
                  <p className="text-muted-foreground mb-5 max-w-xl">
                    Explore upcoming shows and vote on setlists for your favorite artists
                  </p>
                  <Link
                    to="/shows"
                    className="site-button brand-primary inline-flex min-h-11 items-center gap-2 px-5 font-medium"
                  >
                    Browse Shows
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Sticky Sidebar ToC - Desktop Only */}
              {tocItems.length > 3 && (
                <aside className="hidden lg:block w-56 flex-shrink-0">
                  <div className="sticky top-24">
                    <div className="border-l border-border pl-5">
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
                              document.getElementById(item.id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
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
          className="site-button brand-primary fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40 h-11 w-11 flex items-center justify-center"
          aria-label="Scroll to top"
        >
          <ChevronUp className="w-5 h-5" />
        </motion.button>
      )}
    </AppLayout>
  );
}
