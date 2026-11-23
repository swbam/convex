import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { getAllPosts, getAllCategories, type BlogPost, type Category } from '../lib/sanity';
import { AppLayout } from '../components/AppLayout';
import { PageHeader } from '../components/PageHeader';
import { BlogCard } from '../components/BlogCard';
import { Button } from '../components/ui/button';

export function BlogPage() {
  const [params, setParams] = useSearchParams();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const reduceMotion = useReducedMotion();
  const category = params.get('category');
  useEffect(() => {
    let active = true;
    Promise.all([getAllPosts(), getAllCategories()]).then(([items, groups]) => {
      if (active) { setPosts(items); setCategories(groups); }
    }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const filtered = category ? posts.filter(post => post.categories?.some(group => group.slug.current === category)) : posts;
  const featured = !category ? filtered[0] : undefined;
  const remaining = featured ? filtered.slice(1) : filtered;
  function selectCategory(value: string | null) {
    setParams(previous => { const next = new URLSearchParams(previous); if (value) next.set('category', value); else next.delete('category'); return next; });
  }
  return <AppLayout><div className="public-page space-y-6">
    <PageHeader title="The Setlist Blog" description="Concert guides, artist stories, and a closer look at the songs that make a show." />
    {categories.length > 0 && <div role="group" aria-label="Article categories" className="flex flex-wrap gap-2">
      {[{ _id: 'all', title: 'All posts', slug: { current: '' } }, ...categories].map(group => <Button key={group._id} variant={(category || '') === group.slug.current ? 'default' : 'outline'} aria-pressed={(category || '') === group.slug.current} onClick={() => selectCategory(group.slug.current || null)}>{group.title}</Button>)}
    </div>}
    {loading ? <div role="status" aria-label="Loading articles" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2].map(i=><div key={i} className="content-card h-64 animate-pulse bg-secondary motion-reduce:animate-none" />)}</div> : failed ? <p role="alert" className="py-10 text-muted-foreground">Articles could not load. Please refresh to try again.</p> : filtered.length === 0 ? <div className="border-y border-border py-10"><p className="text-muted-foreground">{category ? 'No articles in this category yet.' : 'New concert guides are on the way.'}</p>{category && <Button variant="outline" className="mt-4" onClick={()=>selectCategory(null)}>View all posts</Button>}</div> : <>
      {featured && <BlogCard post={featured} featured />}
      {remaining.length > 0 && <section aria-label="Latest articles"><h2 className="mb-4 text-xl font-semibold">{category ? 'Articles' : 'Latest articles'}</h2><motion.div initial={reduceMotion ? false : 'hidden'} animate="show" variants={{hidden:{},show:{transition:{staggerChildren:0.04}}}} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {remaining.map(post => <motion.div key={post._id} variants={{hidden:{opacity:0},show:{opacity:1,transition:{duration:0.2}}}} className="min-w-0"><BlogCard post={post} /></motion.div>)}
      </motion.div></section>}
    </>}
  </div></AppLayout>;
}
