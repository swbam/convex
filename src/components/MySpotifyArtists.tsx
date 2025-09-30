import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';
import { Music, Calendar, Star } from 'lucide-react';

interface MySpotifyArtistsProps {
  onArtistClick: (artistId: Id<"artists">, slug?: string) => void;
}

export function MySpotifyArtists({ onArtistClick }: MySpotifyArtistsProps) {
  const myArtists = useQuery(api.spotifyAuth.getUserSpotifyArtists, { 
    limit: 20,
    onlyWithShows: true 
  });

  if (!myArtists) {
    return (
      <MagicCard className="p-6 rounded-2xl border-0 bg-black" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded" />
          ))}
        </div>
      </MagicCard>
    );
  }

  if (myArtists.length === 0) {
    return (
      <MagicCard className="p-6 rounded-2xl border-0 bg-black" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
        <div className="text-center py-8">
          <Music className="h-12 w-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-semibold text-white mb-2">No Upcoming Shows</h3>
          <p className="text-sm text-gray-400">
            None of your Spotify artists have upcoming shows yet
          </p>
        </div>
      </MagicCard>
    );
  }

  return (
    <MagicCard className="p-0 rounded-2xl border-0 bg-black" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
            <Music className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">My Artists on Tour</h2>
            <p className="text-sm text-gray-400">From your Spotify account</p>
          </div>
        </div>

        <div className="space-y-0">
          {myArtists.map((item, idx) => (
            <div
              key={item.artist._id}
              onClick={() => onArtistClick(item.artist._id, item.artist.slug)}
              className="flex items-center justify-between py-3 px-0 hover:bg-white/5 cursor-pointer transition-all min-h-[44px]"
              style={{
                borderBottom: idx < myArtists.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
              }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {item.artist.images?.[0] && (
                  <img
                    src={item.artist.images[0]}
                    alt={item.artist.name}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white truncate text-sm sm:text-base">
                      {item.artist.name}
                    </h3>
                    {item.isTopArtist && (
                      <Star className="h-3 w-3 text-yellow-400 fill-current flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    <span>{item.upcomingShowsCount} upcoming {item.upcomingShowsCount === 1 ? 'show' : 'shows'}</span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500">›</div>
            </div>
          ))}
        </div>
      </div>
      <BorderBeam size={120} duration={10} className="opacity-20" />
    </MagicCard>
  );
}
