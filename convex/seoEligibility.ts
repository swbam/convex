import { isFestivalListed } from "./lib/festivalIdentity";
import { selectOfficialSetlist } from "./lib/officialSetlist";
// Shared by metadata and sitemap publishing. An empty seeded prediction is not
// a confirmed setlist and never makes a historical page indexable.
export function isShowIndexable(status: string, actualSongCount: number) {
  return status === "upcoming" || status === "cancelled" || (status === "completed" && actualSongCount >= 3);
}
export async function isSitemapRecordIndexable(ctx: any, kind: string, doc: any) {
  if (!doc.slug) return false;
  if (kind === "shows") {
    if (doc.status === "completed") {
      const setlists = await ctx.db.query("setlists").withIndex("by_show", (q: any) => q.eq("showId", doc._id)).take(25);
      return isShowIndexable(doc.status, selectOfficialSetlist(setlists)?.actualSetlist?.length || 0);
    }
    return isShowIndexable(doc.status, 0);
  }
  if (kind === "artists" && !doc.isActive) return false;
  if (kind === "artists" || kind === "venues") {
    const field = kind === "artists" ? "artistId" : "venueId";
    const index = kind === "artists" ? "by_artist_status_and_date" : "by_venue_status_and_date";
    for (const status of ["upcoming", "completed"]) {
      if (await ctx.db.query("shows").withIndex(index, (q: any) => q.eq(field, doc._id).eq("status", status)).first()) return true;
    }
    return kind === "artists" && Boolean(await ctx.db.query("artistSongs").withIndex("by_artist", (q: any) => q.eq("artistId", doc._id)).first());
  }
  return kind === "festivals" && isFestivalListed(doc);
}
