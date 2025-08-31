import React, { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TrendingUp, Calendar, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { Marquee } from "./ui/marquee";
import { SearchBar } from "./SearchBar";

interface PublicDashboardProps {
  onArtistClick: (artistSlug: string) => void;
  onShowClick: (showId: Id<"shows">) => void;
  onSignInRequired: () => void;
  navigate: (path: string) => void;
}

export function PublicDashboard({ onArtistClick, onSignInRequired, navigate }: PublicDashboardProps) {
  // State for Ticketmaster trending data
  const [trendingShows, setTrendingShows] = useState<any[]>([]);
  const [trendingArtists, setTrendingArtists] = useState<any[]>([]);
  const [isLoadingShows, setIsLoadingShows] = useState(false);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);

  const triggerFullSync = useAction(api.ticketmaster.triggerFullArtistSync);

  // Load trending data from database (cached from cron jobs)
  const dbTrendingShows = useQuery(api.trending.getTrendingShows, { limit: 20 });
  const dbTrendingArtists = useQuery(api.trending.getTrendingArtists, { limit: 20 });
  
  // Fallback: Load from main tables if trending data is empty
  const fallbackArtists = useQuery(api.artists.getTrending, { limit: 20 });
  const fallbackShows = useQuery(api.shows.getUpcoming, { limit: 20 });

  useEffect(() => {
    // Use trending data if available, otherwise use fallback
    if (dbTrendingShows && dbTrendingShows.length > 0) {
      // Deduplicate shows by artist to avoid showing same artist multiple times
      const uniqueShows = dbTrendingShows.filter((show, index, self) => 
        index === self.findIndex(s => s.artistName === show.artistName)
      );
      setTrendingShows(uniqueShows);
      setIsLoadingShows(false);
    } else if (fallbackShows) {
      // Convert fallback shows to trending format
      const convertedShows = fallbackShows.map(show => ({
        ticketmasterId: show.ticketmasterId || show._id,
        artistTicketmasterId: show.artist?.ticketmasterId,
        artistName: show.artist?.name || 'Unknown Artist',
        venueName: show.venue?.name || 'Unknown Venue',
        venueCity: show.venue?.city || '',
        venueCountry: show.venue?.country || '',
        date: show.date,
        startTime: show.startTime,
        artistImage: show.artist?.images?.[0],
        ticketUrl: show.ticketUrl,
        status: show.status,
      }));
      setTrendingShows(convertedShows.slice(0, 12));
      setIsLoadingShows(false);
    }
    
    if (dbTrendingArtists && dbTrendingArtists.length > 0) {
      setTrendingArtists(dbTrendingArtists);
      setIsLoadingArtists(false);
    } else if (fallbackArtists) {
      // Convert fallback artists to trending format
      const convertedArtists = fallbackArtists.map(artist => ({
        ticketmasterId: artist.ticketmasterId || artist._id,
        name: artist.name,
        genres: artist.genres || [],
        images: artist.images || [],
        upcomingEvents: artist.upcomingShows || 0,
        url: artist.url,
      }));
      setTrendingArtists(convertedArtists);
      setIsLoadingArtists(false);
    }
  }, [dbTrendingShows, dbTrendingArtists, fallbackShows, fallbackArtists]);

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
    <div className="w-full space-y-6 sm:space-y-8 lg:space-y-10 relative z-10">
      {/* Apple-Level Hero Section with Dynamic Marquee */}
      <div className="relative overflow-hidden">
        {/* Dynamic Marquee Banners */}
        <div className="relative min-h-[280px] sm:min-h-[320px] lg:min-h-[400px] flex flex-col justify-center space-y-3 sm:space-y-4 py-4 sm:py-6">
          {/* Top Marquee - Artists sliding right to left */}
          <div className="relative">
            <Marquee className="[--duration:25s] [--gap:2rem]" reverse={false}>
              {trendingArtists.slice(0, 10).map((artist, index) => (
                <div
                  key={`top-${artist.name}-${index}`}
                  className="flex items-center space-x-2 sm:space-x-3 px-4 sm:px-6 py-1.5 sm:py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10"
                >
                  {artist.images?.[0] && (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-white/10">
                      <img 
                        src={artist.images[0]} 
                        alt={artist.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <span className="text-white font-medium text-sm sm:text-base lg:text-lg whitespace-nowrap">
                    {artist.name}
                  </span>
                </div>
              ))}
            </Marquee>
            {/* Gradient overlays for smooth edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black via-black/80 to-transparent"></div>
          </div>

          {/* Center Content */}
          <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8">
            <h1 className="text-responsive-3xl sm:text-responsive-4xl font-bold tracking-tight text-white mb-2 sm:mb-3 lg:mb-4">
              Crowd-Curated
              <br className="sm:hidden" />
              <span className="hidden sm:inline"> </span>Setlists
            </h1>
            <p className="text-responsive-sm sm:text-responsive-base lg:text-responsive-lg text-gray-300 max-w-lg sm:max-w-xl lg:max-w-2xl mx-auto leading-relaxed mb-4 sm:mb-6 lg:mb-8">
              Vote on songs you want to hear at concerts<span className="hidden sm:inline"> and see what other fans are predicting</span>.
            </p>
            
            {/* Search Input - Homepage Only */}
            <div className="max-w-md mx-auto">
              <SearchBar 
                onResultClick={(type: string, id: string, slug?: string) => {
                  if (type === 'artist') {
                    const urlParam = slug || id;
                    navigate(`/artists/${urlParam}`)
                  } else if (type === 'show') {
                    const urlParam = slug || id;
                    navigate(`/shows/${urlParam}`)
                  }
                }} 
                placeholder="Search artists, shows, venues..."
                className="w-full"
              />
            </div>
          </div>

          {/* Bottom Marquee - Artists sliding left to right */}
          <div className="relative">
            <Marquee className="[--duration:30s] [--gap:2rem]" reverse={true}>
              {trendingArtists.slice(10, 20).map((artist, index) => (
                <div
                  key={`bottom-${artist.name}-${index}`}
                  className="flex items-center space-x-2 sm:space-x-3 px-4 sm:px-6 py-1.5 sm:py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10"
                >
                  {artist.images?.[0] && (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-white/10">
                      <img 
                        src={artist.images[0]} 
                        alt={artist.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <span className="text-white font-medium text-sm sm:text-base lg:text-lg whitespace-nowrap">
                    {artist.name}
                  </span>
                </div>
              ))}
            </Marquee>
            {/* Gradient overlays for smooth edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black via-black/80 to-transparent"></div>
          </div>
        </div>

        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/5 to-transparent pointer-events-none"></div>
      </div>

      {/* Main Content Sections */}
      <div className="space-y-6 sm:space-y-10 lg:space-y-16 px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12">
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
                    void handleArtistClick(artistTicketmasterId, artistName, genres, images);
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
                  onClick={() => void handleArtistClick(artist.ticketmasterId, artist.name, artist.genres, artist.images)}
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

// Static Two-Row Display Component
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
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Two rows of loading skeletons */}
        {[...Array(2)].map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-72 h-64 bg-gradient-to-br from-gray-950 to-black border border-gray-800 rounded-2xl p-6 animate-pulse">
                <div className="w-8 h-8 bg-gray-800 rounded-full mb-4"></div>
                <div className="space-y-3">
                  <div className="h-6 bg-gray-800 rounded-lg shimmer"></div>
                  <div className="h-4 bg-gray-800 rounded w-3/4 shimmer"></div>
                  <div className="h-4 bg-gray-800 rounded w-1/2 shimmer"></div>
                </div>
                <div className="mt-6 space-y-2">
                  <div className="h-10 bg-gray-800 rounded-xl shimmer"></div>
                </div>
              </div>
            ))}
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

  const childrenArray = React.Children.toArray(children);
  const firstRowChildren = childrenArray.slice(0, Math.ceil(childrenArray.length / 2));
  const secondRowChildren = childrenArray.slice(Math.ceil(childrenArray.length / 2));

  return (
    <div className="space-y-6">
      {/* First Row - Static Horizontal Scroll */}
      <div className="relative">
        <div className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 scroll-smooth">
          {firstRowChildren}
        </div>
        
        {/* Subtle gradient overlays */}
        <div className="absolute top-0 left-0 w-8 h-full bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
      </div>

      {/* Second Row - Static Horizontal Scroll */}
      <div className="relative">
        <div className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 scroll-smooth">
          {secondRowChildren}
        </div>
        
        {/* Subtle gradient overlays */}
        <div className="absolute top-0 left-0 w-8 h-full bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
      </div>
    </div>
  );
}

// Redesigned Show Card to Match Artist Page Style
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

  // Format time to normal format like "8pm EST"
  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${minutes !== '00' ? `:${minutes}` : ''}${ampm} EST`;
  };

  return (
    <MagicCard
      className="flex-shrink-0 w-72 group relative transition-all duration-300 ease-out active:scale-[0.98] cursor-pointer p-0 overflow-hidden border-0 touch-manipulation"
      gradientColor="#000000"
      gradientOpacity={0}
      gradientSize={0}
    >
      {/* Large Artist Image at Top - Matching Artist Card Style */}
      <div className="relative w-full h-40 overflow-hidden">
        {show.artistImage ? (
          <>
            <img 
              src={show.artistImage} 
              alt={show.artistName}
              className="w-full h-full object-cover opacity-85"
            />

          </>
        ) : (
          <div className="w-full h-full bg-accent/20 flex items-center justify-center">
            <span className="text-foreground font-bold text-2xl">
              {show.artistName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      <div className="relative z-10 p-5" onClick={() => onArtistClick(show.artistTicketmasterId || show.ticketmasterId, show.artistName, [], show.artistImage ? [show.artistImage] : [])}>
        {/* Artist Info - Enhanced */}
        <div className="mb-4">
          <h3 className="font-bold text-foreground text-lg mb-2 transition-colors truncate">
            {show.artistName}
          </h3>
          
          {/* Show Details Below Artist Name */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="text-sm font-medium truncate">{show.venueName}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span className="text-sm font-medium">{dateText}</span>
              </div>
              
              {show.startTime && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs font-semibold">{formatTime(show.startTime)}</span>
                </div>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground">
              {show.venueCity}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        {isToday && (
          <div className="inline-flex items-center px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full">
            Tonight
          </div>
        )}
      </div>
      
      <BorderBeam 
        size={100} 
        duration={12} 
        className="opacity-20" 
        colorFrom="#ffffff" 
        colorTo="#888888"
      />
    </MagicCard>
  );
}

// Redesigned Artist Card to Match Artist Page Style  
function PremiumArtistCard({ artist, onClick }: {
  artist: any;
  onClick: () => void;
}) {
  return (
    <MagicCard 
      className="flex-shrink-0 w-72 group relative transition-all duration-300 ease-out active:scale-[0.98] cursor-pointer p-0 overflow-hidden border-0 touch-manipulation"
      gradientColor="#000000"
      gradientOpacity={0}
      gradientSize={0}
    >
      {/* Large Artist Image at Top - Matching Artist Card Style */}
      <div className="relative w-full h-40 overflow-hidden">
        {artist.images?.[0] ? (
          <>
            <img 
              src={artist.images[0]} 
              alt={artist.name}
              className="w-full h-full object-cover opacity-85"
            />

          </>
        ) : (
          <div className="w-full h-full bg-accent/20 flex items-center justify-center">
            <span className="text-foreground font-bold text-2xl">
              {artist.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      <div className="relative z-10 p-5" onClick={onClick}>
        {/* Artist Info - Enhanced */}
        <div className="mb-4">
          <h3 className="font-bold text-foreground text-lg mb-2 transition-colors truncate">
            {artist.name}
          </h3>
          
          <div className="flex items-center justify-between">
            {artist.genres?.[0] && (
              <span className="text-muted-foreground text-sm font-medium bg-accent/30 px-2 py-1 rounded-lg">
                {artist.genres[0]}
              </span>
            )}
            
            {artist.upcomingEvents > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className="font-semibold">{artist.upcomingEvents} shows</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <BorderBeam 
        size={100} 
        duration={12} 
        className="opacity-20" 
        colorFrom="#ffffff" 
        colorTo="#888888"
      />
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
  
  // Format time to normal format like "8pm EST"
  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${minutes !== '00' ? `:${minutes}` : ''}${ampm} EST`;
  };
  
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
          <h3 className="font-semibold text-foreground transition-colors truncate text-base">
            {show.artistName}
          </h3>
          <p className="text-sm text-muted-foreground truncate">{show.venueName}</p>
          <p className="text-xs text-muted-foreground">{show.venueCity}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-1 rounded-full ${
              isToday ? 'bg-primary/20 text-primary' : 'bg-muted/20 text-muted-foreground'
            }`}>
              {isToday ? 'Tonight' : showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            {show.startTime && (
              <span className="text-xs text-muted-foreground font-medium">
                {formatTime(show.startTime)}
              </span>
            )}
          </div>
        </div>
        
        {/* Arrow indicator */}
        <div className="text-muted-foreground">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
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
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Premium Loading Components

