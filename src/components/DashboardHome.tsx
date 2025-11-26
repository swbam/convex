import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Search,
  Music,
  Calendar,
  MapPin,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useUser } from "@clerk/clerk-react";

interface DashboardHomeProps {
  onArtistClick: (artistId: Id<"artists">) => void;
  onShowClick: (showId: Id<"shows">, slug?: string) => void;
  onSignInRequired: () => void;
}

export function DashboardHome({
  onArtistClick,
  onShowClick,
  onSignInRequired,
}: DashboardHomeProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Clerk auth state so we don't ask signed‑in users to sign in again
  const { isSignedIn: isClerkSignedIn, isLoaded: isClerkLoaded } = useUser();

  const trendingArtistsResult = useQuery(api.trending.getTrendingArtists, {
    limit: 24,
  });
  const trendingShowsResult = useQuery(api.trending.getTrendingShows, {
    limit: 18,
  });
  const trendingArtists = trendingArtistsResult?.page || null;
  const upcomingShows = trendingShowsResult?.page || null;
  const appUser = useQuery(api.auth.loggedInUser);

  const triggerArtistSync = useAction(api.ticketmaster.triggerFullArtistSync);
  const searchTicketmasterArtists = useAction(api.ticketmaster.searchArtists);

  const shouldShowSignInPrompt =
    isClerkLoaded && !isClerkSignedIn && !appUser;

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchTicketmasterArtists({ query, limit: 10 });
      setSearchResults(
        results.map((artist: any) => ({
          ticketmasterId: artist.ticketmasterId,
          name: artist.name,
          images: artist.images?.length ? [{ url: artist.images[0] }] : [],
          genres: artist.genres,
          url: artist.url,
          upcomingEvents: { ticketmaster: artist.upcomingEvents },
        })),
      );
    } catch (error) {
      console.error("Search failed:", error);
      const filtered =
        trendingArtists?.filter((artist: any) =>
          artist.name.toLowerCase().includes(query.toLowerCase()),
        ) || [];
      setSearchResults(
        filtered.map((artist: any) => ({
          ticketmasterId: artist.ticketmasterId || artist._id,
          name: artist.name,
          images: artist.image ? [{ url: artist.image }] : [],
          genres: artist.genres || [],
          url: undefined,
          upcomingEvents: { ticketmaster: 0 },
        })),
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleArtistSelect = async (result: any) => {
    if (result.isLocal) {
      onArtistClick(result.id as Id<"artists">);
      return;
    }

    try {
      const slug = result.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const existingArtist =
        trendingArtists?.find((a: any) => a.slug === slug) ?? null;

      if (existingArtist) {
        onArtistClick(existingArtist._id as Id<"artists">);
        return;
      }

      toast.info(`Starting full import for ${result.name}...`);
      await triggerArtistSync({
        ticketmasterId: result.ticketmasterId,
        artistName: result.name,
        genres: result.genres || [],
        images: result.images || [],
      });

      toast.success(
        `Import started for ${result.name}. Fetching shows now...`,
      );
      const navigateSlug = result.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
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
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Discover Artists & Shows</h1>
          <p className="text-muted-foreground">
            Search for your favorite artists and predict their setlists
          </p>
        </div>

        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            placeholder="Search by artist name..."
            value={searchQuery}
            onChange={(e) => void handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background/60 border border-border text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {isSearching && (
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Searching Ticketmaster…
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="mt-4 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Search results
              </p>
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSearchResults([])}
              >
                Clear
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={`${result.ticketmasterId}-${result.name}`}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2 bg-card hover:bg-card/80 border border-border text-left"
                  onClick={() => void handleArtistSelect(result)}
                >
                  {result.images?.[0]?.url && (
                    <img
                      src={result.images[0].url}
                      alt={result.name}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">
                      {result.name}
                    </h3>
                    {result.genres && (
                      <p className="text-xs text-muted-foreground truncate">
                        {(result.genres || []).slice(0, 2).join(", ")}
                      </p>
                    )}
                  </div>
                  {result.isLocal && (
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-1 rounded-full">
                      Local
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content Grid with compact horizontal carousels */}
      <div className="space-y-8">
        {/* Trending Artists */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">Trending Artists</h2>
              <p className="text-sm text-muted-foreground">
                Most popular artists with upcoming shows
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>

          {!trendingArtists ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 rounded-lg border animate-pulse">
                  <div className="h-5 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : trendingArtists.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Music className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No trending artists yet</p>
              <p className="text-sm mt-1">Check back later</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[
                trendingArtists.slice(0, 10),
                trendingArtists.slice(10, 20),
              ]
                .filter((row) => row.length > 0)
                .map((row, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="-mx-4 px-4 flex gap-3 overflow-x-auto pb-2 sm:mx-0 sm:px-0 scrollbar-none"
                  >
                    {row.map((artist: any) => (
                      <button
                        key={artist._id}
                        onClick={() => onArtistClick(artist._id as Id<"artists">)}
                        className="flex-shrink-0 w-40 sm:w-48 rounded-xl bg-card/80 border border-border hover:border-primary/50 transition-colors overflow-hidden text-left"
                      >
                        {artist.images?.[0] && (
                          <div className="h-32 w-full overflow-hidden">
                            <img
                              src={artist.images[0]}
                              alt={artist.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-3">
                          <div className="font-medium text-sm text-foreground truncate">
                            {artist.name}
                          </div>
                          {artist.genres && artist.genres.length > 0 && (
                            <div className="text-[11px] text-muted-foreground truncate mt-1">
                              {(artist.genres || []).slice(0, 2).join(", ")}
                            </div>
                          )}
                          {typeof artist.upcomingShowsCount === "number" && (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {artist.upcomingShowsCount}{" "}
                              {artist.upcomingShowsCount === 1
                                ? "upcoming show"
                                : "upcoming shows"}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Trending Shows */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">Trending Shows</h2>
              <p className="text-sm text-muted-foreground">
                Upcoming concerts with the most buzz
              </p>
            </div>
            <Calendar className="h-5 w-5 text-primary" />
          </div>

          {!upcomingShows ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 rounded-lg border animate-pulse">
                  <div className="h-5 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : upcomingShows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No upcoming shows</p>
              <p className="text-sm mt-1">Check back for new announcements</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[
                upcomingShows.slice(0, 6),
                upcomingShows.slice(6, 12),
              ]
                .filter((row) => row.length > 0)
                .map((row, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="-mx-4 px-4 flex gap-3 overflow-x-auto pb-2 sm:mx-0 sm:px-0 scrollbar-none"
                  >
                    {row.map((show: any) => (
                      <button
                        key={show._id}
                        onClick={() =>
                          onShowClick(show._id as Id<"shows">, (show as any).slug)
                        }
                        className="flex-shrink-0 w-64 rounded-xl bg-card/80 border border-border hover:border-primary/50 transition-colors overflow-hidden text-left"
                      >
                        <div className="p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium text-sm text-foreground truncate">
                              {show.artist?.name || "Unknown Artist"}
                            </div>
                            {show.status && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                                {show.status}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {show.venue?.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">
                              {show.venue?.city}
                              {show.venue?.country
                                ? `, ${show.venue.country}`
                                : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(show.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                              {show.startTime && ` • ${show.startTime}`}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
            </div>
          )}
        </div>
