import { TicketLink } from "./TicketLink";
import React from 'react';
import { motion } from 'framer-motion';
import { Id } from "../../convex/_generated/dataModel";
import { Calendar, MapPin, ChevronRight, Ticket } from "lucide-react";
import { formatLocation, formatShowTime, parseShowCalendarDate } from "../lib/utils";
import { cn } from "../lib/utils";

interface ShowCardProps {
  show: any;
  onClick: (showId: Id<"shows">, slug?: string) => void;
  showArtist?: boolean;
  compact?: boolean;
}

function ShowCardComponent({ 
  show, 
  onClick, 
  showArtist = true, 
  compact = false 
}: ShowCardProps) {
  const handleClick = () => {
    const showId = show._id || show.showId || '';
    const rawSlug = show.slug || show.showSlug || show.cachedTrending?.showSlug;
    const slug = typeof rawSlug === 'string' ? rawSlug : undefined;
    onClick(showId as Id<"shows">, slug);
  };

  const formatDate = (dateStr: string) => {
    const date = parseShowCalendarDate(dateStr);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    return { month, day, weekday, full: `${weekday}, ${month} ${day}` };
  };

  const getTime = () => {
    return formatShowTime(show.startTime, show.venue?.state);
  };

  const dateInfo = formatDate(show.date);
  const time = getTime();

  return (
    <motion.article
      className={cn(
        "group relative overflow-hidden touch-manipulation cursor-pointer transition-all duration-200",
        // Keyboard focus
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-none sm:rounded-xl",
        // Mobile: simple border bottom for list feel
        "border-b border-border last:border-b-0",
        // Desktop: shared panel styling
        "interactive-row sm:glow-card-sm"
      )}
    >
      <div className="flex items-center gap-3 px-0 py-3 sm:p-4 min-h-[72px]">
        {/* Date Badge - Compact */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-secondary ring-1 ring-border flex flex-col items-center justify-center">
            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase leading-none">
              {dateInfo.month}
            </span>
            <span className="text-lg sm:text-xl text-foreground font-bold leading-none mt-0.5">
              {dateInfo.day}
            </span>
          </div>
        </div>

        {/* Content - Compact Info */}
        <a href={`/shows/${encodeURIComponent(show.slug || show.showSlug || show.cachedTrending?.showSlug || show._id || show.showId)}`} onClick={(event) => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); handleClick(); } }} className="flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {showArtist && show.artist?.name && (
            <h3 className="text-foreground font-semibold text-base leading-tight line-clamp-1 mb-0.5">
              {show.artist.name}
            </h3>
          )}
          
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {/* Venue */}
            {show.venue && (
              <div className="flex items-center gap-1.5 line-clamp-1">
                <MapPin className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                <span className="line-clamp-1">
                  {show.venue?.name || show.venueName}
                  {(show.venue?.city || show.venueCity) && ` · ${formatLocation(show.venue?.city || show.venueCity, show.venue?.state || show.venueState)}`}
                </span>
              </div>
            )}
            
            {/* Date & Time */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              <span>
                {dateInfo.weekday}
                {time && ` • ${time}`}
              </span>
            </div>
          </div>
        </a>

        {/* Actions - Compact Right Side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {show.ticketUrl && show.status === "upcoming" && (
            <TicketLink href={show.ticketUrl} placement="show_card" properties={{ show_id: show._id || show.showId, artist_id: show.artistId || show.artist?._id, venue_id: show.venueId || show.venue?._id, show_date: show.date }} className="min-h-[44px] min-w-[44px] px-3 rounded-full bg-secondary hover:bg-secondary/80 active:bg-secondary/60 transition-colors text-xs font-medium text-foreground flex items-center justify-center gap-1.5 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Buy tickets">
              <Ticket className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tickets</span>
            </TicketLink>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
        </div>
      </div>
    </motion.article>
  );
}

export const ShowCard = React.memo(ShowCardComponent);
