import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { performanceTime, selectTicketOffers } from "../../shared/ticketOffers";

type Show = Doc<"shows">;
const slugWithTime = /^(.*-\d{4}-\d{2}-\d{2})-([01]\d|2[0-3])-([0-5]\d)(?:-[0-5]\d)?$/;

export function dateOnlySlug(slug: string) {
  return slugWithTime.exec(slug)?.[1] ?? slug;
}

function sameEventGroup(anchor: Show, other: Show) {
  return anchor.artistId === other.artistId && anchor.venueId === other.venueId &&
    anchor.date === other.date && anchor.festivalId === other.festivalId &&
    anchor.stageName === other.stageName && anchor.setTime === other.setTime &&
    (!anchor.slug || !other.slug || dateOnlySlug(anchor.slug) === dateOnlySlug(other.slug));
}

export async function canonicalShowKey(ctx: QueryCtx, anchor: Show) {
  const firstAtSlug = anchor.slug ? await ctx.db.query("shows")
    .withIndex("by_slug", q => q.eq("slug", anchor.slug)).first() : null;
  // A direct ID for another performance must survive URL canonicalization.
  return firstAtSlug?._id === anchor._id ? anchor.slug! : String(anchor._id);
}

export async function showWithTickets(ctx: QueryCtx, anchor: Show) {
  // Fetch a single artist/date range, including older ingestion paths which
  // stored a time suffix. Keep voting, setlists and private reports on their original IDs.
  const rows = await ctx.db.query("shows")
    .withIndex("by_artist_and_date", q => q.eq("artistId", anchor.artistId).eq("date", anchor.date))
    .take(100);
  const siblings = rows.filter(row => sameEventGroup(anchor, row));
  const ticketOffers = selectTicketOffers(anchor, siblings);
  const admissions = ticketOffers.filter(offer => offer.kind === "admission");
  const canonicalKey = await canonicalShowKey(ctx, anchor);
  return { ...anchor, canonicalKey, ticketOffers, ticketUrl: admissions.length === 1 ? admissions[0].href : undefined };
}

export async function resolveShowKey(ctx: QueryCtx, key: string) {
  const id = ctx.db.normalizeId("shows", key);
  const exact = id ? await ctx.db.get(id) : await ctx.db.query("shows")
    .withIndex("by_slug", q => q.eq("slug", key)).first();
  if (exact) return showWithTickets(ctx, exact);

  const match = slugWithTime.exec(key);
  if (!match) return null;
  const rows = await ctx.db.query("shows").withIndex("by_slug", q => q.eq("slug", match[1])).take(100);
  const sameTime = rows.find(row => performanceTime(row) === match[2] + ":" + match[3]);
  const anchor = sameTime ?? (rows.length === 1 ? rows[0] : undefined);
  return anchor ? showWithTickets(ctx, anchor) : null;
}
