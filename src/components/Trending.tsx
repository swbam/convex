import { PageHeader } from "./PageHeader";
import { ArtistDiscoveryCard, ShowDiscoveryCard, DiscoverySkeleton } from "./discovery/DiscoveryCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { TrendingUp, Music, MapPin, Calendar, Clock, ChevronRight, Users, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useArtistImport, useShowImport } from '../hooks/useArtistImport';
import { formatLocation } from '../lib/utils';


interface TrendingProps {
  onArtistClick: (artistKey: Id<'artists'> | string, slug?: string) => void;
  onShowClick: (showKey: Id<'shows'> | string, slug?: string) => void;
}

export function Trending({ onArtistClick, onShowClick }: TrendingProps) {
  const [activeTab, setActiveTab] = useState<'artists' | 'shows' | 'setlists'>('artists');

  // Import hooks for triggering full artist/show sync
  const { handleArtistClick: importArtist, importingArtist } = useArtistImport();
  const { handleShowClick: importShow, importingShow } = useShowImport();

  // Get trending data directly from main tables with trending ranks!
  const trendingArtists = useQuery(api.trending.getTrendingArtists, { limit: 20 });
  const trendingShows = useQuery(api.trending.getTrendingShows, { limit: 20 });
  const trendingSetlists = useQuery(api.activity.getTrendingSetlists, { limit: 20 });

  // Get recent activity/updates
  const recentActivity = useQuery(api.shows.getRecentlyUpdated, { limit: 10 });

  // Handler that triggers import if artist not in DB
  const handleArtistClick = async (artist: any) => {
    await importArtist(artist, onArtistClick);
  };

  // Handler that triggers import if show not in DB
  const handleShowClick = async (show: any) => {
    await importShow(show, onShowClick);
  };

  const tabs = [
    { id: 'artists', label: 'Artists', icon: Music },
    { id: 'shows', label: 'Shows', icon: Calendar },
    { id: 'setlists', label: 'Setlists', icon: Music },
  ] as const;

  return (
    <Tabs value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)} className="public-page space-y-6 relative z-10">
      <PageHeader title="Trending" description="Explore popular artists, upcoming shows, and fan setlists." />

      {/* Streamlined Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Tab Navigation */}
        <TabsList aria-label="Trending content">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
              <tab.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{trendingArtists?.page?.length || 0} artists</span>
          <span>•</span>
          <span>{trendingShows?.page?.length || 0} shows</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3">
          <TabsContent value="artists" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0 sm:gap-4">
              {!trendingArtists ? (
                <DiscoverySkeleton count={10} />
              ) : (!Array.isArray(trendingArtists.page) || trendingArtists.page.length === 0) ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trending artists data available</p>
                </div>
              ) : (
                trendingArtists.page.map((artist: any, index: number) => (
                  <ArtistDiscoveryCard
                    key={artist._id || index}
                    artist={artist}
                    rank={index + 1}
                    onClick={() => handleArtistClick(artist)}
                    isImporting={importingArtist === artist.ticketmasterId}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="shows" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0 sm:gap-4">
              {!trendingShows ? (
                <DiscoverySkeleton count={10} />
              ) : (!Array.isArray(trendingShows.page) || trendingShows.page.length === 0) ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trending shows data available</p>
                </div>
              ) : (
                trendingShows.page.map((show: any, index: number) => (
                  <ShowDiscoveryCard
                    key={show._id || index}
                    show={show}
                    rank={index + 1}
                    onClick={() => handleShowClick(show)}
                    isImporting={importingShow === (show.ticketmasterId || show.artistTicketmasterId)}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="setlists" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!trendingSetlists ? (
                [...Array(8)].map((_, i) => (
                  <div key={i} className="glow-card p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-secondary rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-secondary rounded w-3/4" />
                        <div className="h-3 bg-secondary rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))
              ) : (!Array.isArray(trendingSetlists) || trendingSetlists.length === 0) ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trending setlists available</p>
                </div>
              ) : (
                trendingSetlists.map((setlist: any, index: number) => (
                  <button type="button"
                    key={setlist._id}
                    className="content-card p-3 text-left focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      const showId = setlist.show?._id ?? setlist._id;
                      const showSlug = setlist.show?.slug as string | undefined;
                      onShowClick(showId, showSlug);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                        {setlist.artist?.images?.[0] ? (
                          <img
                            src={setlist.artist.images[0]}
                            alt={setlist.artist?.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-secondary flex items-center justify-center">
                            <Music className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-sm truncate">{setlist.artist?.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {setlist.venue?.name} • {setlist.songs?.length ?? 0} songs
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-secondary px-2 py-1 rounded-full text-muted-foreground">
                          #{index + 1}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </TabsContent>
        </div>

        {/* Sidebar - Recent Activity */}
        <div className="lg:col-span-1">
          <div className="glow-card p-4 sticky top-20">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
            </div>

            {!recentActivity ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse p-2 rounded-lg bg-secondary">
                    <div className="h-3 bg-secondary rounded w-3/4 mb-1" />
                    <div className="h-2 bg-secondary rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.slice(0, 6).map((activity, index) => (
                  <button type="button"
                    key={index}
                    className="w-full p-2 text-left hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => handleShowClick(activity)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate font-medium">
                          {activity.artist?.name || 'Unknown'}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {activity.venue?.name || 'Unknown Venue'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Tabs>
  );
}
