import React from 'react';
import { motion } from 'framer-motion';
import { Id } from "../../convex/_generated/dataModel";
import { Calendar, MapPin, ChevronRight, Ticket } from "lucide-react";
import { formatLocation, formatShowTime, parseShowCalendarDate } from "../lib/utils";
import { cn } from "../lib/utils";
import { capture } from "../lib/analytics";
import { buildTicketmasterAffiliateUrl } from "../utils/ticketmaster";

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

  const handleTicketClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (show.ticketUrl) {
      capture("ticket_link_clicked", {
        show_id: show._id || show.showId,
        artist_id: show.artistId || show.artist?._id,
        venue_id: show.venueId || show.venue?._id,
        show_date: show.date,
        placement: "show_card",
        provider: "ticketmaster",
        affiliate: true,
      });
      window.open(buildTicketmasterAffiliateUrl(show.ticketUrl), '_blank', 'noopener,noreferrer');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle keys targeted at the card itself — nested interactive
    // elements (e.g. the Tickets button) keep their native activation.
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const dateInfo = formatDate(show.date);
  const time = getTime();

  return (
    <motion.div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group relative overflow-hidden touch-manipulation cursor-pointer transition-all duration-200",
        // Keyboard focus
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset rounded-xl",
        // Mobile: simple border bottom for list feel
        "border-b border-border/50 last:border-b-0",
        // Desktop: glow card styling
        "sm:glow-card-sm sm:glow-card-hover sm:border-0"
      )}
    >
      <div className="flex items-center gap-3 p-3 sm:p-4 min-h-[72px]">
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
        <div className="flex-1 min-w-0">
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
        </div>

        {/* Actions - Compact Right Side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {show.ticketUrl && (
            <button
              onClick={handleTicketClick}
              aria-label="Buy tickets"
              className="min-h-[44px] min-w-[44px] px-3 rounded-full bg-secondary hover:bg-secondary/80 active:bg-secondary/60 transition-colors text-xs font-medium text-foreground flex items-center justify-center gap-1.5 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Ticket className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tickets</span>
            </button>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}

export const ShowCard = React.memo(ShowCardComponent);
