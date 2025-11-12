import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Search, Music, Calendar, MapPin, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useUser } from "@clerk/clerk-react";

interface DashboardHomeProps {
  onArtistClick: (artistId: Id<"artists">) => void;
  onShowClick: (showId: Id<"shows">) => void;
  onSignInRequired: () => void;
}

export function DashboardHome({ onArtistClick, onShowClick, onSignInRequired }: DashboardHomeProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Check Clerk auth state to avoid showing "Sign In" to already-signed-in users
  const { isSignedIn: isClerkSignedIn, isLoaded: isClerkLoaded } = useUser();
  
  const trendingArtistsResult = useQuery(api.trending.getTrendingArtists, { limit: 24 });
  const trendingShowsResult = useQuery(api.trending.getTrendingShows, { limit: 18 });
  const trendingArtists = trendingArtistsResult?.page || null;
  const upcomingShows = trendingShowsResult?.page || null;
  const user = useQuery(api.auth.loggedInUser);
  
  const triggerArtistSync = useAction(api.ticketmaster.triggerFullArtistSync);
  const searchTicketmasterArtists = useAction(api.ticketmaster.searchArtists);

  // CRITICAL FIX: Don't show "Sign In" button if user is signed into Clerk
  // Even if Convex user hasn't been created yet (AuthGuard handles that)
  const shouldShowSignInPrompt = isClerkLoaded && !isClerkSignedIn && !user;


  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Use Convex action for secure API calls
      const results = await searchTicketmasterArtists({ query, limit: 10 });
      setSearchResults(results.map(artist => ({
        ticketmasterId: artist.ticketmasterId,
        name: artist.name,
        images: artist.images?.length ? [{ url: artist.images[0] }] : [],
        genres: artist.genres,
        url: artist.url,
        upcomingEvents: { ticketmaster: artist.upcomingEvents },
      })));
    } catch (error) {
      console.error("Search failed:", error);
      // Fallback to local search if API fails
      const filtered = trendingArtists?.filter(artist =>
        artist.name.toLowerCase().includes(query.toLowerCase())
      ) || [];
      setSearchResults(filtered.map(artist => ({
        ticketmasterId: artist.ticketmasterId || artist._id,
        name: artist.name,
        images: artist.image ? [{ url: artist.image }] : [],
        genres: artist.genres || [],
        url: undefined,
        upcomingEvents: { ticketmaster: 0 },
      })));
    } finally {
      setIsSearching(false);
    }
  };

  const handleArtistSelect = async (result: any) => {
    if (result.isLocal) {
      // Local artist, navigate directly
      onArtistClick(result.id);
      return;
    }

    try {
      // Check if artist exists locally first
      const slug = result.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existingArtist = trendingArtists?.find(a => a.slug === slug);
      
      if (existingArtist) {
        onArtistClick(existingArtist._id);
        return;
      }

      // Start full sync for new artist: shows first, then catalog in background
      toast.info(`Starting full import for ${result.name}...`);
      await triggerArtistSync({ 
        ticketmasterId: result.ticketmasterId,
        artistName: result.name,
        genres: result.genres || [],
        images: result.images || []
      });
      
      toast.success(`Import started for ${result.name}. Fetching shows now...`);
      const navigateSlug = result.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      void navigate(`/artists/${navigateSlug}`);
      setSearchQuery("");
      setSearchResults([]);
      
    } catch (error) {
      console.error("Failed to start sync:", error);
      toast.error("Failed to import artist data");
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Search Section */}
      <div className="bg-card rounded-2xl p-6 border border-white/10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Discover Artists & Shows</h1>
          <p className="text-muted-foreground">
            Search for your favorite artists and predict their setlists
          </p>
        </div>

        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for artists..."
            className="flex h-12 w-full rounded-md border border-input bg-background px-12 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-6 max-w-2xl mx-auto">
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div
                  key={result.id || index}
                  className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleArtistSelect(result)}
                >
                  {result.images?.[0]?.url && (
                    <img
                      src={result.images[0].url}
                      alt={result.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium">{result.name}</h3>
                    {result.classifications?.[0]?.genre?.name && (
                      <p className="text-sm text-muted-foreground">
                        {result.classifications[0].genre.name}
                      </p>
                    )}
                    {result.genres && (
                      <p className="text-sm text-muted-foreground">
                        {(result.genres || []).slice(0, 2).join(", ")}
                      </p>
                    )}
                  </div>
                  {result.isLocal && (
                    <div className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                      Local
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content Grid with Sliding Carousels */}
      <div className="space-y-8">
        {/* Trending Artists - 3 Rows Sliding Carousel */}
        <div className="bg-card rounded-2xl p-6 border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Trending Artists</h2>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>

          {!trendingArtists ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg">
                  <div className="w-16 h-16 bg-muted rounded-lg shimmer"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded shimmer"></div>
                    <div className="h-3 bg-muted rounded w-2/3 shimmer"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : trendingArtists.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No trending artists yet</p>
              <p className="text-sm mt-1">Check back later</p>
            </div>
          ) : (
            <div className="space-y-4 relative">
              {/* Row 1 - Slide Left */}
              <div className="relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>
                <div className="flex gap-4 animate-slide-left group-hover:pause-animation">
                  {[...trendingArtists.slice(0, 8), ...trendingArtists.slice(0, 8)].map((artist, idx) => (
                    <div
                      key={`${artist._id}-${idx}`}
                      className="flex-shrink-0 w-64 cursor-pointer transition-transform hover:scale-105"
                      onClick={() => onArtistClick(artist._id)}
                    >
                      <div className="bg-card rounded-xl p-4 border border-white/10 hover:border-primary/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {artist.images?.[0] && (
                            <img
                              src={artist.images[0]}
                              alt={artist.name}
                              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{artist.name}</div>
                            {artist.genres && artist.genres.length > 0 && (
                              <div className="text-sm text-muted-foreground truncate">
                                {(artist.genres || []).slice(0, 2).join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 2 - Slide Right */}
              <div className="relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>
                <div className="flex gap-4 animate-slide-right group-hover:pause-animation">
                  {[...trendingArtists.slice(8, 16), ...trendingArtists.slice(8, 16)].map((artist, idx) => (
                    <div
                      key={`${artist._id}-${idx}`}
                      className="flex-shrink-0 w-64 cursor-pointer transition-transform hover:scale-105"
                      onClick={() => onArtistClick(artist._id)}
                    >
                      <div className="bg-card rounded-xl p-4 border border-white/10 hover:border-primary/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {artist.images?.[0] && (
                            <img
                              src={artist.images[0]}
                              alt={artist.name}
                              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{artist.name}</div>
                            {artist.genres && artist.genres.length > 0 && (
                              <div className="text-sm text-muted-foreground truncate">
                                {(artist.genres || []).slice(0, 2).join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 3 - Slide Left */}
              <div className="relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>
                <div className="flex gap-4 animate-slide-left group-hover:pause-animation">
                  {[...trendingArtists.slice(16, 24), ...trendingArtists.slice(16, 24)].map((artist, idx) => (
                    <div
                      key={`${artist._id}-${idx}`}
                      className="flex-shrink-0 w-64 cursor-pointer transition-transform hover:scale-105"
                      onClick={() => onArtistClick(artist._id)}
                    >
                      <div className="bg-card rounded-xl p-4 border border-white/10 hover:border-primary/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {artist.images?.[0] && (
                            <img
                              src={artist.images[0]}
                              alt={artist.name}
                              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{artist.name}</div>
                            {artist.genres && artist.genres.length > 0 && (
                              <div className="text-sm text-muted-foreground truncate">
                                {(artist.genres || []).slice(0, 2).join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Trending Shows - 3 Rows Sliding Carousel */}
        <div className="bg-card rounded-2xl p-6 border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Trending Shows</h2>
            <Calendar className="h-5 w-5 text-primary" />
          </div>

          {!upcomingShows ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-4 rounded-lg border animate-pulse">
                  <div className="h-5 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : upcomingShows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No upcoming shows</p>
              <p className="text-sm mt-1">Check back for new announcements</p>
            </div>
          ) : (
            <div className="space-y-4 relative">
              {/* Row 1 - Slide Right */}
              <div className="relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>
                <div className="flex gap-4 animate-slide-right group-hover:pause-animation">
                  {[...upcomingShows.slice(0, 6), ...upcomingShows.slice(0, 6)].map((show, idx) => (
                    <div
                      key={`${show._id}-${idx}`}
                      className="flex-shrink-0 w-80 cursor-pointer transition-transform hover:scale-105"
                      onClick={() => onShowClick(show._id, (show as any).slug)}
                    >
                      <div className="bg-card rounded-xl p-4 border border-white/10 hover:border-primary/50 transition-colors h-full">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{show.artist?.name}</h3>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{show.venue?.name}</span>
                            </div>
                          </div>
                          <div className={`flex-shrink-0 ml-2 px-2 py-1 rounded-full text-xs font-medium border ${
                            new Date(show.date).toDateString() === new Date().toDateString()
                              ? "border-foreground text-foreground"
                              : "border-border text-muted-foreground"
                          }`}>
                            {new Date(show.date).toDateString() === new Date().toDateString() ? "Tonight" : "Upcoming"}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {new Date(show.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                          {show.venue?.city && ` • ${show.venue.city}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 2 - Slide Left */}
              <div className="relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>
                <div className="flex gap-4 animate-slide-left group-hover:pause-animation">
                  {[...upcomingShows.slice(6, 12), ...upcomingShows.slice(6, 12)].map((show, idx) => (
                    <div
                      key={`${show._id}-${idx}`}
                      className="flex-shrink-0 w-80 cursor-pointer transition-transform hover:scale-105"
                      onClick={() => onShowClick(show._id, (show as any).slug)}
                    >
                      <div className="bg-card rounded-xl p-4 border border-white/10 hover:border-primary/50 transition-colors h-full">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{show.artist?.name}</h3>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{show.venue?.name}</span>
                            </div>
                          </div>
                          <div className={`flex-shrink-0 ml-2 px-2 py-1 rounded-full text-xs font-medium border ${
                            new Date(show.date).toDateString() === new Date().toDateString()
                              ? "border-foreground text-foreground"
                              : "border-border text-muted-foreground"
                          }`}>
                            {new Date(show.date).toDateString() === new Date().toDateString() ? "Tonight" : "Upcoming"}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {new Date(show.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                          {show.venue?.city && ` • ${show.venue.city}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 3 - Slide Right */}
              <div className="relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>
                <div className="flex gap-4 animate-slide-right group-hover:pause-animation">
                  {[...upcomingShows.slice(12, 18), ...upcomingShows.slice(12, 18)].map((show, idx) => (
                    <div
                      key={`${show._id}-${idx}`}
                      className="flex-shrink-0 w-80 cursor-pointer transition-transform hover:scale-105"
                      onClick={() => onShowClick(show._id, (show as any).slug)}
                    >
                      <div className="bg-card rounded-xl p-4 border border-white/10 hover:border-primary/50 transition-colors h-full">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{show.artist?.name}</h3>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{show.venue?.name}</span>
                            </div>
                          </div>
                          <div className={`flex-shrink-0 ml-2 px-2 py-1 rounded-full text-xs font-medium border ${
                            new Date(show.date).toDateString() === new Date().toDateString()
                              ? "border-foreground text-foreground"
                              : "border-border text-muted-foreground"
                          }`}>
                            {new Date(show.date).toDateString() === new Date().toDateString() ? "Tonight" : "Upcoming"}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {new Date(show.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                          {show.venue?.city && ` • ${show.venue.city}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Call to Action for Anonymous Users */}
      {shouldShowSignInPrompt && (
        <div className="bg-card rounded-2xl p-6 border border-white/10 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h3 className="text-xl font-bold mb-2">Join the Community</h3>
          <p className="text-muted-foreground mb-6">
            Sign in to follow artists, create setlist predictions, and compete with other fans
          </p>
          <button
            onClick={onSignInRequired}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            Sign In to Get Started
          </button>
        </div>
      )}
    </div>
  );
}
