import React from 'react'
import { Id } from '../../convex/_generated/dataModel'
import { UserPredictions } from './UserPredictions'

interface UserDashboardProps {
  onArtistClick: (artistId: Id<"artists">) => void;
  onShowClick: (showId: Id<"shows">) => void;
}

export function UserDashboard({ onArtistClick, onShowClick }: UserDashboardProps) {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8 relative z-10">
      {/* Simple Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Your Activity</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Track your votes and setlist contributions
        </p>
      </div>

      {/* User Activity Dashboard */}
      <UserPredictions />
    </div>
  );
}