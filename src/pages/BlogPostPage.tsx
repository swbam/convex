import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, ArrowLeft, User, Share2, ChevronRight } from 'lucide-react';
import { PortableText } from '@portabletext/react';
import { getPostBySlug, getRecentPosts, urlFor, type BlogPost } from '../lib/sanity';
import { AppLayout } from '../components/AppLayout';
import { SEOHead } from '../components/SEOHead';

// Custom components for rendering Portable Text
const portableTextComponents = {
  types: {
    image: ({ value }: { value: { asset: { _ref: string }; alt?: string; caption?: string } }) => {
      if (!value?.asset?._ref) return null;
      return (
        <figure className="my-8">
          <img
            src={urlFor(value).width(1200).url()}
            alt={value.alt || ''}
            className="rounded-xl w-full"
          />
          {value.caption && (
            <figcaption className="text-center text-sm text-muted-foreground mt-2">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
  },
  block: {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-3xl sm:text-4xl font-bold mt-10 mb-4">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-2xl sm:text-3xl font-bold mt-8 mb-4">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-xl sm:text-2xl font-semibold mt-6 mb-3">{children}</h3>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="text-lg font-semibold mt-5 mb-2">{children}</h4>
    ),
    normal: ({ children }: { children?: React.ReactNode }) => (
      <p className="text-base sm:text-lg leading-relaxed mb-4">{children}</p>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-4 border-primary pl-6 my-6 italic text-muted-foreground">
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
          className="text-primary hover:underline"
        >
          {children}
        </a>
      );
    },
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic">{children}</em>
    ),
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
    ),
  },
  list: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc list-inside space-y-2 mb-4 ml-4">{children}</ul>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal list-inside space-y-2 mb-4 ml-4">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-base sm:text-lg">{children}</li>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <li className="text-base sm:text-lg">{children}</li>
    ),
  },
};

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

      <article>
        {/* Hero Header - Medium Style */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative min-h-[70vh] sm:min-h-[75vh] flex items-end overflow-hidden"
        >
          {/* Background Image or Gradient */}
          <div className="absolute inset-0">
            {heroImageUrl ? (
              <img
                src={heroImageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" />
            )}
            {/* Dark Overlay - Gradient from bottom for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
          </div>

          {/* Back Button - Floating */}
          <Link
            to="/blog"
            className="absolute top-6 left-4 sm:left-8 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          {/* Share Button - Floating */}
          <button
            onClick={handleShare}
            className="absolute top-6 right-4 sm:right-8 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>

          {/* Content */}
          <div className="relative z-10 w-full px-4 sm:px-8 pb-12 sm:pb-16">
            <div className="max-w-4xl mx-auto">
              {/* Categories */}
              {post.categories && post.categories.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="flex flex-wrap gap-2 mb-5"
                >
                  {post.categories.map((cat) => (
                    <Link
                      key={cat.slug.current}
                      to={`/blog?category=${cat.slug.current}`}
                      className="px-3 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-sm transition-colors"
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
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-white mb-5"
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
                  className="text-lg sm:text-xl text-white/80 mb-6 max-w-3xl"
                >
                  {post.excerpt}
                </motion.p>
              )}

              {/* Meta */}
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
                        <User className="w-5 h-5 text-white/80" />
                      </div>
                    )}
                    <span className="font-medium text-white">{post.author.name}</span>
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

        {/* Body Content */}
        <div className="bg-background">
          <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-14 max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-p:text-muted-foreground prose-p:leading-relaxed prose-a:text-primary prose-strong:text-foreground"
            >
              {post.body && (
                <PortableText value={post.body} components={portableTextComponents} />
              )}
            </motion.div>

            {/* Author Bio Card */}
            {post.author && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="mt-12 p-6 bg-secondary/30 rounded-2xl flex items-center gap-4"
              >
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
                  <p className="text-sm text-muted-foreground mb-1">Written by</p>
                  <p className="font-semibold text-lg">{post.author.name}</p>
                </div>
              </motion.div>
            )}

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
              <div className="mt-16 pt-10 border-t border-border">
                <h2 className="text-2xl font-bold mb-6">Continue Reading</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {relatedPosts.map((relatedPost) => (
                    <motion.div
                      key={relatedPost._id}
                      whileHover={{ y: -4 }}
                      className="glass-card rounded-xl overflow-hidden group"
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
                            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center">
                              <span className="text-3xl">🎵</span>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                            {relatedPost.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5" />
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
            <div className="mt-12 glass-card rounded-2xl p-8 sm:p-10 text-center bg-gradient-to-br from-primary/5 to-secondary/10">
              <h3 className="text-2xl font-bold mb-3">Discover More Music</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Explore upcoming shows and vote on setlists for your favorite artists
              </p>
              <Link
                to="/shows"
                className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-full font-medium hover:opacity-90 transition-opacity"
              >
                Browse Shows
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </article>
    </AppLayout>
  );
}

