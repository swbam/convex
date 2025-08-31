import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { VenueSearch } from './VenueSearch';
import { Search, MapPin, Users, Calendar, Filter } from 'lucide-react';

interface VenuesProps {
  onVenueClick?: (venueId: Id<'venues'>) => void;
}

export function Venues({ onVenueClick }: VenuesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'search' | 'all'>('search');

  // Get venues for "all" tab - we'll need to add a venues.getAll query
  const allVenues = useQuery(api.venues.search, { query: '', limit: 100 });

  const filteredVenues = React.useMemo(() => {
    if (!allVenues || !searchQuery) return allVenues || [];
    
    return allVenues.filter(venue => 
      venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      venue.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      venue.country.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allVenues, searchQuery]);

  const handleVenueClick = (venueId: Id<'venues'>) => {
    onVenueClick?.(venueId);
    // For now, just show venue details in console since venue detail page isn't implemented
    console.log('Venue clicked:', venueId);
  };

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Venues</h1>
          <p className="text-muted-foreground">
            Discover concert venues worldwide
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-black rounded-2xl p-6 border border-white/10">
        <div className="flex border-b border-border mb-6">
          <button
            onClick={() => setSelectedTab('search')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'search'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Search by Location
          </button>
          <button
            onClick={() => setSelectedTab('all')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Browse All Venues
          </button>
        </div>

        {selectedTab === 'search' ? (
          <VenueSearch />
        ) : (
          <div className="space-y-6">
            {/* Search within all venues */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                type="text"
                placeholder="Search venues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-muted/20 border border-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Venues List */}
            {!allVenues ? (
              // Loading state
              <div className="space-y-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
                    <div className="w-12 h-12 bg-muted rounded-lg animate-pulse"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse"></div>
                      <div className="h-3 bg-muted rounded w-2/3 animate-pulse"></div>
                      <div className="h-3 bg-muted rounded w-1/2 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredVenues.length === 0 ? (
              // No results
              <div className="text-center py-12">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No venues found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery 
                    ? 'Try adjusting your search terms'
                    : 'No venues available yet'
                  }
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredVenues.length} of {allVenues.length} venues
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      Clear search
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  {filteredVenues.map((venue) => (
                    <VenueListCard
                      key={venue._id}
                      venue={venue}
                      onClick={() => handleVenueClick(venue._id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Enhanced venue card for the venues listing
function VenueListCard({ venue, onClick }: { venue: any; onClick: () => void }) {
  return (
    <div 
      className="group cursor-pointer bg-card border border-border rounded-xl hover:bg-accent/30 transition-all duration-300 hover:scale-[1.01] p-6"
      onClick={onClick}
    >
      <div className="flex items-start gap-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <MapPin className="h-8 w-8 text-zinc-400" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-xl truncate group-hover:text-gray-300 transition-colors mb-1">
                {venue.name}
              </h3>
              <div className="flex items-center gap-1 text-muted-foreground text-sm mb-2">
                <MapPin className="h-4 w-4" />
                <span>{venue.city}, {venue.country}</span>
              </div>
              {venue.address && (
                <p className="text-sm text-muted-foreground truncate">
                  {venue.address}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            {venue.capacity && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="font-medium">{venue.capacity.toLocaleString()} capacity</span>
              </div>
            )}
            
            {/* TODO: Add show count when venue shows query is implemented */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">View shows</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}