import React, { useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface Show {
  _id: Id<"shows">;
  artist: {
    name: string;
  };
  venue: {
    name: string;
    city: string;
  };
  date: string;
  status: string;
}

interface Setlist {
  _id: Id<"setlists">;
  songs: string[];
  isOfficial: boolean;
  username: string;
  score: number;
  upvotes: number;
  downvotes: number;
  confidence: number;
}

export default function SetlistTest() {
  const [selectedShowId, setSelectedShowId] = useState<Id<"shows"> | null>(null);
  const [syncingShow, setSyncingShow] = useState<Id<"shows"> | null>(null);

  // Get recent shows for testing
  const recentShows = useQuery(api.shows.getRecent, { limit: 10 });
  const setlists = useQuery(api.setlists.getByShow, 
    selectedShowId ? { showId: selectedShowId } : "skip"
  );
  
  const triggerSetlistSync = useAction(api.setlistfm.triggerSetlistSync);
  const triggerCompletedShowsCheck = useAction(api.setlistfm.triggerCompletedShowsCheck);

  const handleSyncSetlist = async (show: any) => {
    setSyncingShow(show._id);
    try {
      const result = await triggerSetlistSync({
        showId: show._id,
        artistName: show.artist?.name || '',
        venueCity: show.venue?.city || '',
        showDate: show.date,
      });
      
      if (result) {
        alert(`Successfully synced setlist for ${show.artist?.name}! Setlist ID: ${result}`);
        // Refresh setlists if this show is selected
        if (selectedShowId === show._id) {
          // The query will automatically refresh
        }
      } else {
        alert(`No setlist found for ${show.artist?.name} on ${show.date}`);
      }
    } catch (err) {
      alert(`Failed to sync setlist: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncingShow(null);
    }
  };

  const handleCheckCompletedShows = async () => {
    try {
      const result = await triggerCompletedShowsCheck({});
      alert(`Successfully checked completed shows: ${result.message}`);
    } catch (err) {
      alert(`Failed to check completed shows: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Setlist.fm Integration Test</h1>
        <p className="text-gray-600 mb-4">
          This page demonstrates the Setlist.fm API integration for fetching actual setlist data.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">How to use:</h3>
          <ol className="list-decimal list-inside text-blue-800 space-y-1">
            <li>Select a show from the recent shows list</li>
            <li>Click "Sync Setlist" to fetch actual setlist data from Setlist.fm</li>
            <li>View the fetched setlists with voting functionality</li>
            <li>Use "Check Completed Shows" to process all past shows</li>
          </ol>
          <p className="text-sm text-blue-700 mt-2">
            <strong>Note:</strong> Requires SETLISTFM_API_KEY to be configured in Convex environment variables.
          </p>
        </div>

        <button
          onClick={() => void handleCheckCompletedShows()}
          className="mb-6 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Check Completed Shows
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Shows */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Shows</h2>
          {!recentShows ? (
            <div className="text-gray-500">Loading shows...</div>
          ) : recentShows.length === 0 ? (
            <div className="text-gray-500">No shows found</div>
          ) : (
            <div className="space-y-3">
              {recentShows.map((show) => (
                <div
                  key={show._id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedShowId === show._id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedShowId(show._id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {show.artist?.name || 'Unknown Artist'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {show.venue?.name || 'Unknown Venue'} • {show.venue?.city || 'Unknown City'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {show.date} • Status: {show.status}
                      </p>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleSyncSetlist(show);
                      }}
                      disabled={syncingShow === show._id}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {syncingShow === show._id ? 'Syncing...' : 'Sync Setlist'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Setlists for Selected Show */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Setlists {selectedShowId ? '(Selected Show)' : '(Select a show)'}
          </h2>
          {!selectedShowId ? (
            <div className="text-gray-500">Select a show to view its setlists</div>
          ) : !setlists ? (
            <div className="text-gray-500">Loading setlists...</div>
          ) : setlists.length === 0 ? (
            <div className="text-gray-500">No setlists found for this show</div>
          ) : (
            <div className="space-y-4">
              {setlists.map((setlist) => (
                <div
                  key={setlist._id}
                  className={`p-4 border rounded-lg ${
                    setlist.isOfficial
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {setlist.isOfficial ? '🎵 Official Setlist' : '🎤 User Prediction'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        by {setlist.username} • Score: {setlist.score} • Confidence: {Math.round((setlist.confidence || 0) * 100)}%
                      </p>
                    </div>
                    
                    {!setlist.isOfficial && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">
                          👍 {setlist.upvotes} 👎 {setlist.downvotes}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="font-medium text-gray-700">Songs ({setlist.songs.length}):</h4>
                    <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                      {setlist.songs.map((song, index) => (
                        <li key={index}>{song}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}