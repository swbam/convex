import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, ChevronRight, User } from 'lucide-react';
import { getAllPosts, getAllCategories, urlFor, type BlogPost, type Category } from '../lib/sanity';
import { AppLayout } from '../components/AppLayout';
import { SEOHead } from '../components/SEOHead';

export function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <AppLayout>
      <SEOHead
        title="Blog | setlists.live"
        description="Concert news, setlist predictions, artist spotlights, and music industry insights from the setlists.live team."
        canonicalUrl="/blog"
      />

      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 gradient-text">
            The Setlist Blog
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Concert news, setlist predictions, artist spotlights, and music industry insights
          </p>
        </div>

        {/* Category Filter */}
        {categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !selectedCategory
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80 text-foreground'
              }`}
            >
              All Posts
            </button>
            {categories.map((category) => (
              <button
                key={category._id}
                onClick={() => setSelectedCategory(category.slug.current)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === category.slug.current
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80 text-foreground'
                }`}
              >
                {category.title}
              </button>
            ))}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass-card rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-[16/9] bg-muted" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-muted rounded w-1/4" />
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredPosts.length === 0 && (
          <div className="text-center py-16">
            <div className="glass-card inline-block p-8 rounded-2xl">
              <p className="text-xl text-muted-foreground mb-4">
                {posts.length === 0
                  ? 'No blog posts yet. Check back soon!'
                  : 'No posts in this category yet.'}
              </p>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-primary hover:underline"
                >
                  View all posts
                </button>
              )}
            </div>
          </div>
        )}

        {/* Posts Grid */}
        {!isLoading && filteredPosts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post, index) => (
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
                    {post.mainImage?.asset ? (
                      <img
                        src={urlFor(post.mainImage).width(600).height(338).url()}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center">
                        <span className="text-4xl">🎵</span>
                      </div>
                    )}
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
                            <User className="w-6 h-6 p-1 rounded-full bg-secondary" />
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
      </div>
    </AppLayout>
  );
}

