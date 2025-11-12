import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MagicCard } from './ui/magic-card';
import { Calendar, MapPin, Music, Vote } from 'lucide-react';

export function UserPredictions() {
  const songVotes = useQuery(api.songVotes.getUserVotes, { limit: 50 });

  if (!songVotes) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  if (songVotes.length === 0) {
    return (
      <div className="text-center py-16">
        <Vote className="h-16 w-16 mx-auto mb-6 text-muted-foreground opacity-50" />
        <h3 className="text-xl font-semibold mb-2">No voting activity yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          Start voting on setlists to see your activity here
        </p>
        <button 
          onClick={() => window.location.href = '/shows'}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium"
        >
          Browse Shows
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Simple Stats */}
      <div className="grid grid-cols-2 gap-4">
        <MagicCard className="p-6 text-center bg-card">
          <div className="text-3xl font-bold mb-2 text-white">{songVotes.length}</div>
          <div className="text-sm text-gray-400">Total Votes</div>
        </MagicCard>
        
        <MagicCard className="p-6 text-center bg-card">
          <div className="text-3xl font-bold mb-2 text-white">
            {new Set(songVotes.map(v => v.setlistId)).size}
          </div>
          <div className="text-sm text-gray-400">Shows Voted On</div>
        </MagicCard>
      </div>

      {/* Voting History */}
      <div>
        <h2 className="text-xl font-semibold mb-6">Your Recent Votes</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {songVotes.map((vote) => (
            <MagicCard key={vote._id} className="p-4 bg-card">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-base mb-1 truncate">
                    {vote.songTitle}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Music className="h-3 w-3" />
                    <span>Upvoted</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(vote.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-sm font-medium text-primary">
                    +1
                  </div>
                </div>
              </div>
            </MagicCard>
          ))}
        </div>
      </div>
    </div>
  );
}