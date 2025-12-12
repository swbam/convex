import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, ChevronRight, User, Sparkles, TrendingUp } from 'lucide-react';
import { getAllPosts, getAllCategories, urlFor, type BlogPost, type Category } from '../lib/sanity';
import { AppLayout } from '../components/AppLayout';
import { SEOHead } from '../components/SEOHead';

export function BlogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const selectedCategory = searchParams.get('category');

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      const [postsData, categoriesData] = await Promise.all([
        getAllPosts(),
        getAllCategories(),
      ]);
      setPosts(postsData);
      setCategories(categoriesData);
      setIsLoading(false);
    }
    fetchData();
  }, []);

  const filteredPosts = selectedCategory
    ? posts.filter((post) =>
        post.categories?.some((cat) => cat.slug.current === selectedCategory)
      )
    : posts;

  // Separate featured post from rest (first post is featured when not filtering)
  const featuredPost = !selectedCategory && filteredPosts.length > 0 ? filteredPosts[0] : null;
  const regularPosts = featuredPost ? filteredPosts.slice(1) : filteredPosts;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Curated Unsplash images for blog posts (high-quality concert/festival photography)
  const blogHeaderImages: Record<string, string> = {
    'concert-tours-2025-2026-city-guide': 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1200&h=675&fit=crop&q=80',
    'music-festivals-2026-complete-guide': 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&h=675&fit=crop&q=80',
    'complete-guide-concert-setlists': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=675&fit=crop&q=80',
    'ultimate-guide-us-music-festivals-2026': 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1200&h=675&fit=crop&q=80',
    'best-setlist-apps-websites-2025': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=675&fit=crop&q=80',
  };

  const getPostImage = (post: BlogPost, size: 'small' | 'large' = 'small'): string | null => {
    const width = size === 'large' ? 1200 : 600;
    const height = size === 'large' ? 675 : 338;
    
    if (post.mainImage?.asset) {
      return urlFor(post.mainImage).width(width).height(height).url();
    }
    
    const fallback = blogHeaderImages[post.slug.current];
    if (fallback) {
      return fallback.replace(/w=\d+&h=\d+/, `w=${width}&h=${height}`);
    }
    return null;
  };

  const handleCategoryChange = (category: string | null) => {
    if (category) {
      setSearchParams({ category });
    } else {
      setSearchParams({});
    }
  };

  return (
    <AppLayout>
      <SEOHead
        title="Blog | setlists.live"
        description="Concert news, setlist predictions, artist spotlights, and music industry insights from the setlists.live team."
        canonicalUrl="/blog"
      />

      {/* Full Width Hero Header */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-6"
            >
              <Sparkles className="w-4 h-4" />
              Concert Insights & Guides
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-5 text-white"
            >
              The Setlist Blog
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto"
            >
              Concert news, setlist predictions, artist spotlights, and music industry insights
            </motion.p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-7xl">
        {/* Category Filter */}
        {categories.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-2 mb-10"
          >
            <button
              onClick={() => handleCategoryChange(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !selectedCategory
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-secondary hover:bg-secondary/80 text-foreground'
              }`}
            >
              All Posts
            </button>
            {categories.map((category) => (
              <button
                key={category._id}
                onClick={() => handleCategoryChange(category.slug.current)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === category.slug.current
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-secondary hover:bg-secondary/80 text-foreground'
                }`}
              >
                {category.title}
              </button>
            ))}
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-8">
            {/* Featured skeleton */}
            <div className="glass-card rounded-2xl overflow-hidden animate-pulse">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="aspect-[16/9] lg:aspect-auto lg:h-full bg-muted" />
                <div className="p-8 space-y-4">
                  <div className="h-4 bg-muted rounded w-1/4" />
                  <div className="h-10 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              </div>
            </div>
            {/* Grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-card rounded-xl overflow-hidden animate-pulse">
                  <div className="aspect-[16/9] bg-muted" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredPosts.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="glass-card inline-block p-8 rounded-2xl">
              <p className="text-xl text-muted-foreground mb-4">
                {posts.length === 0
                  ? 'No blog posts yet. Check back soon!'
                  : 'No posts in this category yet.'}
              </p>
              {selectedCategory && (
                <button
                  onClick={() => handleCategoryChange(null)}
                  className="text-primary hover:underline"
                >
                  View all posts
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Featured Post Hero */}
        {!isLoading && featuredPost && (
          <motion.article
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <Link 
              to={`/blog/${featuredPost.slug.current}`}
              className="group block glass-card rounded-2xl overflow-hidden"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Image */}
                <div className="relative aspect-[16/9] lg:aspect-auto lg:min-h-[400px] overflow-hidden">
                  {(() => {
                    const imageUrl = getPostImage(featuredPost, 'large');
                    return imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={featuredPost.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-black flex items-center justify-center">
                        <span className="text-6xl">🎵</span>
                      </div>
                    );
                  })()}
                  <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                  
                  {/* Featured Badge */}
                  <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-xs font-semibold shadow-lg">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Featured
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                  {/* Categories */}
                  {featuredPost.categories && featuredPost.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {featuredPost.categories.map((cat) => (
                        <span
                          key={cat.slug.current}
                          className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full"
                        >
                          {cat.title}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Title */}
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 group-hover:text-primary transition-colors leading-tight">
                    {featuredPost.title}
                  </h2>

                  {/* Excerpt */}
                  {featuredPost.excerpt && (
                    <p className="text-muted-foreground text-base sm:text-lg mb-6 line-clamp-3">
                      {featuredPost.excerpt}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                    {featuredPost.author && (
                      <div className="flex items-center gap-2">
                        {featuredPost.author.image ? (
                          <img
                            src={urlFor(featuredPost.author.image).width(40).height(40).url()}
                            alt={featuredPost.author.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                        <span className="font-medium text-foreground">{featuredPost.author.name}</span>
                      </div>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {formatDate(featuredPost.publishedAt)}
                    </span>
                    {featuredPost.readingTime && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {featuredPost.readingTime} min read
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  <div>
                    <span className="inline-flex items-center gap-2 text-primary font-semibold group-hover:gap-3 transition-all">
                      Read Article
                      <ChevronRight className="w-5 h-5" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </motion.article>
        )}

        {/* Section Header for Regular Posts */}
        {!isLoading && regularPosts.length > 0 && !selectedCategory && (
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-xl font-bold">Latest Articles</h2>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {/* Posts Grid */}
        {!isLoading && regularPosts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularPosts.map((post, index) => (
              <motion.article
                key={post._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ y: -4 }}
                className="glass-card rounded-xl overflow-hidden group"
              >
                <Link to={`/blog/${post.slug.current}`}>
                  {/* Image */}
                  <div className="aspect-[16/9] overflow-hidden relative">
                    {(() => {
                      const imageUrl = getPostImage(post);
                      return imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-black flex items-center justify-center">
                          <span className="text-4xl">🎵</span>
                        </div>
                      );
                    })()}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    
                    {/* Categories */}
                    {post.categories && post.categories.length > 0 && (
                      <div className="absolute bottom-3 left-3 flex gap-2">
                        {post.categories.slice(0, 2).map((cat) => (
                          <span
                            key={cat.slug.current}
                            className="px-2 py-1 text-xs font-medium bg-white/20 backdrop-blur-sm rounded-full text-white"
                          >
                            {cat.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    {/* Meta */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
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
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>

                    {/* Excerpt */}
                    {post.excerpt && (
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                        {post.excerpt}
                      </p>
                    )}

                    {/* Author & Read More */}
                    <div className="flex items-center justify-between">
                      {post.author && (
                        <div className="flex items-center gap-2">
                          {post.author.image ? (
                            <img
                              src={urlFor(post.author.image).width(32).height(32).url()}
                              alt={post.author.name}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                              <User className="w-3 h-3" />
                            </div>
                          )}
                          <span className="text-sm text-muted-foreground">
                            {post.author.name}
                          </span>
                        </div>
                      )}
                      <span className="text-sm font-medium text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                        Read more
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        )}

        {/* Newsletter CTA */}
        {!isLoading && posts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 p-8 sm:p-10 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl border border-primary/20 text-center"
          >
            <h3 className="text-2xl sm:text-3xl font-bold mb-3">Never Miss a Beat</h3>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Get the latest concert news, setlist predictions, and exclusive content delivered straight to your inbox.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input 
                type="email" 
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap">
                Subscribe
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
