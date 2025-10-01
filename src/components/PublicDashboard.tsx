import React, { useState } from 'react';
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { Shows, Users, Calendar, Filter, TrendingUp, MapPin, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { SearchBar } from "./SearchBar";
import { FadeIn } from "./animations/FadeIn";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface PublicDashboardProps {
  onArtistClick: (artistKey: Id<"artists"> | string) => void;
  onShowClick: (showKey: Id<"shows"> | string) => void;
  onSignInRequired: () => void;
  navigate: (path: string) => void;
}

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function PublicDashboard({ onArtistClick, onShowClick, onSignInRequired, navigate }: PublicDashboardProps) {
  const navigateTo = useNavigate();
  const [filterGenre, setFilterGenre] = useState('');
  const [filterCity, setFilterCity] = useState('');

  // Load trending data directly from the optimized trending system
  const dbTrendingShowsResult = useQuery(api.trending.getTrendingShows, { limit: 20 });
  const dbTrendingArtistsResult = useQuery(api.trending.getTrendingArtists, { limit: 20 });
  
  // Extract page arrays from paginated results
  const dbTrendingShows = dbTrendingShowsResult?.page || [];
  const dbTrendingArtists = dbTrendingArtistsResult?.page || [];

  // Filtered data
  const filteredShows = dbTrendingShows.filter(show => 
    (!filterGenre || show.artist?.genres?.[0]?.includes(filterGenre)) &&
    (!filterCity || show.venue?.city?.includes(filterCity))
  );

  const filteredArtists = dbTrendingArtists.filter(artist => 
    (!filterGenre || artist.genres?.includes(filterGenre))
  );

  if (!dbTrendingShowsResult && !dbTrendingArtistsResult) {
    return <div className="container mx-auto px-4 py-8 text-center"><Loader2 className="animate-spin h-12 w-12 mx-auto" /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Carousel: Top 5 shows horizontal scroll */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          Top Trending Shows
        </h2>
        <div className="overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4">
          <div className="flex gap-4">
            {dbTrendingShows?.slice(0, 5).map(show => (
              <ShowCard 
                key={show._id} 
                show={show} 
                onClick={() => navigateTo(`/shows/${show.slug}`)}
                compact={true} // Use compact for carousel
              />
            ))}
          </div>
        </div>
        {dbTrendingShows?.length === 0 && <p className="text-gray-400 text-center py-8">Discovering top shows...</p>}
      </section>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8 justify-center">
        <Select onValueChange={setFilterGenre}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by Genre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Genres</SelectItem>
            <SelectItem value="rock">Rock</SelectItem>
            <SelectItem value="pop">Pop</SelectItem>
            {/* More */}
          </SelectContent>
        </Select>
        <Select onValueChange={setFilterCity}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Cities</SelectItem>
            <SelectItem value="new york">New York</SelectItem>
            <SelectItem value="los angeles">Los Angeles</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Horizontal Scroll Artists */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Users className="h-6 w-6" />
          Trending Artists
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {filteredArtists.map(artist => (
            <ArtistCard 
              key={artist._id} 
                  artist={artist}
              onClick={() => navigateTo(`/artists/${artist.slug}`)}
                />
              ))}
        </div>
      </section>

      {/* Masonry Grid Shows */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredShows.slice(0, 12).map(show => (
          <ShowCard 
            key={show._id} 
            show={show} 
            onClick={() => navigateTo(`/shows/${show.slug}`)}
          />
        ))}
      </section>
      {filteredShows.length === 0 && <p className="text-gray-400 text-center py-8 col-span-full">No shows match your filters. Clear and try again.</p>}
    </div>
  );
}

// Redesigned Show Card to Match Artist Page Style
function ShowCard({
  show,
  onClick,
  compact = false,
}: {
  show: any;
  onClick: () => void;
  compact?: boolean;
}) {
  const formatTime = (date: string) => new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const handleCardClick = () => onClick();

  return (
    <div // Use div for clickable, no MagicCard if conflicting
      className="flex-shrink-0 w-72 group relative transition-all duration-300 ease-out active:scale-[0.98] cursor-pointer touch-manipulation overflow-hidden bg-black min-h-[192px] flex flex-col" // min-h-48
      onClick={handleCardClick}
      style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Large Artist Image: h-32 consistent */}
      <div className="relative w-full h-32 overflow-hidden flex-shrink-0">
          {(show.artist?.images?.[0] || show.artistImage) ? (
              <img
                src={show.artist?.images?.[0] || show.artistImage}
                alt={show.artist?.name || show.artistName}
            className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
              />
          ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <span className="text-white font-bold text-xl">
                {(show.artist?.name || show.artistName).slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
        </div>

      {/* Content: p-4 space-y-2 flex-1 */}
      <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
          <div>
          <h3 className="text-white font-semibold text-base leading-tight line-clamp-1">{show.artist?.name || show.artistName}</h3>
          <p className="text-gray-400 text-sm">{new Date(show.date).toLocaleDateString()}</p>
          {show.venue && (
            <p className="text-gray-400 text-sm flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {show.venue.name}, {show.venue.city}
            </p>
                )}
              </div>
        <div className="pt-2">
          {show.ticketUrl && (
            <Button variant="outline" size="sm" asChild className="w-full">
              <a href={show.ticketUrl} target="_blank" rel="noopener noreferrer">
                Tickets
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Redesigned Artist Card to Match Artist Page Style  
function ArtistCard({ artist, onClick }: {
  artist: any;
  onClick: () => void;
}) {
  return (
    <div // Entire card clickable
      className="flex-shrink-0 w-72 group relative transition-all duration-300 ease-out hover:scale-105 active:scale-[0.98] cursor-pointer touch-manipulation overflow-hidden bg-black min-h-[192px] flex flex-col"
      onClick={onClick}
      style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Large Artist Image: h-32 */}
      <div className="relative w-full h-32 overflow-hidden flex-shrink-0">
          {artist.images?.[0] ? (
              <img 
                src={artist.images[0]} 
                alt={artist.name}
            className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
              />
          ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <span className="text-white font-bold text-xl">
                {artist.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        
      {/* Content: p-4 */}
      <div className="p-4 space-y-2">
        <h3 className="text-white font-semibold text-base leading-tight line-clamp-2">{artist.name}</h3>
        <p className="text-gray-400 text-sm">{artist.upcomingShowsCount || 0} upcoming shows</p>
        {artist.genres?.[0] && <p className="text-gray-500 text-xs">{artist.genres[0]}</p>}
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

// Mobile-optimized Show Card
function MobileShowCard({
  show,
  onShowClick,
  onArtistClick,
}: {
  show: any;
  onShowClick: () => void;
  onArtistClick: () => void;
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
    <div
      className="mobile-card cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={onShowClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onShowClick();
        }
      }}
    >
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-accent/20 flex-shrink-0">
          {(show.artist?.images?.[0] || show.artistImage) ? (
            <img
              src={show.artist?.images?.[0] || show.artistImage}
              alt={show.artist?.name || show.artistName}
              className="w-full h-full object-cover opacity-85"
            />
          ) : (
            <div className="w-full h-full bg-accent/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-muted-foreground">
                {(show.artist?.name || show.artistName)?.slice(0, 2)?.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground transition-colors truncate text-base">
            {show.artist?.name || show.artistName}
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

        <div className="text-muted-foreground">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        {isToday ? <span className="font-semibold text-primary">Tonight</span> : <span>Tap to view show</span>}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onArtistClick();
          }}
          className="font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          View Artist
        </button>
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

