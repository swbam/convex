import React, { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MagicCard } from './ui/magic-card';
import { BorderBeam } from './ui/border-beam';
import { ShimmerButton } from './ui/shimmer-button';
import { Database, Zap, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function AdminTest() {
  const [isPopulating, setIsPopulating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [recentShowsData, setRecentShowsData] = useState<any>(null);
  
  const populateTestData = useAction(api.maintenance.populateTestData);
  const triggerTrendingSync = useAction(api.maintenance.triggerTrendingSync);
  const checkRecentShows = useAction(api.maintenance.checkRecentShows);

  const handlePopulateData = async () => {
    setIsPopulating(true);
    try {
      await populateTestData();
      toast.success("Test data populated! Check /shows and /artists pages.");
    } catch (error) {
      console.error("Failed to populate data:", error);
      toast.error("Failed to populate test data");
    } finally {
      setIsPopulating(false);
    }
  };

  const handleSyncTrending = async () => {
    setIsSyncing(true);
    try {
      await triggerTrendingSync();
      toast.success("Trending data synced! Check homepage.");
    } catch (error) {
      console.error("Failed to sync trending data:", error);
      toast.error("Failed to sync trending data");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCheckRecentShows = async () => {
    setIsChecking(true);
    try {
      const data = await checkRecentShows();
      setRecentShowsData(data);
      toast.success(`Found ${data.totalShows} recent shows, ${data.showsWithOfficialSetlists} with setlist.fm data`);
    } catch (error) {
      console.error("Failed to check recent shows:", error);
      toast.error("Failed to check recent shows");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Cohesive dark gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />
      
      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6">
      <MagicCard className="p-0 rounded-2xl border-0 ">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-red-500/20 rounded-xl flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Database Setup Required</h2>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-300">
              Sync real data from Ticketmaster API to populate the app:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-300 text-sm font-medium">
                  ⚠️ Test data creation disabled - using real data only
                </p>
              </div>
              
              <ShimmerButton
                onClick={handleSyncTrending}
                disabled={isSyncing}
                className="bg-green-500/20 hover:bg-green-500/30 text-white border-green-500/30"
                shimmerColor="#10b981"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                {isSyncing ? "Syncing..." : "Sync Real Trending Data"}
              </ShimmerButton>
              
              <ShimmerButton
                onClick={handleCheckRecentShows}
                disabled={isChecking}
                className="bg-blue-500/20 hover:bg-blue-500/30 text-white border-blue-500/30"
                shimmerColor="#3b82f6"
              >
                <Database className="h-4 w-4 mr-2" />
                {isChecking ? "Checking..." : "Check Recent Shows"}
              </ShimmerButton>
            </div>
            
            {/* Recent Shows Data Display */}
            {recentShowsData && (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-semibold text-white">Recent Shows Analysis (Last 2 Days)</h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{recentShowsData.totalShows}</div>
                    <div className="text-xs text-gray-400">Total Shows</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{recentShowsData.showsWithOfficialSetlists}</div>
                    <div className="text-xs text-gray-400">With Setlist.fm</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-400">{recentShowsData.showsWithSetlists.length}</div>
                    <div className="text-xs text-gray-400">With Any Setlist</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-400">
                      {recentShowsData.totalShows > 0 ? Math.round((recentShowsData.showsWithOfficialSetlists / recentShowsData.totalShows) * 100) : 0}%
                    </div>
                    <div className="text-xs text-gray-400">Coverage Rate</div>
                  </div>
                </div>
                
                {recentShowsData.showsWithSetlists.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-white">Shows with Setlists:</h4>
                    {recentShowsData.showsWithSetlists.map((show: any, index: number) => (
                      <div key={index} className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-white">{show.artist?.name}</div>
                          <div className="text-sm text-gray-400">{show.venue?.name} • {show.date}</div>
                        </div>
                        <div className="flex gap-2">
                          {show.hasOfficialSetlist && (
                            <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">
                              Official ({show.officialSongCount} songs)
                            </span>
                          )}
                          {show.hasCommunitySetlist && (
                            <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full">
                              Community ({show.communitySongCount} songs)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <BorderBeam size={120} duration={10} className="opacity-30" />
      </MagicCard>

      <MagicCard className="p-0 rounded-2xl border-0 ">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <Zap className="h-4 w-4 text-yellow-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Clerk JWT Template Setup</h2>
          </div>
          
          <div className="space-y-4 text-gray-300">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-300 mb-2">⚠️ Action Required</h3>
              <p className="text-sm">
                You need to create a JWT template named "convex" in your Clerk Dashboard:
              </p>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                <li>Go to <a href="https://dashboard.clerk.com" className="text-blue-400 hover:underline">Clerk Dashboard</a></li>
                <li>Navigate to "JWT Templates"</li>
                <li>Click "New template"</li>
                <li>Select "Convex" from the list</li>
                <li>Name it exactly: <code className="bg-gray-800 px-1 rounded">convex</code></li>
                <li>Save the template</li>
              </ol>
            </div>
          </div>
        </div>
        <BorderBeam size={120} duration={10} className="opacity-30" />
      </MagicCard>
      </div>
    </div>
  );
}
