import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TrendingUp } from "lucide-react";
import { formatCompactNumber } from "../lib/format";

interface TrendingArtistsProps {
  onArtistClick: (artistId: Id<"artists">) => void;
}

export function TrendingArtists({ onArtistClick }: TrendingArtistsProps) {
  const artists = useQuery(api.artists.getTrending, { limit: 10 });

  if (!artists) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center gap-3 p-3 rounded-lg">
              <div className="w-8 h-8 bg-muted rounded-full"></div>
              <div className="w-12 h-12 bg-muted rounded-md"></div>
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <TrendingUp className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>No trending artists yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {artists.map((artist, index) => (
        <button
          key={artist._id}
          type="button"
          onClick={() => onArtistClick(artist._id)}
          className="group flex w-full items-center gap-3 p-3 rounded-lg text-left hover:bg-accent cursor-pointer transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <div className="w-8 h-8 flex-shrink-0 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
            {index + 1}
          </div>
          {artist.images?.[0] && (
            <div className="w-12 h-12 flex-shrink-0 rounded-md overflow-hidden">
              <img
                src={artist.images[0]}
                alt={artist.name}
                className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h6 className="font-medium truncate">{artist.name}</h6>
            {artist.genres && artist.genres.length > 0 && (
              <p className="text-sm text-muted-foreground truncate">{artist.genres[0]}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-sm font-medium">
              {formatCompactNumber(
                typeof artist.trendingScore === 'number' && Number.isFinite(artist.trendingScore)
                  ? artist.trendingScore
                  : 0
              )}
            </div>
            <div className="text-xs text-muted-foreground">trending</div>
          </div>
        </button>
      ))}
    </div>
  );
}
