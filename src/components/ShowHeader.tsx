import React from 'react';
import { Calendar, MapPin, ExternalLink, Ticket } from 'lucide-react';
import { Id } from '../../convex/_generated/dataModel';

export function ShowHeader({
  show,
  showDate,
  isUpcoming,
  heroImage,
  origin,
  onArtistClick,
}: {
  show: any;
  showDate: Date;
  isUpcoming: boolean;
  heroImage?: string;
  origin: string;
  onArtistClick: (artistId: Id<'artists'>) => void;
}) {
  return (
    <div className="relative w-full overflow-hidden bg-card">
      {/* Background Image with Overlay */}
      {heroImage && (
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImage} 
            alt="" 
            className="w-full h-full object-cover opacity-20 dark:opacity-30 blur-sm scale-105" 
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/60 dark:from-black/90 dark:via-black/70 dark:to-black/50" />
        </div>
      )}

      {/* Content - compact layout */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="flex flex-row items-center gap-4 sm:gap-6 max-w-6xl mx-auto">
          {/* Artist Image */}
          {heroImage && (
            <div className="flex-shrink-0">
              <img 
                src={heroImage} 
                alt={show?.artist?.name} 
                className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-lg object-cover shadow-lg ring-1 ring-border" 
              />
            </div>
          )}
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Artist Name - clickable */}
            <button
              onClick={() => { if (show?.artistId) onArtistClick(show.artistId); }}
              className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground hover:text-primary transition-colors leading-tight tracking-tight text-left line-clamp-1"
            >
              {show?.artist?.name}
            </button>
            
            {/* Venue & Date - single line */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-1">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                <span className="truncate max-w-[120px] sm:max-w-none">{show?.venue?.name}</span>
              </div>
              <span className="text-muted-foreground/40">•</span>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                <span>{showDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              </div>
              {show?.startTime && (
                <>
                  <span className="text-muted-foreground/40 hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{show?.startTime}</span>
                </>
              )}
            </div>
            
            {/* Get Tickets - inline on all sizes */}
            {isUpcoming && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => window.open(show?.ticketUrl ? show.ticketUrl : (origin || '#'), '_blank')}
                  className="inline-flex items-center px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md text-xs transition-all"
                >
                  <Ticket className="h-3 w-3 mr-1" />
                  Get Tickets
                </button>
                <button
                  onClick={() => {
                    const shareUrl = `${origin}/shows/${show?.slug}`;
                    if (typeof navigator !== 'undefined' && (navigator as any).share) {
                      void (navigator as any).share({ title: `${show?.artist?.name || ''} Concert`, url: shareUrl });
                    } else if (typeof navigator !== 'undefined') {
                      void navigator.clipboard.writeText(shareUrl);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-muted-foreground hover:text-foreground text-xs transition-all"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                  </svg>
                  Share
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShowHeader;
