import React, { useState } from 'react';
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Music, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { MagicCard } from "./ui/magic-card";

interface MySpotifyArtistsProps {
  onArtistClick: (artistId: Id<"artists">, slug?: string) => void;
}

export function MySpotifyArtists({ onArtistClick }: MySpotifyArtistsProps) {
  const [showAll, setShowAll] = useState(false);
  // ENHANCED: Get ALL Spotify artists (both followed AND top listened-to) with shows
  const myArtists = useQuery(api.spotifyAuthQueries.getUserSpotifyArtists, { 
    limit: 50, 
    onlyWithShows: !showAll // Show only artists with upcoming shows unless "Show all" is toggled
  });
  const syncShows = useAction(api.ticketmaster.searchAndSyncArtistShows);

  // Sort: top artists first (by rank), then followed artists, then by show count
  const sortedArtists = myArtists?.sort((a, b) => {
    // Top artists always first, sorted by rank
    if (a.isTopArtist && !b.isTopArtist) return -1;
    if (!a.isTopArtist && b.isTopArtist) return 1;
    if (a.isTopArtist && b.isTopArtist) {
      return (a.topArtistRank || 999) - (b.topArtistRank || 999);
    }
    // Then by upcoming shows count
    return (b.upcomingShowsCount || 0) - (a.upcomingShowsCount || 0);
  }) || [];

  const filteredArtists = sortedArtists;

  const handleSyncShows = async (artistId: Id<"artists">, name: string) => {
    try {
      await syncShows({ artistId, artistName: name });
      toast.success("Syncing shows...");
    } catch (e) {
      toast.error("Sync failed");
    }
  };

  if (!myArtists || myArtists.length === 0) {
    return (
      <MagicCard className="p-6 text-center" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
        <Music className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold mb-2">Connect Your Spotify</h3>
        <p className="text-gray-400 mb-4">Import your followed artists to see their upcoming shows</p>
        <Button onClick={() => window.location.href = '/spotify-connect'}>
          Connect Spotify
        </Button>
      </MagicCard>
    );
  }

  return (
    <MagicCard className="p-0 rounded-2xl border-0 bg-black" style={{borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <Music className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">My Artists on Tour</h2>
              <p className="text-sm text-gray-400">
                Your most listened-to artists with upcoming shows ({filteredArtists.length} artists)
              </p>
            </div>
          </div>
          {/* Toggle */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Show all artists</span>
            <Switch checked={showAll} onCheckedChange={setShowAll} />
          </div>
        </div>

        <div className="space-y-0">
          {filteredArtists.length === 0 ? (
            <div className="text-center py-8">
              <Music className="h-12 w-12 mx-auto mb-3 text-gray-500" />
              <p className="text-gray-400 mb-2">
                {showAll ? "No artists found in your Spotify" : "None of your Spotify artists have upcoming shows"}
              </p>
              <p className="text-gray-500 text-xs">
                {showAll ? "Try connecting your Spotify again" : "Toggle 'Show all' to see all your artists"}
              </p>
            </div>
          ) : (
            filteredArtists.map((item) => (
              <div
                key={item.artist._id}
                onClick={() => onArtistClick(item.artist._id, item.artist.slug)}
                className="flex items-center justify-between py-3 px-0 hover:bg-white/5 cursor-pointer transition-all touch-manipulation min-h-[44px]"
                style={{
                  borderBottom: filteredArtists.length > 1 && item !== filteredArtists[filteredArtists.length - 1] ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative">
                    <img 
                      src={item.artist.images?.[0]} 
                      alt={item.artist.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    {/* Badge for top artists */}
                    {item.isTopArtist && item.topArtistRank && item.topArtistRank <= 5 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-black">
                        {item.topArtistRank}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm truncate">{item.artist.name}</p>
                      {item.isFollowed && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">Followed</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.isTopArtist && (
                        <p className="text-green-400 text-xs">Top #{item.topArtistRank}</p>
                      )}
                      <p className="text-gray-400 text-xs">
                        {item.upcomingShowsCount} {item.upcomingShowsCount === 1 ? 'show' : 'shows'}
                      </p>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); handleSyncShows(item.artist._id, item.artist.name); }}
                  className="mr-2"
                  title="Refresh shows"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </MagicCard>
  );
}
