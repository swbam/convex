import React, { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function TestSuite() {
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [isRunning, setIsRunning] = useState(false);
  
  const searchArtists = useAction(api.ticketmaster.searchArtists);
  const startFullSync = useMutation(api.syncJobs.startFullSync);
  const createAppUser = useMutation(api.auth.createAppUser);
  const healthCheck = useQuery(api.health.healthCheck);
  const systemStats = useQuery(api.health.getSystemStats);

  const runTest = async (testName: string, testFn: () => Promise<boolean>) => {
    try {
      const result = await testFn();
      setTestResults(prev => ({ ...prev, [testName]: result }));
      return result;
    } catch (error) {
      console.error(`Test ${testName} failed:`, error);
      setTestResults(prev => ({ ...prev, [testName]: false }));
      return false;
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults({});
    
    try {
      // Test 1: Health Check
      await runTest("Health Check", async () => {
        return healthCheck?.status === "healthy";
      });

      // Test 2: Environment Variables
      await runTest("Environment Variables", async () => {
        const env = healthCheck?.environment;
        return !!(env?.hasSpotifyCredentials && env?.hasTicketmasterKey && env?.hasSetlistfmKey);
      });

      // Test 3: Ticketmaster Search
      await runTest("Ticketmaster Search", async () => {
        const results = await searchArtists({ query: "Coldplay", limit: 5 });
        return results.length > 0;
      });

      // Test 4: Database Connectivity
      await runTest("Database Connectivity", async () => {
        return systemStats?.totalArtists !== undefined;
      });

      // Test 5: Auth System
      await runTest("Auth System", async () => {
        try {
          // This will fail if not authenticated, which is expected
          await createAppUser();
          return true;
        } catch (error: any) {
          // Expected to fail if not authenticated
          return error.message === "Must be logged in";
        }
      });

      toast.success("Test suite completed!");
    } catch (error) {
      toast.error("Test suite failed!");
      console.error("Test suite error:", error);
    } finally {
      setIsRunning(false);
    }
  };

  const testCount = Object.keys(testResults).length;
  const passedCount = Object.values(testResults).filter(Boolean).length;

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      <div className="dashboard-card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Test Suite</h1>
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isRunning ? "Running..." : "Run Tests"}
          </button>
        </div>

        {testCount > 0 && (
          <div className="mb-6">
            <div className="text-lg font-medium mb-2">
              Results: {passedCount}/{testCount} tests passed
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${(passedCount / testCount) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {Object.entries(testResults).map(([testName, passed]) => (
            <div key={testName} className="flex items-center justify-between p-3 border rounded-lg">
              <span className="font-medium">{testName}</span>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                passed ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {passed ? "✓" : "✗"}
              </div>
            </div>
          ))}
        </div>

        {healthCheck && (
          <div className="mt-8 p-4 border rounded-lg">
            <h3 className="font-semibold mb-3">System Status</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Database: {healthCheck.database ? "✓ Connected" : "✗ Disconnected"}</div>
              <div>Spotify: {healthCheck.environment.hasSpotifyCredentials ? "✓ Configured" : "✗ Missing"}</div>
              <div>Ticketmaster: {healthCheck.environment.hasTicketmasterKey ? "✓ Configured" : "✗ Missing"}</div>
              <div>Setlist.fm: {healthCheck.environment.hasSetlistfmKey ? "✓ Configured" : "✗ Missing"}</div>
            </div>
          </div>
        )}

        {systemStats && (
          <div className="mt-6 p-4 border rounded-lg">
            <h3 className="font-semibold mb-3">Database Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>Artists: {systemStats.totalArtists}</div>
              <div>Shows: {systemStats.totalShows}</div>
              <div>Setlists: {systemStats.totalSetlists}</div>
              <div>Votes: {systemStats.totalVotes}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
