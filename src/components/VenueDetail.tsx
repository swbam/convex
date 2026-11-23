import { useDetailMedia } from "../lib/useDetailMedia";
import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { ShowCard } from "./ShowCard";
import { ArrowLeft, MapPin, Users, Calendar, Clock, Building2 } from "lucide-react";
import { MagicCard } from "./ui/magic-card";
import { DetailPageSkeleton, DetailRowsSkeleton } from "./LoadingSkeleton";
import { formatLocation } from "../lib/utils";
import { capture } from "../lib/analytics";


interface VenueDetailProps {
  venueId: Id<"venues">;
  venueData?: Doc<"venues">;
  onBack: () => void;
  onShowClick: (showId: Id<"shows">, slug?: string) => void;
}

export function VenueDetail({ venueId, venueData, onBack, onShowClick }: VenueDetailProps) {
  const media = useDetailMedia("venue", venueId);
  const heroImage = media?.heroUrl;
  const queriedVenue = useQuery(api.venues.getById, venueData ? "skip" : { id: venueId });
  const venue = venueData ?? queriedVenue;
  const venueShows = useQuery(api.shows.getByVenue, { venueId });
  const trackedVenueId = React.useRef<string | null>(null);
  const [upcomingLimit, setUpcomingLimit] = React.useState(10);
  const [pastLimit, setPastLimit] = React.useState(10);
  React.useEffect(() => { setUpcomingLimit(10); setPastLimit(10); }, [venueId]);

  React.useEffect(() => {
    if (!venue || venueShows === undefined || trackedVenueId.current === venue._id) {
      return;
    }
    trackedVenueId.current = venue._id;
    capture("venue_viewed", {
      venue_id: venue._id,
      venue_name: venue.name,
      venue_city: venue.city,
      venue_state: venue.state,
      venue_country: venue.country,
      venue_capacity: venue.capacity,
      upcoming_show_count: venueShows.filter((show) => show.status === "upcoming").length,
      completed_show_count: venueShows.filter((show) => show.status === "completed").length,
    });
  }, [venue, venueShows]);

  if (venue === undefined) return <DetailPageSkeleton kind="venue" />;
  if (!venue) return <p className="py-12 text-center">Venue not found.</p>;

  const upcomingShows = venueShows?.filter(show => show.status === "upcoming") || [];
  const pastShows = venueShows?.filter(show => show.status === "completed") || [];

  return (
    <>

    <div className="public-page space-y-4 sm:space-y-8">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 min-h-[44px] text-muted-foreground hover:text-foreground transition-colors text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Venue Header - Consistent with other pages */}
      <MagicCard className="relative overflow-hidden rounded-xl sm:rounded-xl p-0 border border-border bg-card">
        {heroImage && <>
          <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-background/80" />
        </>}
        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-row items-start sm:items-end gap-4 sm:gap-6">
            {/* Info */}
            <div className="flex-1 min-w-0 w-full text-left sm:pb-1">
              {/* Label */}
              <p className="text-[10px] sm:text-xs font-semibold text-foreground/50 mb-1 uppercase tracking-widest">
                Venue
              </p>

              {/* Venue Name */}
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-foreground leading-tight tracking-tight">
                {venue.name}
              </h1>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center justify-start gap-2 sm:gap-3 text-[11px] sm:text-sm text-foreground/70 mt-2 sm:mt-3">
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

          <div className="flex min-h-5 flex-wrap gap-x-5 gap-y-2 mt-4 text-sm text-muted-foreground">
            {upcomingShows.length > 0 && <span><strong className="text-foreground font-medium">{upcomingShows.length}</strong> upcoming shows</span>}
            {pastShows.length > 0 && <span><strong className="text-foreground font-medium">{pastShows.length}</strong> past shows</span>}
          </div>
        </div>

      </MagicCard>

      {venueShows === undefined && <DetailRowsSkeleton />}

      {/* Content Grid - Mobile Optimized */}
      <div className={`grid grid-cols-1 ${upcomingShows.length && pastShows.length ? "lg:grid-cols-2" : ""} gap-2 sm:gap-6 lg:gap-8`}>
        {/* Upcoming Shows */}
        {(upcomingShows.length > 0 || (!pastShows.length && venueShows !== undefined)) && <MagicCard className="p-0 rounded-xl sm:rounded-xl border border-border bg-card">
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-secondary rounded-lg sm:rounded-xl flex items-center justify-center">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
              </div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Upcoming Shows</h2>
              {upcomingShows.length > 0 && <span className="bg-secondary text-foreground px-2 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium">
                {upcomingShows.length}
              </span>}
            </div>

            {upcomingShows.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base">No upcoming shows scheduled</p>
              </div>
            ) : (
              <div className="space-y-0 sm:space-y-4">
                {upcomingShows.slice(0, upcomingLimit).map((show) => (
                  <ShowCard
                    key={show._id}
                    show={show as any}
                    onClick={onShowClick}
                    compact={true}
                  />
                ))}
                {upcomingShows.length > upcomingLimit && (
                  <div className="text-center py-3 sm:py-4">
                    <button type="button" className="min-h-[44px] px-4 text-sm font-medium" onClick={() => setUpcomingLimit(count => count + 20)}>Show more upcoming shows</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </MagicCard>}

        {/* Past Shows */}
        {pastShows.length > 0 && <MagicCard className="p-0 rounded-xl sm:rounded-xl border border-border bg-card">
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-secondary rounded-lg sm:rounded-xl flex items-center justify-center">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
              </div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Recent Shows</h2>
              {pastShows.length > 0 && <span className="bg-secondary text-muted-foreground px-2 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium">
                {pastShows.length}
              </span>}
            </div>

            {pastShows.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <Clock className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base">No past shows recorded</p>
              </div>
            ) : (
              <div className="space-y-0 sm:space-y-4">
                {pastShows.slice(0, pastLimit).map((show) => (
                  <ShowCard
                    key={show._id}
                    show={show as any}
                    onClick={onShowClick}
                    compact={true}
                  />
                ))}
                {pastShows.length > pastLimit && (
                  <div className="text-center py-3 sm:py-4">
                    <button type="button" className="min-h-[44px] px-4 text-sm font-medium" onClick={() => setPastLimit(count => count + 20)}>Show more past shows</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </MagicCard>}
      </div>
    </div>
    </>
  );
}
