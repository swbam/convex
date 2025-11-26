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
            className="w-full h-full object-cover opacity-30 blur-sm scale-105" 
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black/90" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6 max-w-6xl mx-auto">
          {/* Artist Image */}
          {heroImage && (
            <div className="flex-shrink-0">
              <img 
                src={heroImage} 
                alt={show?.artist?.name} 
                className="w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 rounded-xl sm:rounded-2xl object-cover shadow-2xl ring-2 ring-white/10" 
              />
            </div>
          )}
          
          {/* Info */}
          <div className="flex-1 min-w-0 w-full text-center sm:text-left sm:pb-1">
            {/* Label */}
            <p className="text-[10px] sm:text-xs font-semibold text-white/50 mb-1 uppercase tracking-widest">
              Concert
            </p>
            
            {/* Artist Name */}
            <button
              onClick={() => { if (show?.artistId) onArtistClick(show.artistId); }}
              className="text-xl sm:text-2xl lg:text-4xl xl:text-5xl font-bold text-white hover:text-primary/90 transition-colors leading-tight tracking-tight"
            >
              {show?.artist?.name}
            </button>
            
            {/* Meta Info */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-[11px] sm:text-sm text-white/70 mt-2 sm:mt-3">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="font-medium truncate max-w-[150px] sm:max-w-none">{show?.venue?.name}</span>
              </div>
              <span className="text-white/30 hidden sm:inline">•</span>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="font-medium">
                  {showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              {show?.startTime && (
                <>
                  <span className="text-white/30 hidden sm:inline">•</span>
                  <span className="font-medium">{show?.startTime}</span>
                </>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-3 mt-4">
              {isUpcoming && (
                <button
                  onClick={() => window.open(show?.ticketUrl ? show.ticketUrl : (origin || '#'), '_blank')}
                  className="flex items-center px-4 py-2 sm:px-5 sm:py-2.5 bg-white hover:bg-gray-100 text-black font-semibold rounded-lg sm:rounded-xl text-xs sm:text-sm transition-all duration-200 shadow-lg"
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
                className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-lg text-xs sm:text-sm font-medium transition-all border border-white/10"
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
