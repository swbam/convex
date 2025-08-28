import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TrendingUp, Calendar, Music, Users, MapPin, Clock, Plus, Heart, Star, ExternalLink, Ticket } from "lucide-react";
import { toast } from "sonner";

interface PublicDashboardProps {
  onArtistClick: (artistId: Id<"artists">) => void;
  onShowClick: (showId: Id<"shows">) => void;
  onSignInRequired: () => void;
}

export function PublicDashboard({ onArtistClick, onShowClick, onSignInRequired }: PublicDashboardProps) {
  const user = useQuery(api.auth.loggedInUser);
  
  // State for Ticketmaster trending data
  const [trendingShows, setTrendingShows] = useState<any[]>([]);
  const [trendingArtists, setTrendingArtists] = useState<any[]>([]);
  const [isLoadingShows, setIsLoadingShows] = useState(false);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);

  // Actions to fetch live Ticketmaster data

  const triggerFullSync = useAction(api.ticketmaster.triggerFullArtistSync);

  const [anonymousActions, setAnonymousActions] = useState(0);

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

  const handleAnonymousAction = () => {
    if (anonymousActions >= 1) {
      onSignInRequired();
      return false;
    }
    setAnonymousActions(prev => prev + 1);
    return true;
  };

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
      const slug = artistName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      onArtistClick(artistId);
    } catch (error) {
      console.error("Failed to sync artist:", error);
      toast.error("Failed to load artist");
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 space-y-10">
      {/* Hero Section */}
      <div className="text-center py-16">
        <h1 className="text-6xl font-bold gradient-text mb-6 leading-tight">
          Live Music Discovery
        </h1>
        <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
          Trending artists and shows from Ticketmaster. Predict setlists, vote on accuracy, and discover your next favorite concert.
        </p>
        <p className="text-muted-foreground/60">
          Updated live every 3 hours from Ticketmaster API
        </p>
      </div>

      {/* Horizontal Scrolling Sections */}
      <div className="space-y-16">
        {/* Trending Shows - Scrolling Left */}
        <div>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-white to-gray-400 rounded-2xl flex items-center justify-center">
              <Calendar className="h-6 w-6 text-black" />
            </div>
            <div>
              <h2 className="text-4xl font-bold">Trending Shows</h2>
              <p className="text-muted-foreground text-lg">Popular concerts happening now</p>
            </div>
            <div className="pulse-dot ml-4"></div>
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
                onArtistClick={(artistTicketmasterId: string, artistName: string, genres?: string[], images?: string[]) => handleArtistClick(artistTicketmasterId, artistName, genres, images)}
                onTicketClick={(url) => window.open(url, '_blank')}
              />
            ))}
          </HorizontalScrollingSection>
        </div>

        {/* Trending Artists - Scrolling Right */}
        <div>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-white to-gray-400 rounded-2xl flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-black" />
            </div>
            <div>
              <h2 className="text-4xl font-bold">Trending Artists</h2>
              <p className="text-muted-foreground text-lg">Hot artists with upcoming tours</p>
            </div>
            <div className="pulse-dot ml-4"></div>
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
                onClick={() => handleArtistClick(artist.ticketmasterId, artist.name, artist.genres, artist.images)}
              />
            ))}
          </HorizontalScrollingSection>
        </div>
      </div>

      {/* Call to Action */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-gray-900 to-black border border-gray-800 p-12 text-center">
        <div className="relative z-10">
          <h3 className="text-4xl font-bold mb-6">Join the Prediction Game</h3>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Create setlist predictions, vote on accuracy, and compete with music fans worldwide
          </p>
          <button
            onClick={onSignInRequired}
            className="px-12 py-4 bg-white text-black rounded-2xl hover:bg-gray-200 transition-all duration-300 font-semibold text-lg shadow-2xl hover:shadow-white/20"
          >
            Start Predicting
          </button>
        </div>
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-20 h-20 border border-white rounded-full"></div>
          <div className="absolute top-20 right-20 w-16 h-16 border border-white rounded-full"></div>
          <div className="absolute bottom-10 left-20 w-12 h-12 border border-white rounded-full"></div>
          <div className="absolute bottom-20 right-10 w-24 h-24 border border-white rounded-full"></div>
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
          width: '100vw', 
          marginLeft: 'calc(-50vw + 50%)',
          paddingLeft: 'calc(50vw - 50%)',
          paddingRight: 'calc(50vw - 50%)'
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
    <div className="flex-shrink-0 w-96 group relative bg-gradient-to-br from-gray-950 to-black border border-gray-800 rounded-3xl overflow-hidden hover:border-gray-600 transition-all duration-500 hover:scale-[1.05] hover:shadow-2xl cursor-pointer">
      {/* Rank Badge */}
      <div className="absolute top-6 left-6 z-20 w-12 h-12 bg-white text-black rounded-full flex items-center justify-center text-xl font-bold shadow-xl">
        {rank}
      </div>
      
      {/* Artist Image Background */}
      {show.artistImage && (
        <div className="absolute inset-0 z-0">
          <img 
            src={show.artistImage} 
            alt={show.artistName}
            className="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-black/30" />
        </div>
      )}
      
      <div className="relative z-10 p-8 h-full flex flex-col justify-between min-h-[350px]">
        {/* Artist Info */}
        <div>
          <h3 className="text-3xl font-bold mb-4 text-white group-hover:text-gray-200 transition-colors leading-tight">
            {show.artistName}
          </h3>
          
          {/* Show Details */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3 text-gray-300">
              <MapPin className="h-6 w-6 mt-1 flex-shrink-0" />
              <div>
                <div className="font-semibold text-xl">{show.venueName}</div>
                <div className="text-gray-400 text-lg">{show.venueCity}, {show.venueCountry}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-gray-300">
              <Calendar className="h-6 w-6" />
              <span className="font-semibold text-xl">{dateText}</span>
              {show.startTime && (
                <>
                  <Clock className="h-5 w-5 ml-3" />
                  <span className="text-lg">{show.startTime}</span>
                </>
              )}
            </div>
            
            {show.priceRange && (
              <div className="flex items-center gap-3 text-green-400">
                <Ticket className="h-6 w-6" />
                <span className="font-bold text-xl">{show.priceRange}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => onArtistClick(show.artistTicketmasterId || show.ticketmasterId, show.artistName, [], show.artistImage ? [show.artistImage] : [])}
            className="w-full bg-white/10 border border-white/30 text-white rounded-2xl py-4 px-6 font-semibold hover:bg-white/25 transition-all duration-300 backdrop-blur-sm text-lg"
          >
            View Artist & Shows
          </button>
          {show.ticketUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTicketClick(show.ticketUrl);
              }}
              className="w-full bg-white text-black rounded-2xl py-4 px-6 font-bold hover:bg-gray-200 transition-all duration-300 flex items-center justify-center gap-3 text-lg shadow-lg"
            >
              <ExternalLink className="h-5 w-5" />
              Get Tickets
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
      className="flex-shrink-0 w-96 group relative bg-gradient-to-br from-gray-950 to-black border border-gray-800 rounded-3xl overflow-hidden hover:border-gray-600 transition-all duration-500 hover:scale-[1.05] hover:shadow-2xl cursor-pointer"
      onClick={onClick}
    >
      {/* Rank Badge */}
      <div className="absolute top-6 left-6 z-20 w-12 h-12 bg-white text-black rounded-full flex items-center justify-center text-xl font-bold shadow-xl">
        {rank}
      </div>
      
      {/* Artist Image Background */}
      {artist.images?.[0] && (
        <div className="absolute inset-0 z-0">
          <img 
            src={artist.images[0]} 
            alt={artist.name}
            className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-black/30" />
        </div>
      )}
      
      <div className="relative z-10 p-8 h-full flex flex-col justify-between min-h-[350px]">
        {/* Artist Info */}
        <div>
          <h3 className="text-3xl font-bold mb-4 text-white group-hover:text-gray-200 transition-colors leading-tight">
            {artist.name}
          </h3>
          
          {artist.genres && artist.genres.length > 0 && (
            <p className="text-gray-300 font-semibold mb-6 capitalize text-xl">
              {artist.genres.slice(0, 2).join(" • ")}
            </p>
          )}
          
          {artist.upcomingEvents > 0 && (
            <div className="flex items-center gap-3 text-gray-300 mb-8">
              <Calendar className="h-6 w-6" />
              <span className="font-bold text-2xl">{artist.upcomingEvents}</span>
              <span className="text-gray-400 text-lg">upcoming shows</span>
            </div>
          )}
        </div>
        
        {/* Action Button */}
        <button className="w-full bg-white/10 border border-white/30 text-white rounded-2xl py-4 px-6 font-semibold hover:bg-white/25 transition-all duration-300 backdrop-blur-sm text-lg">
          View Artist & Shows
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

