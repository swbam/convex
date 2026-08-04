import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ChevronUp } from "lucide-react";
import { motion } from 'framer-motion';
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
  const voteData = useQuery(api.setlists.getSetlistVotes, { setlistId });

  const serverVoteCount = voteData?.accurate || 0;
  const serverHasVoted = userVote === "accurate";

  // Optimistic state for instant tap feedback; clears once the reactive
  // server values catch up.
  const [optimistic, setOptimistic] = useState<
    { voted: boolean; count: number } | null
  >(null);

  useEffect(() => {
    setOptimistic(null);
  }, [serverVoteCount, serverHasVoted]);

  const voteCount = optimistic?.count ?? serverVoteCount;
  const hasVoted = optimistic?.voted ?? serverHasVoted;

  const handleVote = async () => {
    if (!user) {
      toast.info("Sign in to vote on setlists");
      onSignInRequired?.();
      return;
    }

    // Already upvoted (this vote is one-way) — nothing to do.
    if (hasVoted || isVoting) return;

    setOptimistic({ voted: true, count: voteCount + 1 });
    setIsVoting(true);
    try {
      await submitVote({ setlistId, voteType: "accurate" });
    } catch (error) {
      setOptimistic(null);
      toast.error("Failed to vote");
      console.error("Vote failed:", error);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => void handleVote()}
      disabled={isVoting}
      aria-pressed={hasVoted}
      className={`inline-flex items-center justify-center gap-2 px-4 min-h-[44px] min-w-[44px] rounded-full transition-colors duration-200 border ${
        hasVoted
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-secondary text-muted-foreground border-border active:bg-secondary/80 sm:hover:text-foreground"
      }`}
      title="Upvote this setlist"
    >
      <ChevronUp
        className={`h-4 w-4 ${hasVoted ? "fill-current" : ""}`}
      />
      <span className="font-semibold text-sm tabular-nums">
        {voteCount}
      </span>
    </motion.button>
  );
}
