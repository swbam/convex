import React, { useState } from 'react';
import { useAction } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Loader2, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { toast } from "sonner";

interface ArtistSearchProps {
  onArtistClick: (artistId: Id<"artists">, slug?: string) => void;
}

export function ArtistSearch({ onArtistClick }: ArtistSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSyncing, setIsSyncing] = useState<Record<string, boolean>>({}); // Per artist loading
  const [results, setResults] = useState<any[]>([]);
  const searchArtists = useAction(api.ticketmaster.searchArtists);
  const triggerSync = useAction(api.ticketmaster.triggerFullArtistSync);
  const navigate = useNavigate();

  const handleArtistSelect = async (artist: any) => {
    const artistKey = artist.ticketmasterId || artist._id;
    setIsSyncing(prev => ({ ...prev, [artistKey]: true }));

    try {
      // Trigger sync
      // AUTO-OUTRANKING: Pass upcomingEvents for immediate trending score calculation
      const syncResult = await triggerSync({
        ticketmasterId: artist.ticketmasterId,
        artistName: artist.name,
        genres: artist.genres,
        images: artist.images,
        upcomingEvents: artist.upcomingEvents || 0, // For auto-ranking massive artists
      });

      // Handle both artist and festival results
      if (syncResult.type === 'festival') {
        toast.success(`Opening ${artist.name} festival...`);
        navigate(`/festivals/${syncResult.slug}`);
      } else if (syncResult.artistId) {
        // Navigate immediately using ID; app will canonicalize to slug when available
        onArtistClick(syncResult.artistId);
        toast.success(`Importing ${artist.name} data...`);
      }

    } catch (error) {
      setIsSyncing(prev => ({ ...prev, [artistKey]: false }));
      const message = error instanceof Error ? error.message : "Failed to sync";
      toast.error(message);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchTerm(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const tmResults = await searchArtists({ query, limit: 10 });
      setResults(tmResults || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const displayArtists = searchTerm ? results || [] : [];

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
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for artists..."
            className="flex h-12 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {isSearching && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-muted-foreground">Searching artists...</p>
          </div>
        )}

        {!isSearching && (
          <div className="space-y-4">
            {/* {!searchQuery && ( // This condition is no longer relevant
              <h2 className="text-xl font-semibold mb-4">Trending Artists</h2>
            )} */}
            
            {displayArtists.length === 0 && searchTerm && (
              <div className="text-center py-12 text-muted-foreground">
                {/* <Music className="h-12 w-12 mx-auto mb-4 opacity-50" /> */}
                <p>No artists found for "{searchTerm}"</p>
              </div>
            )}

            {displayArtists.map((artist) => {
              const key = artist.ticketmasterId || artist._id;
              return (
                <div key={key} className="flex items-center justify-between p-3 hover:bg-secondary rounded-lg">
                  <div className="flex items-center gap-3">
                    <img src={artist.images?.[0]} alt={artist.name} className="w-10 h-10 rounded-full" />
                    <span>{artist.name}</span>
                    {artist.genres?.[0] && <Badge variant="secondary">{artist.genres[0]}</Badge>}
                  </div>
                  <Button 
                    onClick={() => handleArtistSelect(artist)}
                    disabled={isSyncing[key]}
                    variant="outline"
                    size="sm"
                  >
                    {isSyncing[key] ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {isSyncing[key] ? "Syncing..." : "Select"}
                  </Button>
                </div>
              );
            })}
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
            {(artist.genres || []).slice(0, 2).join(", ")}
          </p>
        )}
        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
          {artist.followers && (
            <div className="flex items-center gap-1">
              {/* <Users className="h-3 w-3" /> */}
              <span>{artist.followers.toLocaleString()}</span>
            </div>
          )}
          {(typeof artist.trendingScore === 'number' && Number.isFinite(artist.trendingScore) && artist.trendingScore > 0) && (
            <div className="flex items-center gap-1">
              {/* <TrendingUp className="h-3 w-3" /> */}
              <span>{artist.trendingScore}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
