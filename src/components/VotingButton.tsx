import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";

interface VotingButtonProps {
  setlistId: Id<"setlists">;
  onSignInRequired?: () => void;
}

export function VotingButton({ setlistId, onSignInRequired }: VotingButtonProps) {
  const [isVoting, setIsVoting] = useState(false);
  const user = useQuery(api.auth.loggedInUser);
  const userVote = useQuery(api.setlists.getUserVote, { setlistId });
  const voteOnSetlist = useMutation(api.setlists.vote);

  const handleVote = async (voteType: "up" | "down") => {
    if (!user) {
      onSignInRequired?.();
      return;
    }

    setIsVoting(true);
    try {
      const result = await voteOnSetlist({ setlistId, voteType });
      if (result === "added") {
        toast.success(`${voteType === "up" ? "Upvoted" : "Downvoted"} setlist`);
      } else if (result === "removed") {
        toast.success("Vote removed");
      } else {
        toast.success("Vote changed");
      }
    } catch (error) {
      toast.error("Failed to vote");
      console.error("Vote failed:", error);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote("up")}
        disabled={isVoting}
        className={`p-2 rounded-full transition-colors ${
          userVote === "up"
            ? "bg-green-500/20 text-green-500"
            : "hover:bg-accent text-muted-foreground"
        }`}
        title="Upvote this setlist"
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      
      <button
        onClick={() => handleVote("down"))
        disabled={isVoting}
        className={`p-2 rounded-full transition-colors ${
          userVote === "down"
            ? "bg-red-500/20 text-red-500"
            : "hover:bg-accent text-muted-foreground"
        }`}
        title="Downvote this setlist"
      >
        <ThumbsDown className="h-4 w-4" />
      </button>
    </div>
  );
}
