import { matchesSearch, searchRank } from "../../shared/searchRelevance";
import React, { useState, useEffect, useRef, useId } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { toast } from 'sonner'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Music2, Search as SearchIcon, X, Loader2 } from 'lucide-react'
import { capture, captureException } from '../lib/analytics'
import { parseShowCalendarDate } from '../lib/utils'

type SearchType = 'all' | 'artists' | 'songs'
interface SearchResult {
  type: 'artist' | 'show' | 'venue'
  source: 'convex' | 'ticketmaster'
  id: string
  title: string
  subtitle?: string
  image?: string
  metadata?: string
  slug?: string
  upcomingEvents?: number
  providerId?: string
}
interface SearchBarProps {
  onResultClick: (type: 'artist' | 'show' | 'venue', id: Id<'artists'> | Id<'shows'> | Id<'venues'>, slug?: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function SearchBar({ onResultClick, placeholder = 'Search artists or songs…', className = '', autoFocus = false }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('all')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [remote, setRemote] = useState<{ query: string; results: SearchResult[]; loading: boolean }>({ query: '', results: [], loading: false })
  const searchRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const shouldReduceMotion = useReducedMotion()
  const searchTicketmasterArtists = useAction(api.ticketmaster.searchArtists)
  const triggerFullArtistSync = useAction(api.ticketmaster.triggerFullArtistSync)
  const includeArtists = searchType !== 'songs'
  const includeSongs = searchType !== 'artists'
  const validQuery = debouncedQuery.length >= 2

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 200)
    setActiveIndex(-1)
    return () => window.clearTimeout(timer)
  }, [query])
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [])

  const localArtists = useQuery(api.artists.search, validQuery && includeArtists ? { query: debouncedQuery, limit: 5 } : 'skip')
  const songMatches = useQuery(api.songSearch.search, validQuery && includeSongs ? { query: debouncedQuery, limit: 10 } : 'skip')

  useEffect(() => {
    if (!validQuery || !includeArtists || localArtists === undefined) return
    if (localArtists.some(artist => searchRank(artist.name, debouncedQuery) <= 1)) {
      setRemote({ query: debouncedQuery, results: [], loading: false }); return
    }
    let cancelled = false
    setRemote({ query: debouncedQuery, results: [], loading: true })
    void searchTicketmasterArtists({ query: debouncedQuery, limit: 8 }).then(artists => {
      if (cancelled) return
      setRemote({ query: debouncedQuery, loading: false, results: artists.filter((artist: any) => matchesSearch(artist.name, debouncedQuery)).map((artist: any) => ({
        type: 'artist', source: 'ticketmaster', id: artist.ticketmasterId, providerId: artist.ticketmasterId, title: artist.name,
        subtitle: (artist.genres?.slice(0, 2) || []).join(', '), image: artist.images?.[0],
        metadata: artist.upcomingEvents ? `${artist.upcomingEvents} upcoming shows` : undefined,
        upcomingEvents: artist.upcomingEvents || 0,
      })) })
    }).catch(() => {
      if (!cancelled) setRemote({ query: debouncedQuery, results: [], loading: false })
    })
    return () => { cancelled = true }
  }, [debouncedQuery, validQuery, includeArtists, searchTicketmasterArtists, localArtists])

  const currentQuery = query.trim() === debouncedQuery
  const artistResults: SearchResult[] = []
  const identities = new Set<string>()
  if (includeArtists && currentQuery) {
    const local: SearchResult[] = (localArtists ?? []).map(artist => ({ type: 'artist', source: 'convex', id: artist._id,
      title: artist.name, providerId: artist.ticketmasterId, subtitle: artist.genres?.slice(0, 2).join(', '), image: artist.images?.[0], slug: artist.slug }))
    for (const result of [...local, ...(remote.query === debouncedQuery ? remote.results : [])]) {
      const key = result.providerId ? `ticketmaster:${result.providerId}` : `${result.source}:${result.id}`
      if (identities.has(key)) continue
      identities.add(key)
      artistResults.push(result)
    }
  }
  const songResults: SearchResult[] = includeSongs && currentQuery ? (songMatches?.results ?? []).map(result => ({
    type: 'show', source: 'convex', id: result.showId, slug: result.slug, title: result.songTitle,
    subtitle: `${result.artistName} · ${result.venueName}`,
    metadata: `${parseShowCalendarDate(result.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${result.city}`,
    image: result.image,
  })) : []
  artistResults.sort((a, b) => searchRank(a.title, debouncedQuery) - searchRank(b.title, debouncedQuery))
  const results = [...artistResults, ...songResults]
  const isSearching = !currentQuery || (includeSongs && songMatches === undefined) ||
    (includeArtists && (localArtists === undefined || remote.query !== debouncedQuery || remote.loading))
  const showResults = isOpen && query.trim().length >= 2

  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, listId])

  useEffect(() => {
    if (!validQuery || isSearching) return
    const timer = window.setTimeout(() => capture('search_performed', {
      context: 'global_search', search_type: searchType, query_length: debouncedQuery.length,
      result_count: results.length, has_results: results.length > 0,
    }), 500)
    return () => window.clearTimeout(timer)
  }, [debouncedQuery, validQuery, isSearching, searchType, results.length])

  const handleResultClick = async (result: SearchResult) => {
    if (openingId) return
    capture('search_result_selected', {
      context: 'global_search', search_type: searchType, query_length: debouncedQuery.length,
      result_count: results.length, result_position: results.indexOf(result) + 1,
      result_type: result.type, result_id: result.id, result_source: result.source,
    })
    setOpeningId(result.id)
    try {
      if (result.type === 'artist' && result.source === 'ticketmaster') {
        const sync = await triggerFullArtistSync({ ticketmasterId: result.id, artistName: result.title,
          genres: result.subtitle?.split(', ').filter(Boolean), images: result.image ? [result.image] : undefined,
          upcomingEvents: result.upcomingEvents })
        if (sync.type === 'festival' && sync.festivalId) onResultClick('festival' as any, sync.festivalId, sync.slug)
        else if (sync.type === 'artist' && sync.artistId) onResultClick('artist', sync.artistId, sync.slug)
      } else onResultClick(result.type, result.id as any, result.slug)
      setIsOpen(false)
      setQuery('')
    } catch (error) {
      captureException(error, { operation: 'search_result_import', result_type: result.type, result_id: result.id })
      toast.error(error instanceof Error ? error.message : 'Unable to open this result')
    } finally { setOpeningId(null) }
  }

  return (
    <div ref={searchRef} className={`relative ${className} z-[100]`}>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input type="search" autoFocus={autoFocus} aria-label={placeholder} placeholder={placeholder}
          role="combobox" aria-autocomplete="list" aria-expanded={showResults} aria-controls={showResults ? listId : undefined}
          aria-activedescendant={showResults && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          value={query} onChange={event => { setQuery(event.target.value); setIsOpen(true) }} onFocus={() => setIsOpen(true)}
          onKeyDown={event => {
            if (event.key === 'Escape') { setIsOpen(false); setActiveIndex(-1) }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setIsOpen(true)
              setActiveIndex(index => Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
            }
            if (event.key === 'Enter' && showResults && results[Math.max(0, activeIndex)]) { event.preventDefault(); void handleResultClick(results[Math.max(0, activeIndex)]) }
          }}
          className="h-11 w-full rounded-[5px] border border-input bg-card py-2 pl-10 pr-11 text-base sm:text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background sm:h-10 [&::-webkit-search-cancel-button]:hidden" />
        {query && <button type="button" onClick={() => { setQuery(''); setIsOpen(false) }} aria-label="Clear search"
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground sm:h-10"><X className="h-4 w-4" /></button>}
      </div>
      <AnimatePresence initial={false}>
        {showResults && <motion.div
          className="absolute left-0 right-0 top-full z-[9999] mt-2 overflow-hidden rounded-[5px] border border-border bg-popover shadow-xl"
          initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <div className="flex gap-1 border-b border-border p-1.5" aria-label="Search categories">
            {(['all', 'artists', 'songs'] as const).map(type => <button key={type} type="button" aria-pressed={searchType === type}
              className={`min-h-10 px-3 rounded-lg text-sm capitalize ${searchType === type ? 'bg-accent text-foreground' : 'text-muted-foreground'}`}
              onClick={() => { setSearchType(type); setActiveIndex(-1) }}>{type}</button>)}
          </div>
          <div id={listId} role="listbox" aria-label="Search results" className="max-h-[min(58dvh,30rem)] overflow-y-auto overscroll-contain p-1">
            {[{ label: 'Artists', rows: artistResults, offset: 0 }, { label: 'Songs · Most recently played', rows: songResults, offset: artistResults.length }].map(group => group.rows.length > 0 &&
              <div key={group.label} role="group" aria-label={group.label}>
                <p className="px-2 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground">{group.label}</p>
                {group.rows.map((result, index) => {
                  const position = group.offset + index
                  return <button key={`${result.type}-${result.id}`} id={`${listId}-${position}`} type="button" role="option" aria-selected={activeIndex === position}
                    disabled={openingId !== null} onMouseEnter={() => setActiveIndex(position)} onClick={() => { void handleResultClick(result) }}
                    className={`flex min-h-16 w-full items-center gap-3 rounded-lg p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeIndex === position ? 'bg-accent' : 'hover:bg-accent/60'}`}>
                    {openingId === result.id ? <Loader2 className="h-10 w-10 shrink-0 animate-spin p-2" /> : result.image
                      ? <img src={result.image} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" loading="lazy" />
                      : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary"><Music2 className="h-5 w-5 text-muted-foreground" /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{result.title}</span>
                      {result.subtitle && <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span>}
                      {result.metadata && <span className="block truncate text-xs text-muted-foreground mt-0.5">{result.metadata}</span>}
                    </span>
                  </button>
                })}
              </div>)}
          </div>
          <div role="status" className="text-xs text-muted-foreground">
            {isSearching && <p className="p-3">Searching…</p>}
            {!isSearching && results.length === 0 && <p className="p-4 text-center">{searchType === 'songs' ? 'No recorded performances found for this song.' : `No results for “${debouncedQuery}”`}</p>}
            {includeSongs && songMatches?.refineQuery && <p className="p-3">Many song titles match. Enter the full title for more precise results.</p>}
          </div>
        </motion.div>}
      </AnimatePresence>
    </div>
  )
}
