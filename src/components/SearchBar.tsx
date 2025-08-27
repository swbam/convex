import React, { useState, useEffect } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'

type SearchType = 'all' | 'artists' | 'shows' | 'venues'
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
  placeholder = "Search artists, shows, venues...", 
  className = "" 
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('all')
  const [sortBy, setSortBy] = useState<SortBy>('relevance')
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
  const [isSearching, setIsSearching] = useState(false)
  
  // Ticketmaster search action
  const searchTicketmasterArtists = useAction(api.ticketmaster.searchArtists)
  
  // Local artist search as fallback
  const localArtistResults = useQuery(
    api.artists.search,
    debouncedQuery.length >= 2 && (searchType === 'all' || searchType === 'artists')
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

      if (searchType !== 'all' && searchType !== 'artists') {
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

  const handleResultClick = (result: SearchResult) => {
    onResultClick(result.type, result.id as any, result.slug)
    setIsOpen(false)
    setQuery('')
  }

  const clearSearch = () => {
    setQuery('')
    setIsOpen(false)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'artist':
        return '🎵'
      case 'show':
        return '📅'
      case 'venue':
        return '📍'
      default:
        return '🔍'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'artist':
        return 'text-green-400'
      case 'show':
        return 'text-blue-400'
      case 'venue':
        return 'text-purple-400'
      default:
        return 'text-zinc-400'
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400">🔍</span>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-20 h-10 w-full rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-white placeholder:text-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500/20 focus:outline-none"
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
          
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="h-6 w-6 p-0 text-zinc-400 hover:text-white bg-transparent border-none cursor-pointer"
            >
              ⚙️
            </button>
            
            {showFilters && (
              <div className="absolute right-0 top-8 z-50 min-w-[8rem] rounded-md border border-zinc-700 bg-zinc-900 p-1 shadow-lg">
                <div className="px-2 py-1.5 text-sm font-semibold text-zinc-300">Search Type</div>
                <button 
                  onClick={() => { setSearchType('all'); setShowFilters(false); }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-zinc-800 border-none bg-transparent cursor-pointer ${searchType === 'all' ? 'bg-zinc-800' : ''}`}
                >
                  All Results
                </button>
                <button 
                  onClick={() => { setSearchType('artists'); setShowFilters(false); }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-zinc-800 border-none bg-transparent cursor-pointer ${searchType === 'artists' ? 'bg-zinc-800' : ''}`}
                >
                  Artists Only
                </button>
                <button 
                  onClick={() => { setSearchType('shows'); setShowFilters(false); }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-zinc-800 border-none bg-transparent cursor-pointer ${searchType === 'shows' ? 'bg-zinc-800' : ''}`}
                >
                  Shows Only
                </button>
                <div className="-mx-1 my-1 h-px bg-zinc-700"></div>
                <div className="px-2 py-1.5 text-sm font-semibold text-zinc-300">Sort By</div>
                <button 
                  onClick={() => { setSortBy('relevance'); setShowFilters(false); }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-zinc-800 border-none bg-transparent cursor-pointer ${sortBy === 'relevance' ? 'bg-zinc-800' : ''}`}
                >
                  Relevance
                </button>
                <button 
                  onClick={() => { setSortBy('popularity'); setShowFilters(false); }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-zinc-800 border-none bg-transparent cursor-pointer ${sortBy === 'popularity' ? 'bg-zinc-800' : ''}`}
                >
                  Popularity
                </button>
                <button 
                  onClick={() => { setSortBy('alphabetical'); setShowFilters(false); }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-zinc-800 border-none bg-transparent cursor-pointer ${sortBy === 'alphabetical' ? 'bg-zinc-800' : ''}`}
                >
                  Alphabetical
                </button>
                <button 
                  onClick={() => { setSortBy('recent'); setShowFilters(false); }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-zinc-800 border-none bg-transparent cursor-pointer ${sortBy === 'recent' ? 'bg-zinc-800' : ''}`}
                >
                  Most Recent
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && debouncedQuery.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 shadow-xl rounded-xl">
          <div className="p-0">
            <div className="max-h-96 overflow-y-auto">
              {sortedResults.length > 0 ? (
                <div className="p-2">
                  {/* Active Filters */}
                  {(searchType !== 'all' || sortBy !== 'relevance') && (
                    <div className="flex items-center gap-2 mb-3 px-2">
                      <span className="text-xs text-zinc-400">Filters:</span>
                      {searchType !== 'all' && (
                        <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                          {searchType}
                        </span>
                      )}
                      {sortBy !== 'relevance' && (
                        <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                          {sortBy}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Results */}
                  <div className="space-y-1">
                    {sortedResults.map((result, index) => (
                      <div key={`${result.type}-${result.id}-${index}`}>
                        <button
                          onClick={() => handleResultClick(result)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors text-left border-none bg-transparent cursor-pointer"
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
                              <span className={`text-sm ${getTypeColor(result.type)}`}>
                                {getTypeIcon(result.type)}
                              </span>
                              <span className="font-medium text-white truncate">
                                {result.title}
                              </span>
                            </div>
                            {result.subtitle && (
                              <p className="text-sm text-zinc-400 truncate">
                                {result.subtitle}
                              </p>
                            )}
                            {result.metadata && (
                              <p className="text-xs text-zinc-500 truncate">
                                {result.metadata}
                              </p>
                            )}
                          </div>
                        </button>
                        {index < sortedResults.length - 1 && (
                          <div className="bg-zinc-800 my-3 h-px"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-zinc-400 text-sm">
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
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Backdrop to close filters */}
      {showFilters && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowFilters(false)}
        />
      )}
    </div>
  )
}