import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { MapPin, Search } from "lucide-react";

export function VenueSearch() {
  const [zipCode, setZipCode] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const venues = useQuery(api.venues.search, zipCode.length === 5 ? { query: zipCode, limit: 50 } : "skip");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipCode.trim() || zipCode.length !== 5) {
      toast.error("Please enter a valid 5-digit zip code");
      return;
    }

    setLoading(true);
    try {
      // Use the venues from the query instead of undefined searchVenues function
      if (venues) {
        setResults(venues);
        if (venues.length === 0) {
          toast.info("No venues found within 40 miles of this zip code");
        }
      }
    } catch (error) {
      toast.error("Failed to search venues");
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

        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              {results.length} venues found within 40 miles
            </h2>
            <div className="space-y-3">
              {results.map((venue) => (
                <VenueCard key={venue._id} venue={venue} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VenueCard({ venue }: { venue: any }) {
  return (
    <div className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{venue.name}</h3>
          <div className="flex items-center gap-1 text-muted-foreground mt-1">
            <MapPin className="h-4 w-4" />
            <span>{venue.city}, {venue.country}</span>
          </div>
          {venue.capacity && (
            <p className="text-sm text-muted-foreground mt-1">
              Capacity: {venue.capacity.toLocaleString()}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-primary">
            {venue.distance ? venue.distance.toFixed(1) : '0'} miles
          </div>
        </div>
      </div>
    </div>
  );
}
