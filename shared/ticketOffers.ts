import { hasShowEnded, type ShowTiming } from "../convex/lib/showTiming";

export type TicketKind = "admission" | "pass" | "extra";
export interface TicketInfo {
  name?: string;
  kind: TicketKind;
  saleStatus?: string;
  salesEndAt?: number;
}
export interface TicketListing extends ShowTiming {
  ticketUrl?: string;
  ticketInfo?: TicketInfo;
  startTime?: string;
  status?: string;
}
export interface TicketOffer {
  href: string;
  kind: "admission" | "pass";
  label: string;
}

export function ticketProduct(raw?: string, name = "", classification = ""): TicketKind | undefined {
  if (!raw) return;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname === "/") return;
    // Impact deep links carry the event path in the destination parameter.
    let path = url.pathname;
    const nested = url.searchParams.get("u");
    if (nested && /^\/c\/\d+\/\d+\/\d+\/?$/.test(path)) {
      const target = new URL(nested);
      if (target.protocol !== "https:" || target.username || target.password) return;
      if (target.hostname === "travel.ticketmaster.com") return "extra";
      path = target.pathname;
    }
    const words = (name + " " + classification + " " + decodeURIComponent(path))
      .toLowerCase().replace(/[^a-z0-9]+/g, " ");
    if (url.hostname === "travel.ticketmaster.com" || /(^|\.)eventtravel\.com$/.test(url.hostname) ||
        /\b(parking|shuttle|hotel|travel package|fast (lane|pass)|fastlane|upgrade[s]?|add on[s]?|addon[s]?|no (concert |event )?ticket|not (an? )?(event |concert )?ticket|lounge access|vip (package[s]?|experience|ticket[s]?)|premium (package[s]?|ticket[s]?)|meet (and |n )?greet)\b/.test(words)) return "extra";
    if (/\b((\d+|two|three|four|multi|multiple) (day|night)s? (ga |vip |general admission )?(pass(es)?|tickets?|bundle)|weekend pass(es)?|season (pass(es)?|tickets?)|full (festival|weekend) pass)\b/.test(words)) return "pass";
    return "admission";
  } catch {
    return;
  }
}

export function ticketsOpen(show: TicketListing, now = Date.now()): boolean {
  if (show.status === "completed" || show.status?.startsWith("cancel") ||
      /^(offsale|cancelled|canceled|postponed)$/i.test(show.ticketInfo?.saleStatus ?? "")) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(show.date) || !Number.isFinite(Date.parse(show.date))) return false;
  if (show.ticketInfo?.salesEndAt !== undefined && now >= show.ticketInfo.salesEndAt) return false;
  return !hasShowEnded(show, now);
}

export function performanceTime(listing: TicketListing): string {
  return listing.startTime?.match(/^(\d\d:\d\d)/)?.[1] ?? "";
}

/** The caller supplies listings for one artist, venue and show day. */
export function selectTicketOffers(anchor: TicketListing, siblings: TicketListing[] = [], now = Date.now()): TicketOffer[] {
  if (anchor.status === "completed" || anchor.status?.startsWith("cancel")) return [];
  const offers: Array<TicketOffer & { time: string; name?: string }> = [];
  const seen = new Set<string>();
  const anchorKind = anchor.ticketInfo?.kind ?? ticketProduct(anchor.ticketUrl);
  const anchorTime = performanceTime(anchor);
  for (const row of [anchor, ...siblings]) {
    if (!row.ticketUrl || seen.has(row.ticketUrl) || !ticketsOpen(row, now)) continue;
    const kind = row.ticketInfo?.kind ?? ticketProduct(row.ticketUrl);
    if (!kind || kind === "extra" || !ticketProduct(row.ticketUrl)) continue;
    const time = performanceTime(row);
    if (kind === "admission" && anchorKind === "admission" && anchorTime && time && time !== anchorTime) continue;
    seen.add(row.ticketUrl);
    offers.push({ href: row.ticketUrl, kind, time, name: row.ticketInfo?.name, label: kind === "pass" ? "Multi-day pass" : "Get tickets" });
  }
  const admissions = offers.filter(o => o.kind === "admission");
  const passes = offers.filter(o => o.kind === "pass");
  return [...admissions, ...passes].map(offer => {
    const group = offer.kind === "admission" ? admissions : passes;
    let label = offer.label;
    if (group.length > 1) {
      const time = offer.time;
      label = time && group.filter(o => o.time === time).length === 1
        ? label + " · " + time
        : offer.name && group.filter(o => o.name === offer.name).length === 1
          ? offer.name : label + " · option " + (group.indexOf(offer) + 1);
    }
    return { href: offer.href, kind: offer.kind, label };
  });
}
