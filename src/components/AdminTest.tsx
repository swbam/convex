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
  
  const populateTestData = useAction(api.maintenance.populateTestData);
  const triggerTrendingSync = useAction(api.maintenance.triggerTrendingSync);

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

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6">
      <MagicCard className="p-0 rounded-2xl border-0 hover:border-white/20">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-red-500/20 rounded-xl flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Database Setup Required</h2>
          </div>
          
          <div className="space-y-4">
            <p className="text-gray-300">
              The database is empty. Use these admin tools to populate data:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ShimmerButton
                onClick={handlePopulateData}
                disabled={isPopulating}
                className="bg-blue-500/20 hover:bg-blue-500/30 text-white border-blue-500/30"
                shimmerColor="#3b82f6"
              >
                <Database className="h-4 w-4 mr-2" />
                {isPopulating ? "Creating..." : "Create Test Shows"}
              </ShimmerButton>
              
              <ShimmerButton
                onClick={handleSyncTrending}
                disabled={isSyncing}
                className="bg-green-500/20 hover:bg-green-500/30 text-white border-green-500/30"
                shimmerColor="#10b981"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                {isSyncing ? "Syncing..." : "Sync Trending Data"}
              </ShimmerButton>
            </div>
          </div>
        </div>
        <BorderBeam size={120} duration={10} className="opacity-30" />
      </MagicCard>

      <MagicCard className="p-0 rounded-2xl border-0 hover:border-white/20">
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
  );
}
