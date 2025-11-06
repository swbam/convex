import React from 'react';
import { motion } from 'framer-motion';
import { Id } from "../../convex/_generated/dataModel";
import { Calendar, MapPin, Ticket } from "lucide-react";
import { Button } from "./ui/button";

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
    // Simple, clean extraction - database has proper slugs
    const showId = show._id || show.showId || '';
    const slug = show.slug || show.showSlug || show.cachedTrending?.showSlug || '';
    
    onClick(showId as Id<"shows">, slug);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getTime = () => {
    if (!show.startTime) return null;
    const [hours, minutes] = show.startTime.split(':');
    if (!hours || !minutes) return null;
    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  if (compact) {
    return (
      <motion.div
        onClick={handleClick}
        className="group cursor-pointer relative overflow-hidden touch-manipulation bg-black rounded-md p-3"
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm line-clamp-1">{show.artist?.name}</p>
            <p className="text-gray-400 text-xs">{formatDate(show.date)}</p>
          </div>
          {show.venue && (
            <div className="ml-3 text-right">
              <p className="text-gray-400 text-xs">{show.venue.name}</p>
              <p className="text-muted-foreground text-xs">{show.venue.city}</p>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      onClick={handleClick}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-xl bg-card shadow-apple hover:shadow-apple-hover cursor-pointer transform-gpu will-change-transform"
    >
      {/* Image */}
      {showArtist && show.artist?.images?.[0] && (
        <img
          src={show.artist.images[0]}
          alt={show.artist?.name || 'Show'}
          className="w-full h-48 object-cover transform-gpu will-change-transform group-hover:scale-105 transition-transform duration-500"
        />
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/20 to-transparent" />

      {/* Content overlay */}
      <div className="absolute bottom-3 left-4 right-4">
        {showArtist && (
          <h3 className="text-lg font-bold text-foreground line-clamp-1">
            {show.artist?.name}
          </h3>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(show.date)}</span>
          </div>
          {getTime() && <span>• {getTime()}</span>}
          {show.venue && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span className="line-clamp-1">{show.venue.name}, {show.venue.city}</span>
            </div>
          )}
        </div>
      </div>

      {/* Ticket CTA */}
      {show.ticketUrl && (
        <div className="absolute top-3 right-3">
          <Button
            variant="secondary"
            size="sm"
            asChild
            className="rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <a href={show.ticketUrl} target="_blank" rel="noopener noreferrer">
              <Ticket className="h-4 w-4 mr-1.5" />
              Tickets
            </a>
          </Button>
        </div>
      )}
    </motion.div>
  );
}

export const ShowCard = React.memo(ShowCardComponent);
