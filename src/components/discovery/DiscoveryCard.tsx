import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { formatCompactNumber } from '../../lib/format';
import { formatLocation, parseShowCalendarDate } from '../../lib/utils';

type CardProps = { title: string; image?: string; description?: string; detail?: string; rank?: number; onClick: () => void; busy?: boolean; tile?: boolean };

export function DiscoveryCard({ title, image, description, detail, rank, onClick, busy, tile }: CardProps) {
  const reduceMotion = useReducedMotion();
  const [failedImage, setFailedImage] = useState<string>();
  return <motion.button type="button" onClick={onClick} disabled={busy} aria-busy={busy || undefined} className={`discovery-card ${tile ? 'discovery-card-tile' : ''}`} whileTap={reduceMotion ? undefined : { scale: 0.99 }} transition={{ duration: 0.12 }}>
    <span className="discovery-artwork">
      {image && image !== failedImage ? <img src={image} alt="" loading="lazy" decoding="async" onError={() => setFailedImage(image)} /> : <span className="flex h-full items-center justify-center text-xl font-semibold text-muted-foreground">{title.slice(0, 2).toUpperCase()}</span>}
      {rank && <span className="discovery-rank" aria-label={`Rank ${rank}`}>{rank}</span>}
    </span>
    <span className="discovery-copy">
      {detail && <span className="mb-1 block text-xs text-muted-foreground">{detail}</span>}
      <span className="block truncate text-base font-semibold leading-snug sm:text-sm">{title}</span>
      {description && <span className="mt-1 block truncate text-xs text-muted-foreground">{description}</span>}
    </span>
    {busy && <span className="absolute inset-0 flex items-center justify-center bg-background/80"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-label="Loading" /></span>}
  </motion.button>;
}

type EntityCardProps = { onClick: () => void; isImporting?: boolean; rank?: number; tile?: boolean };
export function ArtistDiscoveryCard({ artist, ...props }: EntityCardProps & { artist: any }) {
  const shows = artist.upcomingShowsCount ?? artist.upcomingEvents ?? 0;
  const description = [shows > 0 ? `${shows} ${shows === 1 ? 'show' : 'shows'}` : '', artist.followers > 0 ? `${formatCompactNumber(artist.followers)} fans` : artist.genres?.[0]].filter(Boolean).join(' · ');
  return <DiscoveryCard title={artist.name || 'Artist'} image={artist.images?.[0] || artist.image} description={description} {...props} busy={props.isImporting} />;
}
export function ShowDiscoveryCard({ show, ...props }: EntityCardProps & { show: any }) {
  const date = parseShowCalendarDate(show.date);
  const detail = Number.isNaN(date.getTime()) ? 'Date TBA' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const venue = show.venue?.name || show.venueName;
  const location = formatLocation(show.venue?.city || show.venueCity, show.venue?.state || show.venueState);
  return <DiscoveryCard title={show.artist?.name || show.artistName || 'Artist'} image={show.artist?.images?.[0] || show.artistImage || show.cachedTrending?.artistImage} detail={detail} description={[venue, location].filter(Boolean).join(' · ')} {...props} busy={props.isImporting} />;
}

export function DiscoverySkeleton({ count = 12 }: { count?: number }) {
  return <div role="status" aria-label="Loading results" className="col-span-full grid grid-cols-1 gap-0 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">{Array.from({ length: count }, (_, i) => <div key={i} className="discovery-card animate-pulse motion-reduce:animate-none"><span className="discovery-artwork" /><span className="discovery-copy"><span className="block h-4 w-3/4 bg-secondary" /><span className="mt-2 block h-3 w-1/2 bg-secondary" /></span></div>)}</div>;
}
