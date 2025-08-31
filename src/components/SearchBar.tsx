import React, { useState, useEffect } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'

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

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

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
    // If this is a Ticketmaster result (no slug), kick off full sync first
    if (result.type === 'artist' && !result.slug) {
      try {
        console.log(`🚀 Triggering full artist sync for: ${result.title}`);
        const artistId = await triggerFullArtistSync({
          ticketmasterId: result.id,
          artistName: result.title,
          genres: result.subtitle ? result.subtitle.split(', ').filter(Boolean) : undefined,
          images: result.image ? [result.image] : undefined,
        });
        
        // Navigate to the created artist using the returned ID
        const slug = result.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        onResultClick(result.type, artistId as any, slug as any);
        setIsOpen(false);
        setQuery('');
        return;
      } catch (error) {
        console.error('Failed to trigger artist sync:', error);
        // Still try to navigate even if sync fails
      }
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
    <div className={`relative ${className}`}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">🔍</span>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-16 sm:pr-20 h-10 w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-200"
        />
        
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              onClick={clearSearch}
              className="h-6 w-6 p-0 text-zinc-400 hover:text-white bg-transparent border-none cursor-pointer"
            >
              ✕
            </button>
          )}
          {/* Filters temporarily removed for a cleaner desktop nav */}
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && debouncedQuery.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-[9999] bg-black/95 backdrop-blur-xl border border-border shadow-2xl rounded-xl max-h-[70vh] sm:max-h-96">
          <div className="p-0">
            <div className="max-h-96 overflow-y-auto">
              {sortedResults.length > 0 ? (
                <div className="p-2">
                  {/* Active Filters */}
                  {sortBy !== 'relevance' && (
                    <div className="flex items-center gap-2 mb-3 px-2">
                      <span className="text-xs text-muted-foreground">Sort:</span>
                      <span className="text-xs bg-accent text-foreground px-2 py-1 rounded-lg">
                        {sortBy}
                      </span>
                    </div>
                  )}
                  
                  {/* Results */}
                  <div className="space-y-1">
                    {sortedResults.map((result, index) => (
                      <div key={`${result.type}-${result.id}-${index}`}>
                        <button
                          onClick={() => { void handleResultClick(result) }}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-all duration-200 text-left border-none bg-transparent cursor-pointer group"
                        >
                          {result.image && (
                            <img
                              src={result.image}
                              alt={result.title}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-sm ${getTypeColor('artist')}`}>
                                {getTypeIcon()}
                              </span>
                              <span className="font-medium text-white truncate">
                                {result.title}
                              </span>
                            </div>
                            {result.subtitle && (
                              <p className="text-sm text-muted-foreground truncate group-hover:text-foreground transition-colors">
                                {result.subtitle}
                              </p>
                            )}
                            {result.metadata && (
                              <p className="text-xs text-muted-foreground/70 truncate">
                                {result.metadata}
                              </p>
                            )}
                          </div>
                        </button>
                        {index < sortedResults.length - 1 && (
                          <div className="bg-border my-3 h-px"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground text-sm">
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