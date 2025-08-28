import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ArtistCard } from "./ArtistCard";
import { ShowCard } from "./ShowCard";
import { Heart, Music, Calendar, TrendingUp, Users } from "lucide-react";

interface LibraryProps {
  onArtistClick: (artistId: Id<"artists">, slug?: string) => void;
  onShowClick: (showId: Id<"shows">, slug?: string) => void;
}

export function Library({ onArtistClick, onShowClick }: LibraryProps) {
  const [activeTab, setActiveTab] = useState<"followed" | "setlists" | "votes">("followed");

  const user = useQuery(api.users.getCurrentUser);
  const userFollows = useQuery(api.users.getUserFollows);
  const userSetlists = useQuery(api.users.getUserSetlists);
  const userStats = useQuery(api.users.getUserStats);

  if (!user) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Heart className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-4">Sign in to view your library</h2>
        <p className="text-muted-foreground text-lg mb-8">
          Follow artists, create setlists, and track your music activity
        </p>
        <button className="px-8 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold">
          Sign In
        </button>
      </div>
    );
  }

  const tabs = [
    { id: "followed", label: "Followed Artists", icon: Heart, count: userFollows?.length || 0 },
    { id: "setlists", label: "My Setlists", icon: Music, count: userSetlists?.length || 0 },
    { id: "votes", label: "My Votes", icon: TrendingUp, count: userStats?.totalVotes || 0 },
  ] as const;

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">Your Library</h1>
          <p className="text-muted-foreground text-lg">
            Manage your followed artists and setlist predictions
          </p>
        </div>
        
        {userStats && (
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-400" />
              <span className="font-medium">{userStats.totalFollows} following</span>
            </div>
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-blue-400" />
              <span className="font-medium">{userStats.totalSetlists} setlists</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="font-medium">{userStats.totalVotes} votes</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="dashboard-card">
        <div className="flex border-b border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-6 py-4 font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "followed" && (
            <div>
              {!userFollows?.length ? (
                <div className="text-center py-16">
                  <Heart className="h-16 w-16 mx-auto mb-6 opacity-50" />
                  <h3 className="text-2xl font-semibold mb-4">No followed artists yet</h3>
                  <p className="text-muted-foreground text-lg mb-8">
                    Start following artists to see them here
                  </p>
                  <button 
                    onClick={() => onArtistClick("" as any)} 
                    className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold"
                  >
                    Discover Artists
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {userFollows.map((follow) => follow.artist && (
                    <ArtistCard
                      key={follow._id}
                      artist={follow.artist}
                      onClick={onArtistClick}
                      showFollowButton={false}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "setlists" && (
            <div>
              {!userSetlists?.length ? (
                <div className="text-center py-16">
                  <Music className="h-16 w-16 mx-auto mb-6 opacity-50" />
                  <h3 className="text-2xl font-semibold mb-4">No setlists created yet</h3>
                  <p className="text-muted-foreground text-lg mb-8">
                    Predict setlists for upcoming shows to see them here
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {userSetlists.map((setlist) => setlist.show && (
                    <div key={setlist._id} className="border rounded-xl p-6 hover:bg-muted/5 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <button
                            onClick={() => onArtistClick(setlist.show.artist._id, setlist.show.artist.slug)}
                            className="text-xl font-bold hover:text-primary transition-colors"
                          >
                            {setlist.show.artist?.name}
                          </button>
                          <button
                            onClick={() => onShowClick(setlist.show._id, setlist.show.slug)}
                            className="block text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {setlist.show.venue?.name} • {new Date(setlist.show.date).toLocaleDateString()}
                          </button>
                        </div>
                        <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                          {setlist.songs.length} songs
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Created {new Date(setlist._creationTime).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "votes" && (
            <div className="text-center py-16">
              <TrendingUp className="h-16 w-16 mx-auto mb-6 opacity-50" />
              <h3 className="text-2xl font-semibold mb-4">Voting history</h3>
              <p className="text-muted-foreground text-lg">
                You've cast {userStats?.totalVotes || 0} votes across all setlists
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
