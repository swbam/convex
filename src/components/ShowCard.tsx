import React from 'react';
import { motion } from 'framer-motion';
import { Id } from "../../convex/_generated/dataModel";
import { Calendar, MapPin, Ticket } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/Card";

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
    onClick(show._id, show.slug);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getTime = () => {
    if (!show.startTime) return null;
    const [time] = show.startTime.split('T')[1]?.split('+') || [];
    return time ? new Date(`1970-01-01T${time}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
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
      className="group cursor-pointer relative overflow-hidden touch-manipulation h-full bg-black min-h-[192px] flex flex-col"
      style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <Card variant="show" imageSrc={showArtist && show.artist?.images?.[0]}>
        <div className="flex items-center gap-1 text-gray-400 text-sm mt-1">
          <Calendar className="h-3 w-3" />
          {formatDate(show.date)}
          {getTime() && (
            <>
              <span>•</span>
              {getTime()}
            </>
          )}
        </div>
        {show.venue && (
          <div className="flex items-center gap-1 text-gray-400 text-sm mt-1">
            <MapPin className="h-3 w-3" />
            <span>{show.venue.name}, {show.venue.city}</span>
          </div>
        )}
        {show.ticketUrl && (
          <Button variant="outline" size="sm" asChild className="w-full mt-2">
            <a href={show.ticketUrl} target="_blank" rel="noopener noreferrer">
              <Ticket className="h-4 w-4 mr-2" />
              Get Tickets
            </a>
          </Button>
        )}
      </Card>
    </motion.div>
  );
}

export const ShowCard = React.memo(ShowCardComponent);
