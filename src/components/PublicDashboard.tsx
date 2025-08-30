import React, { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TrendingUp, Calendar, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";

interface PublicDashboardProps {
  onArtistClick: (artistSlug: string) => void;
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

  // Load trending data from database (cached from cron jobs)
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
      toast.info(`Loading ${artistName}...`);
      
      // Trigger full sync to create artist in DB
      await triggerFullSync({
        ticketmasterId,
        artistName,
        genres,
        images,
      });
      
      // Generate SEO-friendly slug for navigation
      const slug = artistName.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Navigate to artist page using slug (will fallback to ID if needed)
      onArtistClick(slug);
      
      toast.success(`${artistName} loaded successfully!`);
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
      <div className="space-y-8 sm:space-y-16">
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
          
          {/* Desktop: Horizontal scroll */}
          <div className="hidden md:block">
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
                  onArtistClick={(artistTicketmasterId: string, artistName: string, genres?: string[], images?: string[]) => {
                    handleArtistClick(artistTicketmasterId, artistName, genres, images).catch(console.error);
                  }}
                />
              ))}
            </HorizontalScrollingSection>
          </div>
          
          {/* Mobile: Vertical stack */}
          <div className="md:hidden space-y-4">
            {isLoadingShows ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="mobile-card animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-muted/20 rounded-xl"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted/20 rounded w-3/4"></div>
                      <div className="h-3 bg-muted/20 rounded w-1/2"></div>
                      <div className="h-3 bg-muted/20 rounded w-1/3"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              trendingShows.slice(0, 6).map((show) => (
                <MobileShowCard
                  key={show.ticketmasterId}
                  show={show}
                  onArtistClick={handleArtistClick}
                />
              ))
            )}
          </div>
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
          
          {/* Desktop: Horizontal scroll */}
          <div className="hidden md:block">
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
                  onClick={() => {
                    handleArtistClick(artist.ticketmasterId, artist.name, artist.genres, artist.images).catch(console.error);
                  }}
                />
              ))}
            </HorizontalScrollingSection>
          </div>
          
          {/* Mobile: Vertical stack */}
          <div className="md:hidden space-y-4">
            {isLoadingArtists ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="mobile-card animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-muted/20 rounded-xl"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted/20 rounded w-3/4"></div>
                      <div className="h-3 bg-muted/20 rounded w-1/2"></div>
                      <div className="h-3 bg-muted/20 rounded w-1/3"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              trendingArtists.slice(0, 6).map((artist) => (
                <MobileArtistCard
                  key={artist.ticketmasterId}
                  artist={artist}
                  onClick={() => handleArtistClick(artist.ticketmasterId, artist.name, artist.genres, artist.images).catch(console.error)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Call to Action - Enhanced */}
      <MagicCard className="relative overflow-hidden rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold mb-3 text-foreground">Join the Community</h2>
        <p className="text-muted-foreground mb-6 text-base max-w-lg mx-auto">
          Vote on setlists, follow artists, and predict what songs will be played live
        </p>
        
        <button 
          onClick={onSignInRequired}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          Get Started
        </button>
        
        {/* Simplified background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-4 left-4 w-8 h-8 border border-foreground rounded-full"></div>
          <div className="absolute top-8 right-8 w-6 h-6 border border-foreground rounded-full"></div>
          <div className="absolute bottom-4 left-8 w-4 h-4 border border-foreground rounded-full"></div>
          <div className="absolute bottom-8 right-4 w-10 h-10 border border-foreground rounded-full"></div>
        </div>
        
        <BorderBeam 
          size={80} 
          duration={10} 
          className="opacity-30" 
          colorFrom="#ffffff" 
          colorTo="#888888"
        />
      </MagicCard>
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
          scrollElement.scrollLeft += 1.5; // Faster scroll speed
        }
      } else {
        if (currentScroll <= 0) {
          scrollElement.scrollLeft = maxScroll;
        } else {
          scrollElement.scrollLeft -= 1.5; // Faster scroll speed
        }
      }
    };

    const interval = setInterval(scroll, 25); // Faster scrolling - 25ms intervals
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
function PremiumShowCard({ show, onArtistClick }: {
  show: any;
  onArtistClick: (artistTicketmasterId: string, artistName: string, genres?: string[], images?: string[]) => void;
}) {
  const showDate = new Date(show.date);
  const isToday = showDate.toDateString() === new Date().toDateString();
  const isTomorrow = showDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
  
  let dateText = showDate.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric'
  });
  if (isToday) dateText = "Tonight";
  else if (isTomorrow) dateText = "Tomorrow";

  return (
    <MagicCard
      className="flex-shrink-0 w-80 group relative transition-all duration-300 hover:scale-[1.02] cursor-pointer p-0 overflow-hidden"
      gradientColor="#ffffff"
      gradientOpacity={0.06}
      gradientSize={400}
    >
      {/* Enhanced Artist Image Background */}
      {show.artistImage && (
        <div className="absolute inset-0 z-0">
          <img 
            src={show.artistImage} 
            alt={show.artistName}
            className="w-full h-full object-cover opacity-75 group-hover:opacity-90 transition-all duration-500 scale-105 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/30" />
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

        </div>
      </div>
    </MagicCard>
  );
}

// Optimized Artist Card for horizontal scrolling
function PremiumArtistCard({ artist, onClick }: {
  artist: any;

  onClick: () => void;
}) {
  return (
    <MagicCard 
      className="flex-shrink-0 w-80 group relative transition-all duration-300 hover:scale-[1.02] cursor-pointer p-0 overflow-hidden"
      gradientColor="#ffffff"
      gradientOpacity={0.06}
      gradientSize={400}
    >
      <div onClick={onClick} className="w-full h-full">

      
      {/* Artist Image Background */}
      {artist.images?.[0] && (
        <div className="absolute inset-0 z-0">
          <img 
            src={artist.images[0]} 
            alt={artist.name}
            className="w-full h-full object-cover opacity-75 group-hover:opacity-90 transition-all duration-500 scale-105 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/30" />
        </div>
      )}
      
      <div className="relative z-10 p-6 h-full flex flex-col justify-between min-h-[280px]">
        {/* Artist Info - Refined */}
        <div>
          <h3 className="text-xl font-bold mb-3 text-foreground leading-tight group-hover:text-primary transition-colors">
            {artist.name}
          </h3>
          
          {artist.genres && artist.genres.length > 0 && (
            <p className="text-muted-foreground font-medium mb-4 capitalize text-sm bg-accent/30 px-2 py-1 rounded-lg inline-block">
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
        
        {/* Action Button - Enhanced */}
        <button className="w-full bg-accent hover:bg-primary hover:text-primary-foreground text-foreground rounded-xl py-3 px-4 text-sm font-semibold transition-all duration-200 group-hover:shadow-lg">
          View Profile
        </button>
      </div>
      
      <BorderBeam 
        size={120} 
        duration={15} 
        className="opacity-0 group-hover:opacity-50 transition-opacity duration-300" 
        colorFrom="#ffffff" 
        colorTo="#888888"
      />
      </div>
    </MagicCard>
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

// Mobile-optimized Show Card
function MobileShowCard({ show, onArtistClick }: {
  show: any;
  onArtistClick: (artistTicketmasterId: string, artistName: string, genres?: string[], images?: string[]) => void;
}) {
  const showDate = new Date(show.date);
  const isToday = showDate.toDateString() === new Date().toDateString();
  
  return (
    <div className="mobile-card cursor-pointer" onClick={() => onArtistClick(show.artistTicketmasterId, show.artistName, [], show.artistImage ? [show.artistImage] : [])}>
      <div className="flex items-center gap-4">
        {/* Artist Image */}
        {show.artistImage && (
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-accent/20 flex-shrink-0">
            <img 
              src={show.artistImage} 
              alt={show.artistName}
              className="w-full h-full object-cover opacity-85"
            />
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground hover:text-primary transition-colors truncate">
            {show.artistName}
          </h3>
          <p className="text-sm text-muted-foreground truncate">{show.venueName}</p>
          <p className="text-xs text-muted-foreground">{show.venueCity}, {show.venueCountry}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-1 rounded-full ${
              isToday ? 'bg-primary/20 text-primary' : 'bg-muted/20 text-muted-foreground'
            }`}>
              {isToday ? 'Tonight' : showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
        
        {/* Arrow indicator */}
        <div className="text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// Mobile-optimized Artist Card
function MobileArtistCard({ artist, onClick }: {
  artist: any;
  onClick: () => void;
}) {
  return (
    <div className="mobile-card cursor-pointer" onClick={onClick}>
      <div className="flex items-center gap-4">
        {/* Artist Image */}
        {artist.images?.[0] && (
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-accent/20 flex-shrink-0">
            <img 
              src={artist.images[0]} 
              alt={artist.name}
              className="w-full h-full object-cover opacity-85"
            />
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground hover:text-primary transition-colors truncate">{artist.name}</h3>
          {artist.genres && artist.genres.length > 0 && (
            <p className="text-sm text-muted-foreground truncate">{artist.genres[0]}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs bg-muted/20 text-muted-foreground px-2 py-1 rounded-full">
              {artist.upcomingEvents} shows
            </span>
          </div>
        </div>
        
        {/* Arrow indicator */}
        <div className="text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// Premium Loading Components

