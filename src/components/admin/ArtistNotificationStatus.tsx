import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { useState } from "react";

export function ArtistNotificationStatus() {
  const rows = useQuery((api as any).artistNotifications.listRecent, {});
  const retry = useMutation((api as any).artistNotifications.retry);
  const [busy, setBusy] = useState<string | null>(null);
  const retryEmail = async (id: string) => {
    setBusy(id);
    try { await retry({ id }); toast.success("Email queued for retry"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not retry email"); }
    finally { setBusy(null); }
  };
  return <section className="border-t border-border pt-6">
    <h3 className="text-lg font-semibold">Claim email status</h3>
    <p className="mt-1 text-sm text-muted-foreground">Delivery is confirmed only when reported by the email provider. Failed sends can be retried after checking the recipient and configuration.</p>
    {rows === undefined ? <p className="py-4 text-sm">Loading email status…</p> :
      !rows.length ? <p className="py-4 text-sm text-muted-foreground">Claim confirmations and decisions will appear here.</p> :
      <ul className="mt-4 divide-y divide-border">{rows.map((row: any) => <li key={row._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="font-medium">{row.artistName}</p>
          <p className="text-sm text-muted-foreground">{row.kind.replaceAll("_", " ")} · {row.status === "accepted" ? "Accepted by provider" : row.status}
            {row.deliveryStatus && row.deliveryStatus !== "unconfirmed" ? " · " + row.deliveryStatus : ""}</p>
          {row.lastError && <p className="mt-1 text-sm text-muted-foreground">{row.lastError}</p>}
        </div>
        {row.status === "failed" && <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void retryEmail(row._id)}>
          {busy === row._id ? "Queuing…" : "Retry email"}
        </Button>}
      </li>)}</ul>}
  </section>;
}

