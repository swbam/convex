import React, { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface TicketmasterArtist {
  ticketmasterId: string;
  name: string;
  genres: string[];
  images: string[];
  url: string;
  upcomingEvents: number;
}

export default function TicketmasterTest() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<TicketmasterArtist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncingArtist, setSyncingArtist] = useState<string | null>(null);

  const searchArtists = useAction(api.ticketmaster.searchArtists);
  const triggerFullSync = useAction(api.ticketmaster.triggerFullArtistSync);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const searchResults = await searchArtists({ 
        query: searchQuery,
        limit: 10 
      });
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncArtist = async (artist: TicketmasterArtist) => {
    setSyncingArtist(artist.ticketmasterId);
    try {
      const artistId = await triggerFullSync({
        ticketmasterId: artist.ticketmasterId,
        artistName: artist.name,
        genres: artist.genres,
        images: artist.images
      });
      alert(`Successfully started sync for ${artist.name}. Artist ID: ${artistId}`);
    } catch (err) {
      alert(`Failed to sync ${artist.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncingArtist(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Ticketmaster Integration Test</h1>
      
      {/* Search Section */}
      <div className="mb-8">
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for artists..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyPress={(e) => e.key === 'Enter' && void handleSearch()}
          />
          <button
            onClick={() => void handleSearch()}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold mb-4">Search Results</h2>
          {results.map((artist) => (
            <div key={artist.ticketmasterId} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{artist.name}</h3>
                  
                  {artist.genres.length > 0 && (
                    <div className="mb-2">
                      <span className="text-sm text-gray-600">Genres: </span>
                      {artist.genres.map((genre, index) => (
                        <span key={index} className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded mr-2">
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-600 mb-3">
                    <p>Upcoming Events: {artist.upcomingEvents}</p>
                    <p>Ticketmaster ID: {artist.ticketmasterId}</p>
                  </div>
                  
                  <div className="flex gap-3">
                    <a
                      href={artist.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View on Ticketmaster →
                    </a>
                    
                    <button
                      onClick={() => void handleSyncArtist(artist)}
                      disabled={syncingArtist === artist.ticketmasterId}
                      className="px-4 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {syncingArtist === artist.ticketmasterId ? 'Syncing...' : 'Full Sync'}
                    </button>
                  </div>
                </div>
                
                {artist.images.length > 0 && (
                  <div className="ml-4">
                    <img
                      src={artist.images[0]}
                      alt={artist.name}
                      className="w-20 h-20 object-cover rounded-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">How to use:</h3>
        <ol className="list-decimal list-inside text-blue-800 space-y-1">
          <li>Search for artists using the Ticketmaster API</li>
          <li>Click "Full Sync" to import artist data, shows, and venues</li>
          <li>The sync process will also fetch Spotify catalog data</li>
          <li>Check the console for detailed sync progress</li>
        </ol>
        
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800 text-sm">
            <strong>Note:</strong> Make sure the TICKETMASTER_API_KEY is configured in your Convex environment variables.
          </p>
        </div>
      </div>
    </div>
  );
}