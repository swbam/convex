import { useEffect, useState } from 'react';
import { usePaginatedQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Search, Music, Loader2 } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { DiscoveryCard, DiscoverySkeleton } from './discovery/DiscoveryCard';
import { Button } from './ui/button';
import { parseShowCalendarDate } from '../lib/utils';

interface ArtistsProps {
  onArtistClick: (artistId: Id<'artists'> | string, slug?: string) => void;
}

export function Artists({ onArtistClick }: ArtistsProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [upcomingOnly, setUpcomingOnly] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { results, status, loadMore } = usePaginatedQuery(api.artistDirectory.browse,
    { search: debouncedSearch, upcomingOnly }, { initialNumItems: 24 });
  const waitingForSearch = search.trim() !== debouncedSearch;
  const loading = status === 'LoadingFirstPage' || waitingForSearch;
  // Some alphabetic pages contain only artists without a current show. Continue
  // their bounded scan until there is a result or the catalog is exhausted.
  useEffect(() => {
    if (!waitingForSearch && results.length === 0 && status === 'CanLoadMore') loadMore(24);
  }, [results.length, status, loadMore, waitingForSearch]);
  const searchingEmptyPages = results.length === 0 && status !== 'Exhausted';

  return <div className="public-page space-y-6">
    <PageHeader title="Artists" description="Find touring artists, explore their shows, and request your favorite songs." />
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div role="group" aria-label="Artist availability" className="flex gap-2">
        <Button variant={upcomingOnly ? 'default' : 'outline'} aria-pressed={upcomingOnly} onClick={() => setUpcomingOnly(true)}>Upcoming shows</Button>
        <Button variant={!upcomingOnly ? 'default' : 'outline'} aria-pressed={!upcomingOnly} onClick={() => setUpcomingOnly(false)}>All artists</Button>
      </div>
      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input type="search" aria-label="Search artist catalog" placeholder="Search artists by name…" value={search} onChange={event => setSearch(event.target.value)} className="filter-input w-full pl-10 pr-16" />
        {search && <button type="button" onClick={() => { setSearch(''); setDebouncedSearch(''); }} className="absolute right-1 top-0 min-h-11 px-3 text-xs text-muted-foreground">Clear</button>}
      </div>
    </div>
    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
      <span>{loading || searchingEmptyPages ? 'Finding artists…' : `${results.length} ${results.length === 1 ? 'artist' : 'artists'}${status !== 'Exhausted' ? ' loaded' : ''}`}</span>
      <span>{debouncedSearch ? 'Matching artist names' : 'A–Z · Full catalog'}</span>
    </div>
    {loading || searchingEmptyPages ? <DiscoverySkeleton count={12} /> : results.length === 0 ?
      <div className="py-12 text-center"><Music className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><h2 className="text-xl font-semibold">{upcomingOnly ? 'No upcoming shows found' : 'No artists found'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{upcomingOnly ? 'Search all artists to explore past setlists, or try another name.' : 'Try another name or use the main search to discover an artist.'}</p>
        {upcomingOnly && <Button variant="outline" className="mt-4" onClick={() => setUpcomingOnly(false)}>Search all artists</Button>}
      </div> : <>
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-busy={status === 'LoadingMore'}>
        {results.map(artist => <DiscoveryCard key={artist._id} title={artist.name} image={artist.images?.[0]}
          detail={artist.nextShowDate ? `Next show ${parseShowCalendarDate(artist.nextShowDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Explore past setlists'}
          description={artist.genres?.slice(0, 2).join(' · ')} onClick={() => onArtistClick(artist._id, artist.slug)} />)}
      </div>
      {status !== 'Exhausted' && <div className="flex justify-center pt-4"><Button variant="outline" onClick={() => loadMore(24)} disabled={status !== 'CanLoadMore'}>
        {status === 'LoadingMore' && <Loader2 className="h-4 w-4 animate-spin" />} {status === 'LoadingMore' ? 'Loading artists…' : 'Load more artists'}
      </Button></div>}
    </>}
  </div>;
}
