import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, MapPin } from 'lucide-react';

interface TrendingSliderProps {
  items: any[];
  type: 'artists' | 'shows';
  direction?: 'left' | 'right';
  onItemClick: (item: any) => void;
  speed?: number; // Duration in seconds for one complete cycle
}

export function TrendingSlider({
  items,
  type,
  direction = 'left',
  onItemClick,
  speed = 60 // Very slow, smooth speed (60 seconds for one cycle)
}: TrendingSliderProps) {
  const [isPaused, setIsPaused] = useState(false);

  // Triple the items for seamless infinite loop
  const displayItems = [...items, ...items, ...items];

  // Calculate animation duration based on number of items and speed
  const animationDuration = speed;

  // Direction multiplier
  const directionMultiplier = direction === 'left' ? -1 : 1;

  return (
    <div
      className="relative w-full overflow-hidden py-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Fade out gradient on left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-24 md:w-32 lg:w-48 z-10 pointer-events-none bg-gradient-to-r from-black via-black/50 to-transparent" />

      {/* Fade out gradient on right edge */}
      <div className="absolute right-0 top-0 bottom-0 w-24 md:w-32 lg:w-48 z-10 pointer-events-none bg-gradient-to-l from-black via-black/50 to-transparent" />

      <motion.div
        className="flex gap-4"
        animate={{
          x: isPaused ? undefined : `${directionMultiplier * 33.33}%`, // Move by one-third (one set of items)
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: animationDuration,
            ease: "linear",
          },
        }}
        style={{
          width: 'fit-content',
        }}
      >
        {displayItems.map((item, index) => (
          <div
            key={`${item._id || item.ticketmasterId || index}-${index}`}
            className="flex-shrink-0"
          >
            {type === 'artists' ? (
              <ArtistSliderCard artist={item} onClick={() => onItemClick(item)} />
            ) : (
              <ShowSliderCard show={item} onClick={() => onItemClick(item)} />
            )}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// Compact artist card for slider
function ArtistSliderCard({ artist, onClick }: { artist: any; onClick: () => void }) {
  return (
    <motion.div
      className="w-48 md:w-56 cursor-pointer transform-gpu will-change-transform"
      onClick={onClick}
      whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
        {/* Artist Image */}
        <div className="relative w-full aspect-square overflow-hidden">
          {artist.images?.[0] ? (
            <img
              src={artist.images[0]}
              alt={artist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
              <span className="text-white/80 font-bold text-3xl">
                {(typeof artist?.name === 'string' && artist.name.length > 0 ? artist.name : '??').slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-3 space-y-1">
          <h3 className="text-white font-bold text-sm leading-tight line-clamp-1">
            {artist.name}
          </h3>
          <div className="flex items-center justify-between text-xs">
            <p className="text-gray-400">
              {artist.upcomingShowsCount || artist.upcomingEvents || 0} shows
            </p>
            {artist.genres?.[0] && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/70 border border-white/10 truncate max-w-[80px]">
                {artist.genres[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Compact show card for slider
function ShowSliderCard({ show, onClick }: { show: any; onClick: () => void }) {
  const showDate = new Date(show.date);

  return (
    <motion.div
      className="w-64 md:w-72 cursor-pointer transform-gpu will-change-transform"
      onClick={onClick}
      whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="glass-card rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
        {/* Show Image */}
        <div className="relative w-full aspect-[16/9] overflow-hidden">
          {(() => {
            const imgSrc = show?.artist?.images?.[0] || show?.artistImage || show?.cachedTrending?.artistImage;
            return imgSrc ? (
              <img
                src={imgSrc}
                alt={show.artist?.name || show.artistName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                <span className="text-white/80 font-bold text-2xl">
                  {((show?.artist?.name || show?.artistName || '??') as string).slice(0, 2).toUpperCase()}
                </span>
              </div>
            );
          })()}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

          {/* Date Badge */}
          <div className="absolute top-2 right-2">
            <div className="glass-card rounded-lg px-2 py-1 text-white text-xs font-bold">
              {showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-1">
          <h3 className="text-white font-bold text-sm leading-tight line-clamp-1">
            {show.artist?.name || show.artistName}
          </h3>
          {(show.venue || show.venueName) && (
            <div className="space-y-0.5">
              <p className="text-gray-400 text-xs flex items-center gap-1.5">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{show.venue?.name || show.venueName}</span>
              </p>
              <p className="text-gray-500 text-xs pl-4">
                {show.venue?.city || show.venueCity}{(show.venue?.state || show.venueState) ? `, ${show.venue?.state || show.venueState}` : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
