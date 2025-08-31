import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ShowCard } from "./ShowCard";
import { ArrowLeft, MapPin, Users, Calendar, Clock } from "lucide-react";

interface VenueDetailProps {
  venueId: Id<"venues">;
  onBack: () => void;
  onShowClick: (showId: Id<"shows">, slug?: string) => void;
}

export function VenueDetail({ venueId, onBack, onShowClick }: VenueDetailProps) {
  const venue = useQuery(api.venues.getById, { id: venueId });
  const venueShows = useQuery(api.shows.getByVenue, venue ? { venueId } : "skip");

  if (!venue) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-32"></div>
          <div className="h-64 bg-muted rounded"></div>
          <div className="h-6 bg-muted rounded w-48"></div>
        </div>
      </div>
    );
  }

  const upcomingShows = venueShows?.filter(show => show.status === "upcoming") || [];
  const pastShows = venueShows?.filter(show => show.status === "completed") || [];

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Venues
      </button>

      {/* Venue Header */}
      <div className="bg-black rounded-2xl p-6 border border-white/10">
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">{venue.name}</h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{venue.city}, {venue.country}</span>
              </div>
              {venue.capacity && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{venue.capacity.toLocaleString()} capacity</span>
                </div>
              )}
            </div>
          </div>

          {venue.address && (
            <div className="text-muted-foreground">
              <MapPin className="h-4 w-4 inline mr-2" />
              {venue.address}
            </div>
          )}

          {/* Venue Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/10 rounded-lg p-4">
              <div className="text-2xl font-bold">{venueShows?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Total Shows</div>
            </div>
            <div className="bg-muted/10 rounded-lg p-4">
              <div className="text-2xl font-bold">{upcomingShows.length}</div>
              <div className="text-sm text-muted-foreground">Upcoming</div>
            </div>
            <div className="bg-muted/10 rounded-lg p-4">
              <div className="text-2xl font-bold">{pastShows.length}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            {venue.capacity && (
              <div className="bg-muted/10 rounded-lg p-4">
                <div className="text-2xl font-bold">
                  {((venueShows?.length || 0) * 100 / (venue.capacity > 10000 ? 50 : venue.capacity > 5000 ? 100 : 150)).toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">Utilization</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Shows */}
        <div className="bg-black rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="h-5 w-5" />
            <h2 className="text-2xl font-bold">Upcoming Shows</h2>
            <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-sm">
              {upcomingShows.length}
            </span>
          </div>
          
          {upcomingShows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No upcoming shows scheduled</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingShows.slice(0, 5).map((show) => (
                <ShowCard
                  key={show._id}
                  show={show as any}
                  onClick={onShowClick}
                  compact={true}
                />
              ))}
              {upcomingShows.length > 5 && (
                <div className="text-center py-4">
                  <span className="text-sm text-muted-foreground">
                    +{upcomingShows.length - 5} more upcoming shows
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Past Shows */}
        <div className="bg-black rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="h-5 w-5" />
            <h2 className="text-2xl font-bold">Recent Shows</h2>
            <span className="bg-muted/20 text-muted-foreground px-2 py-1 rounded-full text-sm">
              {pastShows.length}
            </span>
          </div>
          
          {pastShows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No past shows recorded</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pastShows.slice(0, 5).map((show) => (
                <ShowCard
                  key={show._id}
                  show={show as any}
                  onClick={onShowClick}
                  compact={true}
                />
              ))}
              {pastShows.length > 5 && (
                <div className="text-center py-4">
                  <span className="text-sm text-muted-foreground">
                    +{pastShows.length - 5} more past shows
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
