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
    <div className="relative overflow-hidden rounded-none sm:rounded-2xl bg-card">
      {/* Background Image with Overlay */}
      {heroImage && (
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImage} 
            alt="" 
            className="w-full h-full object-cover opacity-30 dark:opacity-30 blur-sm scale-105" 
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/70 to-background/90 dark:from-black/50 dark:via-black/70 dark:to-black/90" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10">
        {/* Always side-by-side layout - image left, text right */}
        <div className="flex flex-row items-center gap-3 sm:gap-5 lg:gap-6 max-w-6xl mx-auto">
          {/* Artist Image - smaller on mobile */}
          {heroImage && (
            <div className="flex-shrink-0">
              <img 
                src={heroImage} 
                alt={show?.artist?.name} 
                className="w-16 h-16 sm:w-24 sm:h-24 lg:w-32 lg:h-32 rounded-lg sm:rounded-xl lg:rounded-2xl object-cover shadow-xl ring-2 ring-border" 
              />
            </div>
          )}
          
          {/* Info - always left-aligned */}
          <div className="flex-1 min-w-0">
            {/* Label */}
            <p className="text-[9px] sm:text-xs font-semibold text-muted-foreground mb-0.5 sm:mb-1 uppercase tracking-widest">
              Concert
            </p>
            
            {/* Artist Name */}
            <button
              onClick={() => { if (show?.artistId) onArtistClick(show.artistId); }}
              className="text-lg sm:text-2xl lg:text-4xl font-bold text-foreground hover:text-primary transition-colors leading-tight tracking-tight text-left line-clamp-2"
            >
              {show?.artist?.name}
            </button>
            
            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-[10px] sm:text-sm text-muted-foreground mt-1 sm:mt-2">
              <div className="flex items-center gap-0.5 sm:gap-1">
                <MapPin className="h-2.5 w-2.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="font-medium truncate max-w-[100px] sm:max-w-none">{show?.venue?.name}</span>
              </div>
              <span className="text-muted-foreground/50">•</span>
              <div className="flex items-center gap-0.5 sm:gap-1">
                <Calendar className="h-2.5 w-2.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="font-medium">
                  {showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
            
            {/* Action Buttons - hidden on very small mobile, shown on sm+ */}
            <div className="hidden sm:flex flex-wrap gap-2 sm:gap-3 mt-3">
              {isUpcoming && (
                <button
                  onClick={() => window.open(show?.ticketUrl ? show.ticketUrl : (origin || '#'), '_blank')}
                  className="flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-xs sm:text-sm transition-all duration-200 shadow-lg"
                >
                  <Ticket className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                  Get Tickets
                  <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-1.5" />
                </button>
              )}
              <button
                onClick={() => {
                  const shareUrl = `${origin}/shows/${show?.slug}`;
                  if (typeof navigator !== 'undefined' && (navigator as any).share) {
                    void (navigator as any).share({ title: `${show?.artist?.name || ''} Concert`, url: shareUrl });
                  } else if (typeof navigator !== 'undefined') {
                    void navigator.clipboard.writeText(shareUrl);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs sm:text-sm font-medium transition-all border border-border"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShowHeader;
