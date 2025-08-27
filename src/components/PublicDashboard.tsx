import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TrendingUp, Calendar, Music, Play, Users, MapPin, Clock, Plus, Heart, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PublicDashboardProps {
  onArtistClick: (artistId: Id<"artists">) => void;
  onShowClick: (showId: Id<"shows">) => void;
  onSignInRequired: () => void;
}

export function PublicDashboard({ onArtistClick, onShowClick, onSignInRequired }: PublicDashboardProps) {
  const trendingArtists = useQuery(api.artists.getTrending, { limit: 20 });
  const upcomingShows = useQuery(api.shows.getUpcoming, { limit: 15 });
  const recentShows = useQuery(api.shows.getRecent, { limit: 10 });
  const stats = useQuery(api.dashboard.getStats);
  const user = useQuery(api.auth.loggedInUser);

  const [anonymousActions, setAnonymousActions] = useState(0);
  const followArtist = useMutation(api.artists.followArtist);

  const handleAnonymousAction = () => {
    if (anonymousActions >= 1) {
      onSignInRequired();
      return false;
    }
    setAnonymousActions(prev => prev + 1);
    return true;
  };

  const handleFollowArtist = async (artistId: Id<"artists">, artistName: string) => {
    if (!user && !handleAnonymousAction()) return;
    
    try {
      if (user) {
        const isFollowing = await followArtist({ artistId });
        toast.success(isFollowing ? `Following ${artistName}` : `Unfollowed ${artistName}`);
      } else {
        toast.success(`Added ${artistName} to your interests`);
      }
    } catch (error) {
      toast.error("Failed to follow artist");
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      {/* Hero Section */}
      <div className="text-center py-12">
        <h1 className="text-5xl font-bold gradient-text mb-4">
          Discover Live Music
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          Real-time trending artists, upcoming shows, and setlist predictions
        </p>
        <p className="text-muted-foreground/60">
          Powered by Spotify, Ticketmaster, and community data
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard
          icon={<Music className="h-6 w-6" />}
          title="Artists"
          value={stats?.totalArtists || 0}
          subtitle="tracked"
        />
        <StatCard
          icon={<Calendar className="h-6 w-6" />}
          title="Shows"
          value={stats?.totalShows || 0}
          subtitle="upcoming"
        />
        <StatCard
          icon={<Users className="h-6 w-6" />}
          title="Setlists"
          value={stats?.totalSetlists || 0}
          subtitle="predicted"
        />
        <StatCard
          icon={<TrendingUp className="h-6 w-6" />}
          title="Active"
          value={stats?.activeUsers || 0}
          subtitle="users"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trending Artists - Takes up 2 columns */}
        <div className="lg:col-span-2">
          <div className="dashboard-card h-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-bold">Trending Artists</h2>
                <div className="pulse-dot ml-2"></div>
              </div>
              <div className="text-sm text-muted-foreground">
                Updated every 30 minutes
              </div>
            </div>
            
            {!trendingArtists ? (
              <TrendingArtistsLoading />
            ) : trendingArtists.length === 0 ? (
              <EmptyState 
                icon={<TrendingUp className="h-12 w-12" />}
                title="Loading trending artists..."
                subtitle="Our sync system is importing the latest data"
              />
            ) : (
              <div className="space-y-3">
                {trendingArtists.map((artist, index) => (
                  <TrendingArtistCard
                    key={artist._id}
                    artist={artist}
                    rank={index + 1}
                    onClick={() => onArtistClick(artist._id)}
                    onFollow={() => handleFollowArtist(artist._id, artist.name)}
                    isAuthenticated={!!user}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Shows */}
        <div>
          <div className="dashboard-card h-full">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold">Upcoming Shows</h2>
            </div>
            
            {!upcomingShows ? (
              <UpcomingShowsLoading />
            ) : upcomingShows.length === 0 ? (
              <EmptyState 
                icon={<Calendar className="h-8 w-8" />}
                title="Loading shows..."
                subtitle="Importing from Ticketmaster"
              />
            ) : (
              <div className="space-y-3">
                {upcomingShows.slice(0, 8).map((show) => (
                  <UpcomingShowCard
                    key={show._id}
                    show={show}
                    onClick={() => onShowClick(show._id)}
                    onArtistClick={onArtistClick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Shows */}
      <div className="dashboard-card">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Recent Shows</h2>
        </div>
        
        {!recentShows ? (
          <RecentShowsLoading />
        ) : recentShows.length === 0 ? (
          <EmptyState 
            icon={<Clock className="h-12 w-12" />}
            title="Loading recent shows..."
            subtitle="Building show history database"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentShows.map((show) => (
              <RecentShowCard
                key={show._id}
                show={show}
                onClick={() => onShowClick(show._id)}
                onArtistClick={onArtistClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="dashboard-card text-center py-12">
        <h3 className="text-2xl font-bold mb-4">Join the Community</h3>
        <p className="text-muted-foreground mb-6">
          Create setlist predictions, vote on songs, and compete with other music fans
        </p>
        <button
          onClick={onSignInRequired}
          className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, subtitle }: {
  icon: React.ReactNode;
  title: string;
  value: number;
  subtitle: string;
}) {
  return (
    <div className="dashboard-card">
      <div className="flex items-center gap-3">
        <div className="text-primary">{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">{title} {subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function TrendingArtistCard({ artist, rank, onClick, onFollow, isAuthenticated }: {
  artist: any;
  rank: number;
  onClick: () => void;
  onFollow: () => void;
  isAuthenticated: boolean;
}) {
  return (
    <div className="group flex items-center gap-4 p-4 rounded-lg hover:bg-accent/50 cursor-pointer transition-all duration-200">
      <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
        {rank}
      </div>
      
      <div className="flex items-center gap-4 flex-1" onClick={onClick}>
        {artist.images?.[0] && (
          <img
            src={artist.images[0]}
            alt={artist.name}
            className="w-16 h-16 rounded-lg object-cover"
          />
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{artist.name}</h3>
          {artist.genres && artist.genres.length > 0 && (
            <p className="text-muted-foreground text-sm truncate">
              {artist.genres.slice(0, 2).join(", ")}
            </p>
          )}
          <div className="flex items-center gap-4 mt-1">
            <div className="text-xs text-muted-foreground">
              {artist.followers?.toLocaleString()} followers
            </div>
            <div className="text-xs text-primary font-medium">
              {artist.trendingScore || 0} trending
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFollow();
          }}
          className="p-2 rounded-full hover:bg-accent transition-colors"
          title={isAuthenticated ? "Follow artist" : "Add to interests (1 free action)"}
        >
          <Heart className="h-4 w-4" />
        </button>
        <Play className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  );
}

function UpcomingShowCard({ show, onClick, onArtistClick }: {
  show: any;
  onClick: () => void;
  onArtistClick: (artistId: Id<"artists">) => void;
}) {
  const showDate = new Date(show.date);
  const isToday = showDate.toDateString() === new Date().toDateString();
  const isTomorrow = showDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
  
  let dateText = showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (isToday) dateText = "Today";
  else if (isTomorrow) dateText = "Tomorrow";

  return (
    <div className="trending-item" onClick={onClick}>
      <div className="flex-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onArtistClick(show.artistId);
          }}
          className="font-medium text-primary hover:underline text-left"
        >
          {show.artist?.name}
        </button>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{show.venue?.name}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {show.venue?.city}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium">{dateText}</div>
        <div className={`text-xs px-2 py-1 rounded-full ${
          isToday || isTomorrow 
            ? "bg-primary/20 text-primary" 
            : "bg-muted text-muted-foreground"
        }`}>
          {show.status}
        </div>
      </div>
    </div>
  );
}

function RecentShowCard({ show, onClick, onArtistClick }: {
  show: any;
  onClick: () => void;
  onArtistClick: (artistId: Id<"artists">) => void;
}) {
  return (
    <div className="trending-item" onClick={onClick}>
      <div className="flex-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onArtistClick(show.artistId);
          }}
          className="font-medium text-primary hover:underline text-left"
        >
          {show.artist?.name}
        </button>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{show.venue?.name}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(show.date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          })}
        </div>
      </div>
      <div className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
        {show.status}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <div className="opacity-50 mb-4 flex justify-center">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="text-sm mt-1">{subtitle}</p>
    </div>
  );
}

function TrendingArtistsLoading() {
  return (
    <div className="space-y-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-lg">
          <div className="w-8 h-8 bg-muted rounded-full shimmer"></div>
          <div className="w-16 h-16 bg-muted rounded-lg shimmer"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded shimmer"></div>
            <div className="h-3 bg-muted rounded w-2/3 shimmer"></div>
            <div className="h-3 bg-muted rounded w-1/2 shimmer"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UpcomingShowsLoading() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded shimmer"></div>
            <div className="h-3 bg-muted rounded w-2/3 shimmer"></div>
            <div className="h-3 bg-muted rounded w-1/2 shimmer"></div>
          </div>
          <div className="w-16 text-right space-y-1">
            <div className="h-3 bg-muted rounded shimmer"></div>
            <div className="h-6 bg-muted rounded shimmer"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentShowsLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="p-3 rounded-lg">
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded shimmer"></div>
            <div className="h-3 bg-muted rounded w-2/3 shimmer"></div>
            <div className="h-3 bg-muted rounded w-1/2 shimmer"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
