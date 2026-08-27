import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { toast } from 'sonner'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Music2, Search as SearchIcon, X } from 'lucide-react'
import { capture, captureException } from '../lib/analytics'

type SortBy = 'relevance' | 'popularity' | 'recent' | 'alphabetical'

interface SearchResult {
  type: 'artist' | 'show' | 'venue'
  id: string
  title: string
  subtitle?: string
  image?: string
  metadata?: string
  slug?: string
  upcomingEvents?: number // For auto-ranking massive artists
}

interface SearchBarProps {
  onResultClick: (type: 'artist' | 'show' | 'venue', id: Id<'artists'> | Id<'shows'> | Id<'venues'>, slug?: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function SearchBar({ 
  onResultClick, 
  placeholder = "Search artists...", 
  className = "",
  autoFocus = false,
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  // Global search limited to artists only per PRD
  const [sortBy, setSortBy] = useState<SortBy>('relevance')
  // Enforce artists-only per PRD
  const [searchType, setSearchType] = useState<'artists'>('artists')
  const [isOpen, setIsOpen] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()

  // Debounce search query with shorter delay for better UX
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
      // Open dropdown when there's a query
      if (query.length >= 2) {
        setIsOpen(true)
      }
    }, 200) // Reduced from 300ms for faster response

    return () => clearTimeout(timer)
  }, [query])

  // Handle click outside to close dropdown
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // State for Ticketmaster search results
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const lastTrackedQuery = useRef('')
  
  // Ticketmaster search action
  const searchTicketmasterArtists = useAction(api.ticketmaster.searchArtists)
  const triggerFullArtistSync = useAction(api.ticketmaster.triggerFullArtistSync)
  
  // Local artist search as fallback
  const localArtistResults = useQuery(
    api.artists.search,
    debouncedQuery.length >= 2
      ? { query: debouncedQuery, limit: 5 }
      : 'skip'
  )

  // Search effect for Ticketmaster API
  useEffect(() => {
    const searchArtists = async () => {
      if (debouncedQuery.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        // Search Ticketmaster API for artists
        const ticketmasterResults = await searchTicketmasterArtists({ 
          query: debouncedQuery, 
          limit: 10 
        })
        
        const transformedResults: SearchResult[] = ticketmasterResults.map((artist: any) => ({
          type: 'artist' as const,
          id: artist.ticketmasterId,
          title: artist.name,
          subtitle: (artist.genres?.slice(0, 2) || []).join(', '),
          image: artist.images?.[0],
          metadata: artist.upcomingEvents ? `${artist.upcomingEvents} upcoming shows` : undefined,
          slug: undefined, // Ticketmaster results don't have slugs
          upcomingEvents: artist.upcomingEvents || 0, // For auto-ranking
        }))
        
        setSearchResults(transformedResults)
      } catch {
        // Fallback to local search
        if (localArtistResults) {
          const fallbackResults: SearchResult[] = localArtistResults.map(artist => ({
            type: 'artist' as const,
            id: artist._id,
            title: artist.name,
            subtitle: (artist.genres?.slice(0, 2) || []).join(', '),
            image: artist.images?.[0],
            metadata: artist.followers ? `${artist.followers.toLocaleString()} followers` : undefined,
            slug: artist.slug
          }))
          setSearchResults(fallbackResults)
        } else {
          setSearchResults([])
        }
      } finally {
        setIsSearching(false)
      }
    }

    void searchArtists()
  }, [debouncedQuery, searchType, searchTicketmasterArtists, localArtistResults])

  useEffect(() => {
    if (isSearching || debouncedQuery.length < 2) return;
    const normalized = debouncedQuery.trim().toLowerCase();
    if (!normalized || lastTrackedQuery.current === normalized) return;
    const timer = window.setTimeout(() => {
      lastTrackedQuery.current = normalized;
      capture('search_performed', {
        context: 'global_search',
        search_type: searchType,
        query_length: normalized.length,
        result_count: searchResults.length,
        has_results: searchResults.length > 0,
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [debouncedQuery, isSearching, searchResults.length, searchType]);

  // Sort results
  const sortedResults = [...searchResults].sort((a, b) => {
    switch (sortBy) {
      case 'alphabetical':
        return a.title.localeCompare(b.title)
      case 'recent':
        if (a.type === 'show' && b.type === 'show') {
          return new Date(b.metadata || '').getTime() - new Date(a.metadata || '').getTime()
        }
        return 0
      default:
        return 0
    }
  })

  const handleResultClick = async (result: SearchResult) => {
    const resultPosition = sortedResults.findIndex((item) => item.id === result.id);
    capture('search_result_selected', {
      context: 'global_search',
      search_type: searchType,
      query_length: debouncedQuery.trim().length,
      result_count: sortedResults.length,
      result_position: resultPosition >= 0 ? resultPosition + 1 : undefined,
      result_type: result.type,
      result_id: result.id,
      result_source: result.slug ? 'convex' : 'ticketmaster',
    });
    // If this is a Ticketmaster result (no slug), kick off sync and navigate by ID
    if (result.type === 'artist' && !result.slug) {
      try {
        // Trigger the sync to create the artist/festival and get the real Convex ID
        // AUTO-OUTRANKING: Pass upcomingEvents for immediate trending score calculation
        const syncResult = await triggerFullArtistSync({
          ticketmasterId: result.id,
          artistName: result.title,
          genres: result.subtitle ? result.subtitle.split(', ').filter(Boolean) : undefined,
          images: result.image ? [result.image] : undefined,
          upcomingEvents: result.upcomingEvents, // For auto-ranking massive artists
        });

        // Navigate based on whether it's an artist or festival
        if (syncResult.type === 'festival' && syncResult.festivalId) {
          // Navigate to festival page
          onResultClick('festival' as any, syncResult.festivalId, syncResult.slug);
          toast.success(`Opening ${result.title} festival...`);
        } else if (syncResult.type === 'artist' && syncResult.artistId) {
          // Navigate using the canonical ID; the app will canonicalize to slug when available
          onResultClick(result.type, syncResult.artistId);
          toast.success(`Importing ${result.title} data...`);
        }
        
        setIsOpen(false);
        setQuery('');
      } catch (error) {
        captureException(error, {
          operation: 'search_result_import',
          result_type: result.type,
          result_id: result.id,
        });
        const message = error instanceof Error ? error.message : 'Failed to import data';
        toast.error(message);
      }

      return;
    } else {
      onResultClick(result.type, result.id as any, result.slug)
    }
    setIsOpen(false)
    setQuery('')
  }

  const clearSearch = () => {
    setQuery('')
    setIsOpen(false)
  }

  const showResults = isOpen && debouncedQuery.length >= 2

  return (
    <div ref={searchRef} className={`relative ${className} z-[100]`}>
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          autoFocus={autoFocus}
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="h-11 w-full rounded-xl border border-border/90 bg-background/65 py-2 pl-10 pr-11 text-sm text-foreground shadow-sm outline-none transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-muted-foreground focus:border-foreground/30 focus:bg-background focus:ring-2 focus:ring-ring/25 sm:h-10"
        />

        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
          {query && (
            <motion.button
              type="button"
              onClick={clearSearch}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.88 }}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </motion.button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showResults && (
          <motion.div
            className="absolute left-0 right-0 top-full z-[9999] mt-2 max-h-[min(65vh,32rem)] overflow-hidden rounded-2xl border border-border/90 bg-background/95 shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="max-h-[min(65vh,30rem)] overflow-y-auto overscroll-contain p-1.5 sm:p-2">
              {sortedResults.length > 0 ? (
                <div>
                  {sortBy !== 'relevance' && (
                    <div className="mb-2 flex items-center gap-2 px-2 pt-1">
                      <span className="text-[11px] text-muted-foreground">Sort:</span>
                      <span className="rounded-md bg-accent px-2 py-1 text-[11px] text-foreground">
                        {sortBy}
                      </span>
                    </div>
                  )}

                  <motion.div
                    className="space-y-0.5"
                    variants={{
                      hidden: { opacity: 1 },
                      show: {
                        opacity: 1,
                        transition: { staggerChildren: shouldReduceMotion ? 0 : 0.028 },
                      },
                    }}
                    initial="hidden"
                    animate="show"
                  >
                    {sortedResults.map((result, index) => (
                      <motion.div
                        key={`${result.type}-${result.id}-${index}`}
                        variants={{
                          hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 4 },
                          show: { opacity: 1, y: 0 },
                        }}
                      >
                        <motion.button
                          type="button"
                          onClick={() => { void handleResultClick(result) }}
                          className="group flex min-h-14 w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-accent/65 focus-visible:bg-accent/65 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-2.5"
                          whileHover={shouldReduceMotion ? undefined : { x: 2 }}
                          whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                        >
                          {result.image ? (
                            <img
                              src={result.image}
                              alt={result.title}
                              className="h-10 w-10 flex-shrink-0 rounded-[10px] object-cover sm:h-11 sm:w-11"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] border border-border bg-secondary/60 sm:h-11 sm:w-11">
                              <Music2 className="h-[18px] w-[18px] text-muted-foreground" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {result.title}
                            </span>
                            {result.subtitle && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground transition-colors group-hover:text-foreground/75">
                                {result.subtitle}
                              </p>
                            )}
                            {result.metadata && (
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                                {result.metadata}
                              </p>
                            )}
                          </div>
                        </motion.button>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              ) : (
                <div className="p-5 text-center text-sm text-muted-foreground">
                  No results found for "{debouncedQuery}"
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showFilters && (
        <button
          type="button"
          aria-label="Close search filters"
          className="fixed inset-0 z-[59] cursor-default"
          onClick={() => setShowFilters(false)}
        />
      )}
    </div>
  )
}
