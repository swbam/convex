"use client";

import { useState } from "react";
import { SyncProgress } from "../components/SyncProgress";

export function SyncTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [artistName, setArtistName] = useState("");
  const [message, setMessage] = useState("");

  const handleStartSync = async () => {
    if (!artistName.trim()) {
      setMessage("Please enter an artist name");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/start-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ artistName: artistName.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Sync started successfully! Job ID: ${data.jobId}`);
        setArtistName("");
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Failed to start sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sync Progress Component */}
      <SyncProgress />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Multi-Phase Import Test
          </h1>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="artistName" className="block text-sm font-medium text-gray-700 mb-2">
                Artist Name
              </label>
              <input
                id="artistName"
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Enter artist name (e.g., Taylor Swift)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
            </div>
            
            <button
              onClick={() => void handleStartSync()}
              disabled={isLoading || !artistName.trim()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Starting Sync..." : "Start Multi-Phase Import"}
            </button>
            
            {message && (
              <div className={`p-3 rounded-md text-sm ${
                message.includes("Error") || message.includes("Failed")
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-green-50 text-green-700 border border-green-200"
              }`}>
                {message}
              </div>
            )}
          </div>
          
          <div className="mt-8 text-sm text-gray-600">
            <h3 className="font-medium mb-2">What this test does:</h3>
            <ul className="space-y-1 text-xs">
              <li>• Creates a full sync job for the specified artist</li>
              <li>• Shows real-time progress updates via Server-Sent Events</li>
              <li>• Demonstrates multi-phase import: Artist Setup → Show Import → Catalog Import → Finalization</li>
              <li>• Tracks detailed progress including steps, items processed, and percentage completion</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SyncTest;