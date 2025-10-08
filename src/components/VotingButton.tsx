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
    // Generate or get anonymous user ID from localStorage
    let anonId = localStorage.getItem('anonUserId');
    if (!anonId && !user) {
      anonId = `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('anonUserId', anonId);
    }

    // Check if anonymous user has already voted
    const hasVotedBefore = localStorage.getItem('hasVoted') === 'true';
    
    // FIXED: Only show sign-in modal AFTER user has tried voting once
    if (!user && hasVotedBefore) {
      toast.info("Sign in to vote on more setlists");
      onSignInRequired?.();
      return;
    }

    setIsVoting(true);
    try {
      await submitVote({ 
        setlistId, 
        voteType: "accurate",
        anonId: !user && anonId ? anonId : undefined,
      });
      
      // Mark that anonymous user has voted once
      if (!user) {
        localStorage.setItem('hasVoted', 'true');
      }
      
      toast.success("Upvoted setlist");
    } catch (error: any) {
      // Handle backend limit error gracefully
      if (error?.message?.includes("Anonymous users can only vote once")) {
        toast.info("Sign in to vote on more setlists");
        onSignInRequired?.();
      } else {
        toast.error("Failed to vote");
        console.error("Vote failed:", error);
      }
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
