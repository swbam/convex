import React, { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TrendingUp, Calendar, MapPin, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface PublicDashboardProps {
  onArtistClick: (artistId: Id<"artists">) => void;
  onShowClick: (showId: Id<"shows">) => void;
  onSignInRequired: () => void;
}

export function PublicDashboard({ onArtistClick, onSignInRequired }: PublicDashboardProps) {
  // State for Ticketmaster trending data
  const [trendingShows, setTrendingShows] = useState<any[]>([]);
  const [trendingArtists, setTrendingArtists] = useState<any[]>([]);
  const [isLoadingShows, setIsLoadingShows] = useState(false);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);

  const triggerFullSync = useAction(api.ticketmaster.triggerFullArtistSync);

  // Load trending data from database (updated by cron jobs every 3 hours)
  const dbTrendingShows = useQuery(api.trending.getTrendingShows, { limit: 20 });
  const dbTrendingArtists = useQuery(api.trending.getTrendingArtists, { limit: 20 });

  useEffect(() => {
    if (dbTrendingShows) {
      setTrendingShows(dbTrendingShows);
      setIsLoadingShows(false);
    }
    if (dbTrendingArtists) {
      setTrendingArtists(dbTrendingArtists);
      setIsLoadingArtists(false);
    }
  }, [dbTrendingShows, dbTrendingArtists]);

  const handleArtistClick = async (ticketmasterId: string, artistName: string, genres?: string[], images?: string[]) => {
    try {
      // Trigger full sync to create artist in DB
      const artistId = await triggerFullSync({
        ticketmasterId,
        artistName,
        genres,
        images,
      });
      
      // Navigate to artist page
      onArtistClick(artistId);
    } catch (error) {
      console.error("Failed to sync artist:", error);
      toast.error("Failed to load artist");
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 space-y-10">
      {/* Hero Section - Refined */}
      <div className="text-center py-12">
        <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-4 leading-tight">
          Live Music Discovery
        </h1>
        <p className="text-lg text-muted-foreground mb-3 max-w-xl mx-auto">
          Trending artists and shows from Ticketmaster. Request songs you want to hear and upvote fan favorites.
        </p>
        <p className="text-sm text-muted-foreground/60">
          Updated live every 3 hours from Ticketmaster API
        </p>
      </div>

      {/* Horizontal Scrolling Sections */}
      <div className="space-y-16">
        {/* Trending Shows - Scrolling Left */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
              <Calendar className="h-4 w-4 text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Trending Shows</h2>
              <p className="text-muted-foreground text-sm">Popular concerts happening now</p>
            </div>
            <div className="pulse-dot ml-2"></div>
          </div>
          
          <HorizontalScrollingSection
            direction="left"
            isLoading={isLoadingShows}
            emptyTitle="Loading trending shows..."
            emptySubtitle="Fetching live data from Ticketmaster"
          >
            {trendingShows.map((show, index) => (
              <PremiumShowCard
                key={`${show.ticketmasterId}-${index}`}
                show={show}
                rank={index + 1}
                onArtistClick={(artistTicketmasterId: string, artistName: string, genres?: string[], images?: string[]) => {
                  void handleArtistClick(artistTicketmasterId, artistName, genres, images);
                }}
                onTicketClick={(url) => window.open(url, '_blank')}
              />
            ))}
          </HorizontalScrollingSection>
        </div>

        {/* Trending Artists - Scrolling Right */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Trending Artists</h2>
              <p className="text-muted-foreground text-sm">Hot artists with upcoming tours</p>
            </div>
            <div className="pulse-dot ml-2"></div>
          </div>
          
          <HorizontalScrollingSection
            direction="right"
            isLoading={isLoadingArtists}
            emptyTitle="Loading trending artists..."
            emptySubtitle="Fetching live data from Ticketmaster"
          >
            {trendingArtists.map((artist, index) => (
              <PremiumArtistCard
                key={`${artist.ticketmasterId}-${index}`}
                artist={artist}
                rank={index + 1}
                onClick={() => {
                  void handleArtistClick(artist.ticketmasterId, artist.name, artist.genres, artist.images);
                }}
              />
            ))}
          </HorizontalScrollingSection>
        </div>
      </div>

      {/* Call to Action - Refined */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-950 to-black border border-zinc-800 p-8 text-center">
        <div className="relative z-10">
          <h3 className="text-2xl font-bold mb-4">Join the Voting</h3>
          <p className="text-base text-muted-foreground mb-6 max-w-lg mx-auto">
            Request songs for upcoming shows, upvote favorites, and compete with music fans worldwide
          </p>
          <button
            onClick={onSignInRequired}
            className="px-8 py-3 bg-white text-black rounded-xl hover:bg-gray-200 transition-all duration-200 font-semibold text-sm"
          >
            Start Voting
          </button>
        </div>
        {/* Simplified background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-4 left-4 w-8 h-8 border border-white rounded-full"></div>
          <div className="absolute top-8 right-8 w-6 h-6 border border-white rounded-full"></div>
          <div className="absolute bottom-4 left-8 w-4 h-4 border border-white rounded-full"></div>
          <div className="absolute bottom-8 right-4 w-10 h-10 border border-white rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

// Horizontal Scrolling Container Component
function HorizontalScrollingSection({ 
  children, 
  direction, 
  isLoading, 
  emptyTitle, 
  emptySubtitle 
}: {
  children: React.ReactNode;
  direction: 'left' | 'right';
  isLoading: boolean;
  emptyTitle: string;
  emptySubtitle: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = React.useState(false);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement || isPaused || isLoading) return;

    const scroll = () => {
      const maxScroll = scrollElement.scrollWidth - scrollElement.clientWidth;
      const currentScroll = scrollElement.scrollLeft;
      
      if (direction === 'right') {
        if (currentScroll >= maxScroll) {
          scrollElement.scrollLeft = 0;
        } else {
          scrollElement.scrollLeft += 1;
        }
      } else {
        if (currentScroll <= 0) {
          scrollElement.scrollLeft = maxScroll;
        } else {
          scrollElement.scrollLeft -= 1;
        }
      }
    };

    const interval = setInterval(scroll, 50); // Smooth 50ms intervals
    return () => clearInterval(interval);
  }, [direction, isPaused, isLoading]);

  if (isLoading) {
    return (
      <div className="flex gap-6 overflow-hidden pb-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex-shrink-0 w-96 h-80 bg-gradient-to-br from-gray-950 to-black border border-gray-800 rounded-3xl p-8 animate-pulse">
            <div className="w-10 h-10 bg-gray-800 rounded-full mb-6"></div>
            <div className="space-y-4">
              <div className="h-8 bg-gray-800 rounded-lg shimmer"></div>
              <div className="h-5 bg-gray-800 rounded w-3/4 shimmer"></div>
              <div className="h-5 bg-gray-800 rounded w-1/2 shimmer"></div>
            </div>
            <div className="mt-8 space-y-3">
              <div className="h-12 bg-gray-800 rounded-2xl shimmer"></div>
              <div className="h-12 bg-gray-800 rounded-2xl shimmer"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!children || React.Children.count(children) === 0) {
    return (
      <EmptyState 
        icon={<TrendingUp className="h-16 w-16" />}
        title={emptyTitle}
        subtitle={emptySubtitle}
      />
    );
  }

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div 
        ref={scrollRef}
        className="flex gap-8 overflow-x-hidden scrollbar-hide pb-6"
        style={{ 
          width: '100%',
          overflowX: 'hidden'
        }}
      >
        {children}
      </div>
      
      {/* Gradient Overlays */}
      <div className="absolute top-0 left-0 w-40 h-full bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 right-0 w-40 h-full bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
    </div>
  );
}

// Optimized Show Card for horizontal scrolling
function PremiumShowCard({ show, rank, onArtistClick, onTicketClick }: {
  show: any;
  rank: number;
  onArtistClick: (artistTicketmasterId: string, artistName: string, genres?: string[], images?: string[]) => void;
  onTicketClick: (url: string) => void;
}) {
  const showDate = new Date(show.date);
  const isToday = showDate.toDateString() === new Date().toDateString();
  const isTomorrow = showDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
  
  let dateText = showDate.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric'
  });
  if (isToday) dateText = "Today";
  else if (isTomorrow) dateText = "Tomorrow";

  return (
    <div className="flex-shrink-0 w-80 group relative bg-gradient-to-br from-zinc-950 to-black border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 transition-all duration-300 hover:scale-[1.02] cursor-pointer">
      {/* Rank Badge - Smaller */}
      <div className="absolute top-4 left-4 z-20 w-8 h-8 bg-white text-black rounded-full flex items-center justify-center text-sm font-bold">
        {rank}
      </div>
      
      {/* Artist Image Background */}
      {show.artistImage && (
        <div className="absolute inset-0 z-0">
          <img 
            src={show.artistImage} 
            alt={show.artistName}
            className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/95 to-black/50" />
        </div>
      )}
      
      <div className="relative z-10 p-6 h-full flex flex-col justify-between min-h-[280px]">
        {/* Artist Info - Refined */}
        <div>
          <h3 className="text-xl font-bold mb-3 text-white leading-tight">
            {show.artistName}
          </h3>
          
          {/* Show Details - Compact */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 text-gray-300">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{show.venueName}</div>
                <div className="text-gray-400 text-xs">{show.venueCity}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-gray-300">
              <Calendar className="h-4 w-4" />
              <span className="font-medium text-sm">{dateText}</span>
              {show.startTime && (
                <>
                  <Clock className="h-3 w-3 ml-2" />
                  <span className="text-xs">{show.startTime}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Action Buttons - Smaller & More Refined */}
        <div className="space-y-2">
          <button
            onClick={() => onArtistClick(show.artistTicketmasterId || show.ticketmasterId, show.artistName, [], show.artistImage ? [show.artistImage] : [])}
            className="w-full bg-white/10 border border-white/20 text-white rounded-xl py-2 px-4 text-sm font-medium hover:bg-white/20 transition-all duration-200 backdrop-blur-sm"
          >
            View Artist
          </button>
          {show.ticketUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTicketClick(show.ticketUrl);
              }}
              className="w-full bg-white text-black rounded-xl py-2 px-4 font-semibold hover:bg-gray-200 transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            >
              <ExternalLink className="h-3 w-3" />
              Tickets
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Optimized Artist Card for horizontal scrolling
function PremiumArtistCard({ artist, rank, onClick }: {
  artist: any;
  rank: number;
  onClick: () => void;
}) {
  return (
    <div 
      className="flex-shrink-0 w-80 group relative bg-gradient-to-br from-zinc-950 to-black border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
      onClick={onClick}
    >
      {/* Rank Badge - Smaller */}
      <div className="absolute top-4 left-4 z-20 w-8 h-8 bg-white text-black rounded-full flex items-center justify-center text-sm font-bold">
        {rank}
      </div>
      
      {/* Artist Image Background */}
      {artist.images?.[0] && (
        <div className="absolute inset-0 z-0">
          <img 
            src={artist.images[0]} 
            alt={artist.name}
            className="w-full h-full object-cover opacity-25 group-hover:opacity-35 transition-opacity duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/95 to-black/50" />
        </div>
      )}
      
      <div className="relative z-10 p-6 h-full flex flex-col justify-between min-h-[280px]">
        {/* Artist Info - Refined */}
        <div>
          <h3 className="text-xl font-bold mb-3 text-white leading-tight">
            {artist.name}
          </h3>
          
          {artist.genres && artist.genres.length > 0 && (
            <p className="text-gray-300 font-medium mb-4 capitalize text-sm">
              {artist.genres.slice(0, 2).join(" • ")}
            </p>
          )}
          
          {artist.upcomingEvents > 0 && (
            <div className="flex items-center gap-2 text-gray-300 mb-6">
              <Calendar className="h-4 w-4" />
              <span className="font-semibold text-lg">{artist.upcomingEvents}</span>
              <span className="text-gray-400 text-sm">upcoming shows</span>
            </div>
          )}
        </div>
        
        {/* Action Button - Smaller & More Refined */}
        <button className="w-full bg-white/10 border border-white/20 text-white rounded-xl py-2 px-4 text-sm font-medium hover:bg-white/20 transition-all duration-200 backdrop-blur-sm">
          View Artist
        </button>
      </div>
    </div>
  );
}



function EmptyState({ icon, title, subtitle }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <div className="opacity-50 mb-4 flex justify-center">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="text-sm mt-1">{subtitle}</p>
    </div>
  );
}

// Premium Loading Components

