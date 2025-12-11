import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ShowCard } from "./ShowCard";
import { ArrowLeft, MapPin, Users, Calendar, Clock, Building2 } from "lucide-react";
import { MagicCard } from "./ui/magic-card";
import { BorderBeam } from "./ui/border-beam";
import { motion } from "framer-motion";
import { formatLocation } from "../lib/utils";

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
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-secondary rounded w-32"></div>
          <div className="h-48 sm:h-64 bg-secondary rounded-xl"></div>
          <div className="h-6 bg-secondary rounded w-48"></div>
        </div>
      </div>
    );
  }

  const upcomingShows = venueShows?.filter(show => show.status === "upcoming") || [];
  const pastShows = venueShows?.filter(show => show.status === "completed") || [];

  return (
    <motion.div 
      className="container mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Venue Header - Consistent with other pages */}
      <MagicCard className="relative overflow-hidden rounded-xl sm:rounded-xl p-0 border border-border bg-card">
        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6">
            {/* Venue Icon */}
            <div className="flex-shrink-0">
              <div className="w-16 h-16 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-xl sm:rounded-xl flex items-center justify-center shadow-2xl ring-2 ring-border">
                <Building2 className="h-8 w-8 sm:h-12 sm:w-12 lg:h-14 lg:w-14 text-blue-400" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 w-full text-center sm:text-left sm:pb-1">
              {/* Label */}
              <p className="text-[10px] sm:text-xs font-semibold text-foreground/50 mb-1 uppercase tracking-widest">
                Venue
              </p>
              
              {/* Venue Name */}
              <h1 className="text-xl sm:text-2xl lg:text-4xl xl:text-5xl font-bold text-foreground leading-tight tracking-tight">
                {venue.name}
              </h1>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-[11px] sm:text-sm text-foreground/70 mt-2 sm:mt-3">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="font-medium">{formatLocation(venue.city, venue.state)}</span>
                </div>
                {venue.capacity && (
                  <>
                    <span className="text-foreground/30 hidden sm:inline">•</span>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="font-medium">{venue.capacity.toLocaleString()} capacity</span>
                    </div>
                  </>
                )}
              </div>

              {venue.address && (
                <p className="text-foreground/50 text-xs sm:text-sm mt-2 truncate max-w-md">
                  {venue.address}
                </p>
              )}
            </div>
          </div>

          {/* Venue Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
            <div className="bg-secondary rounded-lg sm:rounded-xl p-3 sm:p-4 border border-border">
              <div className="text-lg sm:text-2xl font-bold text-foreground">{venueShows?.length || 0}</div>
              <div className="text-[10px] sm:text-sm text-muted-foreground">Total Shows</div>
            </div>
            <div className="bg-secondary rounded-lg sm:rounded-xl p-3 sm:p-4 border border-border">
              <div className="text-lg sm:text-2xl font-bold text-foreground">{upcomingShows.length}</div>
              <div className="text-[10px] sm:text-sm text-muted-foreground">Upcoming</div>
            </div>
            <div className="bg-secondary rounded-lg sm:rounded-xl p-3 sm:p-4 border border-border">
              <div className="text-lg sm:text-2xl font-bold text-foreground">{pastShows.length}</div>
              <div className="text-[10px] sm:text-sm text-muted-foreground">Completed</div>
            </div>
            {venue.capacity && (
              <div className="bg-secondary rounded-lg sm:rounded-xl p-3 sm:p-4 border border-border">
                <div className="text-lg sm:text-2xl font-bold text-foreground">
                  {((venueShows?.length || 0) * 100 / (venue.capacity > 10000 ? 50 : venue.capacity > 5000 ? 100 : 150)).toFixed(0)}%
                </div>
                <div className="text-[10px] sm:text-sm text-muted-foreground">Utilization</div>
              </div>
            )}
          </div>
        </div>
        <BorderBeam size={150} duration={12} className="opacity-30" />
      </MagicCard>

      {/* Content Grid - Mobile Optimized */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {/* Upcoming Shows */}
        <MagicCard className="p-0 rounded-xl sm:rounded-xl border border-border bg-card">
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-secondary rounded-lg sm:rounded-xl flex items-center justify-center">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
              </div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Upcoming Shows</h2>
              <span className="bg-primary/20 text-primary px-2 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium">
                {upcomingShows.length}
              </span>
            </div>
            
            {upcomingShows.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base">No upcoming shows scheduled</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {upcomingShows.slice(0, 5).map((show) => (
                  <ShowCard
                    key={show._id}
                    show={show as any}
                    onClick={onShowClick}
                    compact={true}
                  />
                ))}
                {upcomingShows.length > 5 && (
                  <div className="text-center py-3 sm:py-4">
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      +{upcomingShows.length - 5} more upcoming shows
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <BorderBeam size={100} duration={10} className="opacity-20" />
        </MagicCard>

        {/* Past Shows */}
        <MagicCard className="p-0 rounded-xl sm:rounded-xl border border-border bg-card">
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-secondary rounded-lg sm:rounded-xl flex items-center justify-center">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
              </div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Recent Shows</h2>
              <span className="bg-secondary text-muted-foreground px-2 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium">
                {pastShows.length}
              </span>
            </div>
            
            {pastShows.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <Clock className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base">No past shows recorded</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {pastShows.slice(0, 5).map((show) => (
                  <ShowCard
                    key={show._id}
                    show={show as any}
                    onClick={onShowClick}
                    compact={true}
                  />
                ))}
                {pastShows.length > 5 && (
                  <div className="text-center py-3 sm:py-4">
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      +{pastShows.length - 5} more past shows
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <BorderBeam size={100} duration={10} className="opacity-20" />
        </MagicCard>
      </div>
    </motion.div>
  );
}
