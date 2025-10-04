import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "../lib/utils";

interface VotingButtonProps {
  setlistId: Id<"setlists">;
  onSignInRequired?: () => void;
}

export function VotingButton({ setlistId, onSignInRequired }: VotingButtonProps) {
  const [isVoting, setIsVoting] = useState(false);
  const user = useQuery(api.auth.loggedInUser);
  const userVote = useQuery(api.setlists.getUserVote, { setlistId });
  const submitVote = useMutation(api.setlists.submitVote);
  const voteData = useQuery(api.setlists.getSetlistVotes, { setlistId });

  const debouncedVote = useDebounce(async () => {
    if (!user) {
      onSignInRequired?.();
      return;
    }

    setIsVoting(true);
    try {
      await submitVote({ setlistId, voteType: "accurate" });
      toast.success("Upvoted setlist");
    } catch (error) {
      toast.error("Failed to vote");
      console.error("Vote failed:", error);
    } finally {
      setIsVoting(false);
    }
  }, 500);

  const handleVote = async () => {
    debouncedVote();
  };

  const voteCount = voteData?.accurate || 0;
  const hasVoted = userVote === "accurate";

  return (
    <button
      onClick={handleVote}
      disabled={isVoting}
      className={`flex flex-col items-center gap-0.5 transition-all duration-200 ${
        hasVoted 
          ? "text-primary" 
          : "text-gray-400 hover:text-white"
      }`}
      title="Upvote this setlist"
    >
      <ChevronUp 
        className={`h-5 w-5 ${hasVoted ? "fill-current" : ""}`} 
      />
      <span className={`font-semibold text-sm ${hasVoted ? "text-primary" : "text-gray-400"}`}>
        {voteCount}
      </span>
    </button>
  );
}
