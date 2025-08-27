import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { X, Calendar, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";

interface AddToSetlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistId: Id<"artists">;
  songTitle: string;
  onSignInRequired: () => void;
}

export function AddToSetlistModal({ 
  isOpen, 
  onClose, 
  artistId, 
  songTitle, 
  onSignInRequired 
}: AddToSetlistModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const user = useQuery(api.auth.loggedInUser);
  const shows = useQuery(api.shows.getByArtist, { artistId, limit: 10 });
  const addSongToSetlist = useMutation(api.setlists.addSongToSetlist);

  if (!isOpen) return null;

  const upcomingShows = shows?.filter(show => show.status === "upcoming") || [];

  const handleAddToShow = async (showId: Id<"shows">) => {
    if (!user) {
      onSignInRequired();
      return;
    }

    setIsAdding(true);
    try {
      await addSongToSetlist({
        showId,
        songTitle,
      });

      toast.success(`Added "${songTitle}" to your setlist prediction`);
      onClose();
    } catch (error) {
      toast.error("Failed to add song to setlist");
      console.error("Add to setlist failed:", error);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border rounded-lg shadow-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Add to Setlist</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Add "{songTitle}" to a setlist prediction:
            </p>
          </div>

          {upcomingShows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No upcoming shows found</p>
              <p className="text-xs mt-1">This artist doesn't have any upcoming shows to predict</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingShows.map((show) => (
                <button
                  key={show._id}
                  onClick={() => handleAddToShow(show._id)}
                  disabled={isAdding}
                  className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{show.venue?.name}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{show.venue?.city}, {show.venue?.country}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(show.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        {show.startTime && <span>{show.startTime}</span>}
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {!user && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Sign in to create setlist predictions
              </p>
              <button
                onClick={() => {
                  onClose();
                  onSignInRequired();
                }}
                className="text-sm text-primary hover:underline"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}