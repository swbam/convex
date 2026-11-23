import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { ticketProduct, type TicketInfo } from "../../shared/ticketOffers";
import { parseProviderTimestamp } from "./showTiming";

export const ticketInfoValidator = v.optional(v.object({
  name: v.optional(v.string()),
  kind: v.union(v.literal("admission"), v.literal("pass"), v.literal("extra")),
  saleStatus: v.optional(v.string()),
  salesEndAt: v.optional(v.number()),
}));

interface ProviderEvent {
  name?: string;
  url?: string;
  classifications?: Array<{ type?: { name?: string }; subType?: { name?: string } }>;
  dates?: { status?: { code?: string } };
  sales?: { public?: { endDateTime?: string } };
}

export function discoveryTicketInfo(event: ProviderEvent): TicketInfo | undefined {
  const classification = event.classifications?.flatMap(c => [c.type?.name, c.subType?.name]).join(" ");
  const kind = ticketProduct(event.url, event.name, classification);
  if (!kind) return;
  return {
    kind,
    name: event.name,
    saleStatus: event.dates?.status?.code,
    salesEndAt: parseProviderTimestamp(event.sales?.public?.endDateTime),
  };
}

// A trending event and its catalog show must describe the same provider listing.
export async function refreshLinkedTickets(
  ctx: MutationCtx,
  show: Doc<"shows">,
  event: { ticketmasterId: string; ticketUrl?: string; ticketInfo?: TicketInfo },
) {
  if (show.ticketmasterId !== event.ticketmasterId) return;
  const patch: Partial<Pick<Doc<"shows">, "ticketUrl" | "ticketInfo">> = {};
  if (event.ticketUrl && event.ticketUrl !== show.ticketUrl) patch.ticketUrl = event.ticketUrl;
  if (event.ticketInfo) {
    const info = show.ticketInfo;
    if (!info || info.kind !== event.ticketInfo.kind || info.name !== event.ticketInfo.name ||
        info.saleStatus !== event.ticketInfo.saleStatus || info.salesEndAt !== event.ticketInfo.salesEndAt) {
      patch.ticketInfo = event.ticketInfo;
    }
  }
  if (Object.keys(patch).length) await ctx.db.patch(show._id, patch);
}
