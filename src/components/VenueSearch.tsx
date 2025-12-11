import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { MapPin, Search, Loader2, Music } from "lucide-react";
import { formatTimeCompact, formatLocation } from "../lib/utils";

export function VenueSearch() {
  const [zipCode, setZipCode] = useState("");
  const [radius, setRadius] = useState(40); // Default 40 miles
  const [shows, setShows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const searchShowsByZipCode = useAction(api.ticketmaster.searchShowsByZipCode);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipCode.trim() || zipCode.length !== 5) {
      toast.error("Please enter a valid 5-digit zip code");
      return;
    }

    setLoading(true);
    try {
      console.log(`🔍 Searching for shows near ${zipCode} within ${radius} miles...`);
      
      const results = await searchShowsByZipCode({
        zipCode,
        radius,
        limit: 50,
      });
      
      console.log(`✅ Found ${results.length} shows`);
      setShows(results);
      
      if (results.length === 0) {
        toast.info(`No upcoming shows found within ${radius} miles of ${zipCode}`);
      } else {
        toast.success(`Found ${results.length} upcoming shows near you!`);
      }
    } catch (error) {
      toast.error("Failed to search shows");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Find Venues Near You</h1>
          <p className="text-muted-foreground">
            Enter your zip code to find concert venues within 40 miles
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative mb-8">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="Enter 5-digit zip code..."
            className="flex h-12 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            maxLength={5}
          />
          <button
            type="submit"
            disabled={loading || zipCode.length !== 5}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-4"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {shows.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">
              {shows.length} upcoming shows found within {radius} miles
            </h2>
            <div className="space-y-3">
              {shows.map((show) => (
                <ShowCard key={show.ticketmasterId} show={show} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShowCard({ show }: { show: any }) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 hover:bg-secondary transition-all duration-200 cursor-pointer">
      <div className="flex gap-4">
        {/* Artist Image */}
        {show.artistImage && (
          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-secondary">
            <img 
              src={show.artistImage} 
              alt={show.artistName}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        {/* Show Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-lg truncate mb-1">
            {show.artistName}
          </h3>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {show.venueName} • {formatLocation(show.venueCity, show.venueState)}
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              {formatDate(show.date)}
              {show.startTime && ` • ${formatTimeCompact(show.startTime)}`}
            </span>
            
            {show.priceRange && (
              <span className="text-primary font-medium">
                {show.priceRange}
              </span>
            )}
          </div>
        </div>
        
        {/* Ticket Link */}
        {show.ticketUrl && (
          <div className="flex items-center">
            <a
              href={show.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm font-medium transition-colors"
            >
              Tickets
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
