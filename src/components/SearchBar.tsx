import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { toast } from 'sonner'

type SortBy = 'relevance' | 'popularity' | 'recent' | 'alphabetical'

interface SearchResult {
  type: 'artist' | 'show' | 'venue'
  id: string
  title: string
  subtitle?: string
  image?: string
  metadata?: string
  slug?: string
}

interface SearchBarProps {
  onResultClick: (type: 'artist' | 'show' | 'venue', id: Id<'artists'> | Id<'shows'> | Id<'venues'>, slug?: string) => void
  placeholder?: string
  className?: string
}

export function SearchBar({ 
  onResultClick, 
  placeholder = "Search artists...", 
  className = "" 
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
  const [_isSearching, setIsSearching] = useState(false)
  
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
          subtitle: artist.genres?.slice(0, 2).join(', '),
          image: artist.images?.[0],
          metadata: artist.upcomingEvents ? `${artist.upcomingEvents} upcoming shows` : undefined,
          slug: undefined // Ticketmaster results don't have slugs
        }))
        
        setSearchResults(transformedResults)
      } catch (error) {
        console.error('Ticketmaster search failed:', error)
        // Fallback to local search
        if (localArtistResults) {
          const fallbackResults: SearchResult[] = localArtistResults.map(artist => ({
            type: 'artist' as const,
            id: artist._id,
            title: artist.name,
            subtitle: artist.genres?.slice(0, 2).join(', '),
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
    // If this is a Ticketmaster result (no slug), kick off sync but navigate immediately
    if (result.type === 'artist' && !result.slug) {
      const slug = result.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      // Navigate immediately with the ticketmaster ID as a temporary ID
      onResultClick(result.type, result.id as any, slug);
      setIsOpen(false);
      setQuery('');
      
      // Then trigger sync in the background
      triggerFullArtistSync({
        ticketmasterId: result.id,
        artistName: result.title,
        genres: result.subtitle ? result.subtitle.split(', ').filter(Boolean) : undefined,
        images: result.image ? [result.image] : undefined,
      }).then(artistId => {
        console.log(`✅ Artist ${result.title} created with ID: ${artistId}`);
        // The artist page will handle loading the new data
      }).catch(error => {
        console.error('Failed to trigger artist sync:', error);
        toast.error('Failed to import artist data, but you can still browse');
      });
      
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

  const getTypeIcon = () => '🎵'

  const getTypeColor = (_type: 'artist' = 'artist') => 'text-muted-foreground'

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <span className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-responsive-sm">🔍</span>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-8 sm:pl-10 pr-8 sm:pr-12 h-9 sm:h-10 w-full rounded-lg sm:rounded-xl border border-border bg-background/50 px-2.5 sm:px-3 py-2 text-responsive-sm placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-200 touch-target"
        />
        
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              onClick={clearSearch}
              className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-zinc-400 hover:text-white bg-transparent border-none cursor-pointer flex items-center justify-center touch-target"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
          {/* Filters temporarily removed for a cleaner desktop nav */}
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && debouncedQuery.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 sm:mt-2 z-[9999] bg-background/95 backdrop-blur-xl border border-border shadow-2xl rounded-lg sm:rounded-xl max-h-[60vh] sm:max-h-[70vh] lg:max-h-96">
          <div className="p-0">
            <div className="max-h-96 overflow-y-auto">
              {sortedResults.length > 0 ? (
                <div className="p-1.5 sm:p-2">
                  {/* Active Filters */}
                  {sortBy !== 'relevance' && (
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 px-1.5 sm:px-2">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">Sort:</span>
                      <span className="text-[10px] sm:text-xs bg-accent text-foreground px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg">
                        {sortBy}
                      </span>
                    </div>
                  )}
                  
                  {/* Results */}
                  <div className="space-y-0.5 sm:space-y-1">
                    {sortedResults.map((result, index) => (
                      <div key={`${result.type}-${result.id}-${index}`}>
                        <button
                          onClick={() => { void handleResultClick(result) }}
                          className="w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-md sm:rounded-lg hover:bg-accent/50 active:bg-accent/60 transition-all duration-200 text-left border-none bg-transparent cursor-pointer group touch-manipulation"
                        >
                          {result.image && (
                            <img
                              src={result.image}
                              alt={result.title}
                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-md sm:rounded-lg object-cover flex-shrink-0"
                              loading="lazy"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                              <span className={`text-responsive-xs sm:text-responsive-sm ${getTypeColor('artist')}`}>
                                {getTypeIcon()}
                              </span>
                              <span className="font-medium text-foreground text-responsive-sm truncate">
                                {result.title}
                              </span>
                            </div>
                            {result.subtitle && (
                              <p className="text-responsive-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                                {result.subtitle}
                              </p>
                            )}
                            {result.metadata && (
                              <p className="text-[10px] sm:text-xs text-muted-foreground/70 truncate">
                                {result.metadata}
                              </p>
                            )}
                          </div>
                        </button>
                        {index < sortedResults.length - 1 && (
                          <div className="bg-border my-1.5 sm:my-2 h-px opacity-50"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 sm:p-4 text-center text-muted-foreground text-responsive-xs sm:text-responsive-sm">
                  No results found for "{debouncedQuery}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Backdrop to close search */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9998]" 
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Backdrop to close filters */}
      {showFilters && (
        <div 
          className="fixed inset-0 z-[9998]" 
          onClick={() => setShowFilters(false)}
        />
      )}
    </div>
  )
}