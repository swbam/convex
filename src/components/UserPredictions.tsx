import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MagicCard } from './ui/magic-card';
import { Calendar, MapPin, Music, Vote } from 'lucide-react';

export function UserPredictions() {
  const votingActivity = useQuery(api.predictions.getUserActivity, { limit: 50 });
  const setlistContributions = useQuery(api.predictions.getUserSetlistContributions, { limit: 20 });

  if (!votingActivity || !setlistContributions) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Simple Stats */}
      <div className="grid grid-cols-2 gap-4">
        <MagicCard className="p-6 text-center">
          <div className="text-3xl font-bold text-primary mb-2">{votingActivity.length}</div>
          <div className="text-sm text-muted-foreground">Song Votes</div>
        </MagicCard>
        
        <MagicCard className="p-6 text-center">
          <div className="text-3xl font-bold text-primary mb-2">{setlistContributions.length}</div>
          <div className="text-sm text-muted-foreground">Setlist Contributions</div>
        </MagicCard>
      </div>

      {/* Recent Voting Activity */}
      <div>
        <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
          <Vote className="h-5 w-5 text-primary" />
          Recent Votes
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {votingActivity.slice(0, 10).map((vote) => (
            <MagicCard key={vote._id} className="p-4 group cursor-pointer hover:scale-[1.01] transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {vote.show.artist?.name}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{vote.show.venue?.name}</span>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  {new Date(vote.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <div className="bg-primary/20 text-primary px-2 py-1 rounded-lg font-medium">
                  Voted: {vote.songTitle}
                </div>
              </div>
            </MagicCard>
          ))}
        </div>
        
        {votingActivity.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Vote className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No votes yet</p>
            <p className="text-sm">Start voting on setlists to see your activity here</p>
          </div>
        )}
      </div>

      {/* Setlist Contributions */}
      <div>
        <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          Your Setlist Contributions
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {setlistContributions.map((contribution) => (
            <MagicCard key={contribution._id} className="p-4 group cursor-pointer hover:scale-[1.01] transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {contribution.show.artist?.name}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{contribution.show.venue?.name}</span>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  {new Date(contribution.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(contribution.show.date).toLocaleDateString()}</span>
                </div>
                
                <div className="bg-accent/30 px-2 py-1 rounded-lg text-xs font-medium">
                  {contribution.songsCount} songs added
                </div>
              </div>
            </MagicCard>
          ))}
        </div>
        
        {setlistContributions.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No contributions yet</p>
            <p className="text-sm">Add songs to setlists to see your contributions here</p>
          </div>
        )}
      </div>
    </div>
  );
}
