import React from 'react';
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Users, MapPin, Music, Sparkles } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { Id } from "../../convex/_generated/dataModel";
import { ArtistCardSkeleton, ShowCardSkeleton } from "./LoadingSkeleton";

interface PublicDashboardProps {
  onArtistClick: (artistKey: Id<"artists"> | string) => void;
  onShowClick: (showKey: Id<"shows"> | string) => void;
  onSignInRequired: () => void;
  navigate: (path: string) => void;
}

export function PublicDashboard({ onArtistClick, onShowClick, onSignInRequired, navigate }: PublicDashboardProps) {
  const navigateTo = useNavigate();

  // Load trending data directly from the optimized trending system
  const dbTrendingShowsResult = useQuery(api.trending.getTrendingShows, { limit: 20 });
  const dbTrendingArtistsResult = useQuery(api.trending.getTrendingArtists, { limit: 20 });
  
  // Extract page arrays from paginated results
  const dbTrendingShows = dbTrendingShowsResult?.page || [];
  const dbTrendingArtists = dbTrendingArtistsResult?.page || [];

  const isLoading = !dbTrendingShowsResult || !dbTrendingArtistsResult;

  return (
    <div className="w-full">
      {/* Hero Section with Search - Landing Page Style */}
      <section className="relative w-full py-16 md:py-24 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            {/* Headline */}
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">Live Concert Setlists</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                Discover Your Next
                <span className="block text-primary mt-2">Unforgettable Show</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
                Search trending artists, explore upcoming concerts, and vote on predicted setlists
              </p>
            </div>

            {/* Search Bar - Centered and Prominent */}
            <div className="max-w-2xl mx-auto pt-4">
              <SearchBar 
                onArtistClick={(key) => navigateTo(`/artists/${key}`)}
                onShowClick={(key) => navigateTo(`/shows/${key}`)}
                onVenueClick={(key) => navigateTo(`/venues/${key}`)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Content Sections */}
      <div className="container mx-auto px-4 space-y-16 pb-16">
        
        {/* Trending Artists Section */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">Trending Artists</h2>
                <p className="text-sm text-gray-400">Most popular artists with upcoming shows</p>
              </div>
            </div>
          </div>
          
          <div className="relative">
            {/* Horizontal Scroll Container */}
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory -mx-2 px-2">
              {isLoading ? (
                [...Array(6)].map((_, i) => <ArtistCardSkeleton key={i} />)
              ) : dbTrendingArtists.length === 0 ? (
                <div className="w-full flex flex-col items-center justify-center py-16 text-center">
                  <Music className="h-16 w-16 text-gray-700 mb-4" />
                  <p className="text-gray-400 text-lg">No artists found</p>
                  <p className="text-gray-500 text-sm mt-2">Check back soon for trending artists</p>
                </div>
              ) : (
                dbTrendingArtists.map(artist => (
                  <ArtistCard 
                    key={artist._id} 
                    artist={artist}
                    onClick={() => navigateTo(`/artists/${artist.slug}`)}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        {/* Trending Shows Section */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">Hottest Shows</h2>
                <p className="text-sm text-gray-400">Top upcoming concerts near you</p>
              </div>
            </div>
          </div>

          {/* Shows Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {isLoading ? (
              [...Array(8)].map((_, i) => <ShowCardSkeleton key={i} />)
            ) : dbTrendingShows.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <Music className="h-16 w-16 text-gray-700 mb-4" />
                <p className="text-gray-400 text-lg">No shows found</p>
                <p className="text-gray-500 text-sm mt-2">Check back soon for trending concerts</p>
              </div>
            ) : (
              dbTrendingShows.slice(0, 12).map(show => (
                <ShowCard 
                  key={show._id} 
                  show={show} 
                  onClick={() => navigateTo(`/shows/${show.slug}`)}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// Premium Artist Card - Fully Clickable
function ArtistCard({ artist, onClick }: {
  artist: any;
  onClick: () => void;
}) {
  return (
    <div 
      className="flex-shrink-0 w-64 snap-start group cursor-pointer"
      onClick={onClick}
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 transition-all duration-300 hover:scale-105 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 active:scale-95">
        {/* Artist Image */}
        <div className="relative w-full aspect-square overflow-hidden">
          {artist.images?.[0] ? (
            <img 
              src={artist.images[0]} 
              alt={artist.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <span className="text-white font-bold text-4xl">
                {artist.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <h3 className="text-white font-bold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {artist.name}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              {artist.upcomingShowsCount || 0} shows
            </p>
            {artist.genres?.[0] && (
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                {artist.genres[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Premium Show Card - Fully Clickable
function ShowCard({
  show,
  onClick,
}: {
  show: any;
  onClick: () => void;
}) {
  const showDate = new Date(show.date);
  const isUpcoming = showDate >= new Date();

  return (
    <div 
      className="group cursor-pointer"
      onClick={onClick}
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 transition-all duration-300 hover:scale-105 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 active:scale-95">
        {/* Show Image */}
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          {(show.artist?.images?.[0] || show.artistImage) ? (
            <img
              src={show.artist?.images?.[0] || show.artistImage}
              alt={show.artist?.name || show.artistName}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <span className="text-white font-bold text-3xl">
                {(show.artist?.name || show.artistName).slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          
          {/* Date Badge */}
          <div className="absolute top-3 right-3">
            <div className="bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
              <p className="text-white text-xs font-bold">
                {showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <h3 className="text-white font-bold text-base leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {show.artist?.name || show.artistName}
          </h3>
          {show.venue && (
            <div className="space-y-1">
              <p className="text-gray-400 text-sm flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{show.venue.name}</span>
              </p>
              <p className="text-gray-500 text-xs pl-5">
                {show.venue.city}{show.venue.state ? `, ${show.venue.state}` : ''}
              </p>
            </div>
          )}
          {show.priceRange && (
            <p className="text-xs text-primary font-semibold">
              {show.priceRange}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
