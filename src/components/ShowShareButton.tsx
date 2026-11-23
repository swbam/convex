import { showShareUrl, type ShareOrigin } from "../../shared/showCampaign";
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
  source?: ShareOrigin;
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
  source = "fan",
  className,
}: ShowShareButtonProps) {
  const handleShare = async () => {
    const url = showShareUrl(window.location.origin, slug || showId, showId, source);
    const title = `${artistName}${venueName ? ` at ${venueName}` : ""} — setlists.live`;
    const text =
      mode === "setlist"
        ? `See the confirmed setlist${date ? ` from ${date}` : ""}.`
        : `Vote for the songs you want to hear${date ? ` on ${date}` : ""}.`;

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        capture("show_shared", { show_id: showId, method: "native_share", share_context: mode, share_origin: source });
        return;
      }
      await navigator.clipboard.writeText(url);
      capture("show_shared", { show_id: showId, method: "clipboard", share_context: mode, share_origin: source });
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
      aria-label={`Share ${artistName} ${mode === "setlist" ? "setlist" : "show voting link"}`}
    >
      <Share2 className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
