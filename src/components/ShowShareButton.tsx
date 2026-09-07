import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { capture, captureException } from "../lib/analytics";

interface ShowShareButtonProps {
  showId: string;
  slug?: string;
  artistName?: string;
  venueName?: string;
  date?: string;
  label?: string;
  mode?: "voting" | "setlist";
  className?: string;
}

export function ShowShareButton({
  showId,
  slug,
  artistName = "this artist",
  venueName,
  date,
  label = "Share voting link",
  mode = "voting",
  className,
}: ShowShareButtonProps) {
  const handleShare = async () => {
    const key = slug || showId;
    const shareUrl = new URL(`/shows/${encodeURIComponent(key)}`, window.location.origin);
    shareUrl.searchParams.set("utm_source", "setlists.live");
    shareUrl.searchParams.set("utm_medium", "share");
    shareUrl.searchParams.set(
      "utm_campaign",
      mode === "setlist" ? "historical_setlist" : "show_voting",
    );
    const url = shareUrl.toString();
    const title = `${artistName}${venueName ? ` at ${venueName}` : ""} — setlists.live`;
    const text =
      mode === "setlist"
        ? `See the confirmed setlist${date ? ` from ${date}` : ""}.`
        : `Vote for the songs you want to hear${date ? ` on ${date}` : ""}.`;

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        capture("show_shared", { show_id: showId, method: "native_share", share_context: mode });
        return;
      }
      await navigator.clipboard.writeText(url);
      capture("show_shared", { show_id: showId, method: "clipboard", share_context: mode });
      toast.success(mode === "setlist" ? "Setlist link copied" : "Voting link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      captureException(error, { operation: "show_share", show_id: showId });
      toast.error("Could not share this show");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleShare}
      className={className}
      aria-label={`Share ${artistName} show voting link`}
    >
      <Share2 className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
