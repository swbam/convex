import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { SearchBar } from "./SearchBar";
import { VotingButton } from "./VotingButton";
import { AddToSetlistModal } from "./AddToSetlistModal";

/**
 * Test component to validate all the implemented functionality
 */
export function ComponentsTest() {
  const [selectedArtist, setSelectedArtist] = useState<Id<"artists"> | null>(null);
  const [selectedShow, setSelectedShow] = useState<Id<"shows"> | null>(null);
  const [testModal, setTestModal] = useState({ isOpen: false, songTitle: "" });
  
  const artists = useQuery(api.artists.getTrending, { limit: 5 });
  const shows = useQuery(api.shows.getUpcoming, { limit: 5 });
  const setlists = useQuery(api.setlists.getByShow, selectedShow ? { showId: selectedShow } : "skip");

  const handleSearchResult = (type: 'artist' | 'show' | 'venue', id: any, slug?: string) => {
    console.log(`Selected ${type}:`, { id, slug });
    if (type === 'artist') {
      setSelectedArtist(id);
    } else if (type === 'show') {
      setSelectedShow(id);
    }
  };

  const handleSignInRequired = () => {
    alert("Sign in required! This would typically open the sign-in modal.");
  };

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Components Test Page</h1>
        <p className="text-muted-foreground mb-8">
          This page tests all the implemented frontend components
        </p>
      </div>

      {/* Search Bar Test */}
      <div className="dashboard-card">
        <h2 className="text-xl font-bold mb-4">Search Bar Test</h2>
        <SearchBar 
          onResultClick={handleSearchResult}
          placeholder="Search for artists to test navigation..."
        />
        {selectedArtist && (
          <p className="mt-4 text-sm text-muted-foreground">
            Selected artist ID: {selectedArtist}
          </p>
        )}
      </div>

      {/* Show Selection */}
      <div className="dashboard-card">
        <h2 className="text-xl font-bold mb-4">Show Selection for Voting Test</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shows?.map(show => (
            <button
              key={show._id}
              onClick={() => setSelectedShow(show._id)}
              className={`p-4 rounded-lg border text-left transition-colors ${
                selectedShow === show._id 
                  ? "bg-primary/10 border-primary" 
                  : "hover:bg-accent/50"
              }`}
            >
              <div className="font-medium">{show.artist?.name}</div>
              <div className="text-sm text-muted-foreground">{show.venue?.name}</div>
              <div className="text-sm text-muted-foreground">
                {new Date(show.date).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
        {selectedShow && (
          <p className="mt-4 text-sm text-muted-foreground">
            Selected show ID: {selectedShow}
          </p>
        )}
      </div>

      {/* Voting Button Test */}
      {selectedShow && setlists && setlists.length > 0 && (
        <div className="dashboard-card">
          <h2 className="text-xl font-bold mb-4">Voting Button Test</h2>
          <div className="space-y-4">
            {setlists.filter(s => !s.isOfficial).map(setlist => (
              <div key={setlist._id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium">{setlist.username}</div>
                    <div className="text-sm text-muted-foreground">
                      {setlist.songs.length} songs • Score: {setlist.score || 0}
                    </div>
                  </div>
                  <VotingButton 
                    setlistId={setlist._id}
                    onSignInRequired={handleSignInRequired}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Songs: {setlist.songs.slice(0, 3).join(", ")}
                  {setlist.songs.length > 3 && ` +${setlist.songs.length - 3} more`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add to Setlist Modal Test */}
      <div className="dashboard-card">
        <h2 className="text-xl font-bold mb-4">Add to Setlist Modal Test</h2>
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Select an artist and then click a song to test the modal:
          </p>
          
          {selectedArtist && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setTestModal({ isOpen: true, songTitle: "Example Song" })}
                className="p-3 border rounded-lg hover:bg-accent/50 transition-colors text-left"
              >
                <div className="font-medium">Open modal (uses real artist shows)</div>
                <div className="text-sm text-muted-foreground">No mock songs used</div>
              </button>
            </div>
          )}
          
          {!selectedArtist && (
            <p className="text-sm text-muted-foreground">
              Use the search bar above to select an artist first
            </p>
          )}
        </div>
      </div>

      {/* Add to Setlist Modal */}
      {selectedArtist && (
        <AddToSetlistModal
          isOpen={testModal.isOpen}
          onClose={() => setTestModal({ isOpen: false, songTitle: "" })}
          artistId={selectedArtist}
          songTitle={testModal.songTitle}
          onSignInRequired={handleSignInRequired}
        />
      )}

      {/* Trending Artists Display */}
      <div className="dashboard-card">
        <h2 className="text-xl font-bold mb-4">Trending Artists</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {artists?.map(artist => (
            <div key={artist._id} className="p-4 border rounded-lg">
              <div className="font-medium">{artist.name}</div>
              <div className="text-sm text-muted-foreground">
                {(artist.genres?.slice(0, 2) || []).join(", ")}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Trending Score: {artist.trendingScore}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}