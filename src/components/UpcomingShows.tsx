import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Calendar, MapPin } from "lucide-react";

interface UpcomingShowsProps {
  onShowClick: (showId: Id<"shows">) => void;
  onArtistClick: (artistId: Id<"artists">) => void;
}

export function UpcomingShows({ onShowClick, onArtistClick }: UpcomingShowsProps) {
  const shows = useQuery(api.shows.getUpcoming, { limit: 10 });

  if (!shows) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="p-3 rounded-lg">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2 mb-1"></div>
              <div className="h-3 bg-muted rounded w-1/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (shows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>No upcoming shows found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shows.map((show) => (
        <div 
          key={show._id} 
          onClick={() => onShowClick(show._id)}
          className="p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArtistClick(show.artistId);
            }}
            className="font-medium text-primary hover:underline"
          >
            {show.artist?.name}
          </button>
          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{show.venue?.name}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {show.venue?.city}, {show.venue?.country}
          </p>
          <div className="flex items-center gap-1 mt-2 text-xs text-primary">
            <Calendar className="h-3 w-3" />
            <span>{new Date(show.date).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
