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
        song: {
          title: songTitle,
        },
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 safe-area-bottom">
      <div className="bg-card border rounded-t-2xl sm:rounded-2xl shadow-lg w-full sm:max-w-md max-h-[85vh] sm:max-h-[80vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 sm:slide-in-from-bottom-0 duration-300">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 bg-card z-10">
          <h2 className="text-responsive-base sm:text-responsive-lg font-semibold">Add to Setlist</h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-accent rounded-full transition-colors touch-target"
            aria-label="Close modal"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 overflow-y-auto flex-1">
          <div className="mb-3 sm:mb-4">
            <p className="text-responsive-xs sm:text-responsive-sm text-muted-foreground">
              Add "{songTitle}" to a setlist prediction:
            </p>
          </div>

          {upcomingShows.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <Calendar className="h-7 w-7 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
              <p className="text-responsive-sm">No upcoming shows found</p>
              <p className="text-responsive-xs mt-1">This artist doesn't have any upcoming shows to predict</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingShows.map((show) => (
                <button
                  key={show._id}
                  onClick={() => handleAddToShow(show._id)}
                  disabled={isAdding}
                  className="w-full text-left p-2.5 sm:p-3 rounded-lg border hover:bg-accent/50 active:bg-accent/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-responsive-sm">{show.venue?.name}</div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-responsive-xs text-muted-foreground mt-0.5 sm:mt-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{show.venue?.city}, {show.venue?.country}</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-responsive-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span>
                          {new Date(show.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        {show.startTime && <span className="hidden sm:inline">{show.startTime}</span>}
                      </div>
                    </div>
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {!user && (
            <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-black/50 rounded-lg text-center">
              <p className="text-responsive-xs sm:text-responsive-sm text-muted-foreground mb-1.5 sm:mb-2">
                Sign in to create setlist predictions
              </p>
              <button
                onClick={() => {
                  onClose();
                  onSignInRequired();
                }}
                className="text-responsive-xs sm:text-responsive-sm text-primary hover:underline touch-target"
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