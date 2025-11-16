import React from 'react';
import { motion } from 'framer-motion';
import { Id } from "../../convex/_generated/dataModel";
import { Calendar, MapPin, ChevronRight, Ticket } from "lucide-react";

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
    const date = new Date(dateStr);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    return { month, day, weekday, full: `${weekday}, ${month} ${day}` };
  };

  const getTime = () => {
    if (!show.startTime) return null;
    const [hours, minutes] = show.startTime.split(':');
    if (!hours || !minutes) return null;
    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const handleTicketClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (show.ticketUrl) {
      window.open(show.ticketUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const dateInfo = formatDate(show.date);
  const time = getTime();

  return (
    <motion.div
      onClick={handleClick}
      whileTap={{ scale: 0.98 }}
      className="group relative overflow-hidden touch-manipulation bg-card border-b border-white/5 last:border-b-0 sm:border sm:border-white/10 sm:rounded-xl cursor-pointer active:bg-white/5 transition-all duration-150"
    >
      <div className="flex items-center gap-3 p-3 sm:p-4 min-h-[72px]">
        {/* Date Badge - Compact */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-white/5 ring-1 ring-white/10 flex flex-col items-center justify-center">
            <span className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase leading-none">
              {dateInfo.month}
            </span>
            <span className="text-lg sm:text-xl text-white font-bold leading-none mt-0.5">
              {dateInfo.day}
            </span>
          </div>
        </div>

        {/* Content - Compact Info */}
        <div className="flex-1 min-w-0">
          {showArtist && show.artist?.name && (
            <h3 className="text-white font-semibold text-base leading-tight line-clamp-1 mb-0.5">
              {show.artist.name}
            </h3>
          )}
          
          <div className="flex flex-col gap-0.5 text-xs text-gray-400">
            {/* Venue */}
            {show.venue && (
              <div className="flex items-center gap-1.5 line-clamp-1">
                <MapPin className="h-3 w-3 flex-shrink-0 text-gray-500" />
                <span className="line-clamp-1">
                  {show.venue.name}
                  {show.venue.city && `, ${show.venue.city}`}
                </span>
              </div>
            )}
            
            {/* Date & Time */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0 text-gray-500" />
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
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-xs font-medium text-white flex items-center gap-1.5 touch-manipulation"
            >
              <Ticket className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tickets</span>
            </button>
          )}
          <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}

export const ShowCard = React.memo(ShowCardComponent);
