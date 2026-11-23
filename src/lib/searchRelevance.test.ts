// @vitest-environment node
import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import { matchesSearch, searchRank } from "../../shared/searchRelevance";
const modules = import.meta.glob("../../convex/**/*.{ts,js}");
describe("search intent", () => {
  it("matches full artist queries while allowing the final typed prefix", () => {
    expect(matchesSearch("Dave Matthews Band", "dave matthews")).toBe(true);
    expect(matchesSearch("Dave Matthews Band", "dave matt")).toBe(true);
    expect(matchesSearch("Dave's Song", "dave matthews")).toBe(false);
    expect(matchesSearch("Amarillo Highway (For Dave Hickey)", "dave matthews")).toBe(false);
    expect(matchesSearch("Déjà Vu", "deja vu")).toBe(true);
    expect(searchRank("John Mayer", "john mayer")).toBeLessThan(searchRank("John Mayer Trio", "john mayer"));
  });
  it("does not let partial song matches bury the requested artist", async () => {
    const t = convexTest({ schema, modules });
    await t.run(async ctx => {
      await ctx.db.insert("artists", { name: "Dave Matthews Band", slug: "dave-matthews-band", isActive: true });
      await ctx.db.insert("artists", { name: "Dave's Quartet", slug: "daves-quartet", isActive: true });
      const artistId = await ctx.db.insert("artists", { name: "Whitney", slug: "whitney", isActive: true });
      const venueId = await ctx.db.insert("venues", { name: "Metro", city: "Chicago", country: "US" });
      const showId = await ctx.db.insert("shows", { artistId, venueId, date: "2026-01-01", status: "completed" });
      const songId = await ctx.db.insert("performedSongs", { title: "Dave's Song", songKey: "dave s song" });
      await ctx.db.insert("songPerformances", { showId, songId, title: "Dave's Song", date: "2026-01-01" });
    });
    expect((await t.query(api.artists.search, { query: "dave matthews" })).map(a => a.name)).toEqual(["Dave Matthews Band"]);
    expect((await t.query(api.songSearch.search, { query: "dave matthews" })).results).toEqual([]);
    expect((await t.query(api.songSearch.search, { query: "dave's song" })).results).toHaveLength(1);
  });
});
