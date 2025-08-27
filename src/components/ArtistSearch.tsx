import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Search, Music, Users, TrendingUp } from "lucide-react";

interface ArtistSearchProps {
  onArtistClick: (artistId: Id<"artists">) => void;
}

export function ArtistSearch({ onArtistClick }: ArtistSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Use trending artists as fallback when no search
  const trendingArtists = useQuery(api.artists.getTrending, { limit: 10 });

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // For now, filter trending artists by name
      const filtered = trendingArtists?.filter(artist => 
        artist.name.toLowerCase().includes(query.toLowerCase())
      ) || [];
      setResults(filtered);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const displayArtists = searchQuery ? results : (trendingArtists || []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Search Artists</h1>
          <p className="text-muted-foreground">
            Find your favorite artists and discover their upcoming shows
          </p>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for artists..."
            className="flex h-12 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        )}

        {!loading && (
          <div className="space-y-4">
            {!searchQuery && (
              <h2 className="text-xl font-semibold mb-4">Trending Artists</h2>
            )}
            
            {displayArtists.length === 0 && searchQuery && (
              <div className="text-center py-12 text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No artists found for "{searchQuery}"</p>
              </div>
            )}

            {displayArtists.map((artist) => (
              <ArtistCard
                key={artist._id}
                artist={artist}
                onClick={() => onArtistClick(artist._id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ArtistCard({ artist, onClick }: { artist: any; onClick: () => void }) {
  return (
    <div
      className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
      onClick={onClick}
    >
      {artist.images?.[0] && (
        <img
          src={artist.images[0]}
          alt={artist.name}
          className="w-16 h-16 rounded-lg object-cover"
        />
      )}
      
      <div className="flex-1">
        <h3 className="font-semibold text-lg">{artist.name}</h3>
        {artist.genres && artist.genres.length > 0 && (
          <p className="text-muted-foreground text-sm">
            {artist.genres.slice(0, 2).join(", ")}
          </p>
        )}
        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
          {artist.followers && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{artist.followers.toLocaleString()}</span>
            </div>
          )}
          {artist.trendingScore && (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>{artist.trendingScore}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
