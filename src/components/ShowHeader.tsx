import React from 'react';
import { Calendar, MapPin, ExternalLink, Ticket } from 'lucide-react';
import { Id } from '../../convex/_generated/dataModel';
import { ShimmerButton } from './ui/shimmer-button';

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
    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl -mx-4 sm:mx-0 shadow-apple">
      {heroImage && (
        <div className="absolute inset-0 z-0">
          <img src={heroImage} alt="" className="w-full h-full object-cover opacity-20 blur-md scale-105" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/85 to-black" />
        </div>
      )}

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
          {heroImage && (
            <div className="flex-shrink-0">
              <img src={heroImage} alt={show?.artist?.name} className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-xl sm:rounded-2xl object-cover shadow-2xl ring-2 ring-white/10" />
            </div>
          )}
          <div className="flex-1 min-w-0 w-full sm:pb-2">
            <p className="text-xs font-semibold text-white/60 mb-1 sm:mb-2 uppercase tracking-widest">Concert</p>
            <button
              onClick={() => { if (show?.artistId) onArtistClick(show.artistId); }}
              className="text-2xl sm:text-3xl lg:text-5xl xl:text-6xl font-bold text-white hover:text-primary/90 transition-colors text-left mb-2 sm:mb-3 leading-tight tracking-tight"
            >
              {show?.artist?.name}
            </button>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-white/80 mb-3 sm:mb-4">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="font-medium">{show?.venue?.name}</span>
              </div>
              <span className="text-white/40">•</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="font-medium">{showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              {show?.startTime && (<>
                <span className="text-white/40">•</span>
                <span className="font-medium">{show?.startTime}</span>
              </>)}
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {isUpcoming && (
                <ShimmerButton
                  onClick={() => window.open(show?.ticketUrl ? show.ticketUrl : (origin || '#'), '_blank')}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white border-0 px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold"
                  shimmerColor="#60a5fa"
                >
                  <Ticket className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                  Get Tickets
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 ml-1.5 sm:ml-2" />
                </ShimmerButton>
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
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white rounded-lg text-xs sm:text-sm font-medium transition-all"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M15 8a3 3 0 10-6.976 2.224 1 1 0 01.435.179l.341.056a1 1 0 01.179.435c.086.24.24.435.435.179A3 3 0 0115 8zM5.5 13a2.5 2.5 0 01-.121-.535l-.745 1.149A2.5 2.5 0 005.5 15h3.179a1 1 0 01.435.179 1 1 0 01.179.435l.056.341A2.5 2.5 0 009 15.5V13a1 1 0 11-2 0v1.5a1 1 0 01-1 1 1 1 0 00-.179-.435l-.056-.341A2.5 2.5 0 005.5 13z" />
                </svg>
                <span className="hidden sm:inline">Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShowHeader;

