import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface VotingButtonProps {
  setlistId: string;
  songTitle: string;
}

export function VotingButton({ setlistId, songTitle }: VotingButtonProps) {
  const [userVote, setUserVote] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (value: 1 | -1) => {
    setIsVoting(true);
    try {
      // For now, just update local state
      setUserVote(userVote === value ? null : value);
    } catch (error) {
      console.error("Vote failed:", error);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote(1)}
        disabled={isVoting}
        className={`p-2 rounded-full transition-colors ${
          userVote === 1
            ? "bg-green-500/20 text-green-500"
            : "hover:bg-accent text-muted-foreground"
        }`}
        title="Upvote this song"
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      
      <button
        onClick={() => handleVote(-1)}
        disabled={isVoting}
        className={`p-2 rounded-full transition-colors ${
          userVote === -1
            ? "bg-red-500/20 text-red-500"
            : "hover:bg-accent text-muted-foreground"
        }`}
        title="Downvote this song"
      >
        <ThumbsDown className="h-4 w-4" />
      </button>
    </div>
  );
}
