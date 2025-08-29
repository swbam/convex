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
  const submitVote = useMutation(api.setlists.submitVote);

  const handleVote = async (voteType: "up" | "down") => {
    if (!user) {
      onSignInRequired?.();
      return;
    }

    setIsVoting(true);
    try {
      await submitVote({ setlistId, voteType: voteType === "up" ? "accurate" : "inaccurate" });
      toast.success(voteType === "up" ? "Upvoted setlist" : "Downvoted setlist");
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
          userVote === "accurate"
            ? "bg-muted/20 text-foreground"
            : "hover:bg-accent text-muted-foreground"
        }`}
        title="Upvote this setlist"
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      
      <button
        onClick={() => handleVote("down")}
        disabled={isVoting}
        className={`p-2 rounded-full transition-colors ${
          userVote === "inaccurate"
            ? "bg-muted/20 text-foreground"
            : "hover:bg-accent text-muted-foreground"
        }`}
        title="Downvote this setlist"
      >
        <ThumbsDown className="h-4 w-4" />
      </button>
    </div>
  );
}
