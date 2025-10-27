import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ChevronUp } from "lucide-react";
import { motion } from 'framer-motion';
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
    // FIXED: Only show sign-in modal AFTER user has tried voting once
    if (!user) {
      const hasTriedVoting = localStorage.getItem('hasTriedVoting') === 'true';
      
      if (hasTriedVoting) {
        toast.info("Sign in to vote on setlists");
        onSignInRequired?.();
      } else {
        // Mark that user has tried voting once
        localStorage.setItem('hasTriedVoting', 'true');
        toast.info("Sign in to save your vote");
        onSignInRequired?.();
      }
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
    <motion.button
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.05 }}
      onClick={handleVote}
      disabled={isVoting}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 border ${
        hasVoted 
          ? "bg-primary/20 text-primary border-primary/30" 
          : "bg-white/5 text-gray-300 hover:bg-white/10 border-white/10"
      }`}
      title="Upvote this setlist"
    >
      <ChevronUp 
        className={`h-4 w-4 ${hasVoted ? "fill-current" : ""}`} 
      />
      <span className={`font-semibold text-sm ${hasVoted ? "text-primary" : "text-gray-300"}`}>
        {voteCount}
      </span>
    </motion.button>
  );
}
