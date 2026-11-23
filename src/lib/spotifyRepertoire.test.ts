// @vitest-environment node
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
import { repertoireTitle, selectRepertoireTracks, RELATED_REPERTOIRE } from "../../convex/lib/spotifyRepertoire";
const modules = import.meta.glob("../../convex/**/*.{ts,js}");
const priv = internal as any;

function track(name: string, artist = "mayer", album = "Continuum") {
  return { id: name, name, artists: [{ id: artist, name: artist }], album_info: { name: album } };
}

describe("requestable Spotify repertoire", () => {
  it.each([
    ["Who Did You Think I Was - Live In Concert", "Who Did You Think I Was"],
    ["Another Kind of Green (Live at the House of Blues)", "Another Kind of Green"],
    ["Daughters - Acoustic", "Daughters"],
    ["Gravity - 2015 Remaster", "Gravity"],
    ["Live Forever", "Live Forever"],
    ["Stop This Train", "Stop This Train"],
    ["Song (A Meaningful Subtitle)", "Song (A Meaningful Subtitle)"],
    ["Gravity - Club Remix", null],
    ["Album Commentary", null],
    ["Song A / Song B", null],
    ["Daughters - Home Demo", "Daughters"],
    ["Automatic Yes (feat. John Mayer) - Instrumental", "Automatic Yes (feat. John Mayer)"],
    ["Automatic Yes - Acapella", "Automatic Yes"],
    ["83 Medley", null],
    ["Blues Intro", null],
  ])("normalizes %s without discarding a distinct composition", (input, output) => {
    expect(repertoireTitle(input)).toBe(output);
  });
  it("retains live-only, acoustic and deluxe material, prefers studio duplicates, and checks track credits", () => {
    const result = selectRepertoireTracks([
      track("Gravity - Live In Concert", "trio", "Try! - Live In Concert"),
      track("Gravity"), track("Another Kind Of Green - Live In Concert", "trio", "Try!"),
      track("Bonus Song", "mayer", "Deluxe Edition"), track("Acoustic Only - Acoustic"),
      track("Wrong artist", "unrelated", "Compilation"),
    ], new Set(["mayer", "trio"]));
    expect(result.map(t => t.repertoireTitle).sort()).toEqual(["Acoustic Only", "Another Kind Of Green", "Bonus Song", "Gravity"]);
    expect(result.find(t => t.repertoireTitle === "Gravity").name).toBe("Gravity");
    expect(RELATED_REPERTOIRE["0hEurMDQu99nJRq8pTxO14"].map(a => a.name)).toEqual(["John Mayer Trio"]);
    expect(RELATED_REPERTOIRE["unrelated"]).toBeUndefined();
  });
  it("retries idempotently, keeps requests unchanged, and exposes supplemental songs to the picker", async () => {
    const t = convexTest({ schema, modules });
    const ids = await t.run(async ctx => {
      const artistId = await ctx.db.insert("artists", { name: "John Mayer", slug: "john-mayer", isActive: true });
      const venueId = await ctx.db.insert("venues", { name: "Sphere", city: "Las Vegas", country: "US" });
      const showId = await ctx.db.insert("shows", { artistId, venueId, date: "2027-04-08", status: "upcoming" });
      const songId = await ctx.db.insert("songs", { title: "Gravity", isLive: false, isRemix: false });
      await ctx.db.insert("artistSongs", { artistId, songId, isPrimaryArtist: true });
      const setlistId = await ctx.db.insert("setlists", { showId, isOfficial: false, songs: [{ title: "Gravity", songId }], songVoteCount: 5 });
      return { artistId, songId, setlistId };
    });
    const before = await t.run(ctx => ctx.db.get(ids.setlistId));
    const args = { artistId: ids.artistId, tracks: ["Gravity", "Another Kind Of Green"].map(title => ({ title, album: "Try!", spotifyId: title, sourceArtistName: "John Mayer Trio", sourceSpotifyArtistId: "trio", sourceTrackTitle: title + " - Live In Concert" })) };
    expect(await t.mutation(priv.catalogRepertoire.mergeSpotifyTracks, args)).toEqual({ added: 1, processed: 2 });
    expect(await t.mutation(priv.catalogRepertoire.mergeSpotifyTracks, args)).toEqual({ added: 0, processed: 2 });
    const songs = await t.query(api.songs.getByArtist, { artistId: ids.artistId, limit: 500 });
    expect(songs).toHaveLength(2);
    expect(songs.find((s: any) => s.title === "Gravity")._id).toBe(ids.songId);
    expect(songs.find((s: any) => s.title === "Another Kind Of Green").repertoireSource).toBe("spotify_repertoire");
    expect(await t.run(ctx => ctx.db.get(ids.setlistId))).toEqual(before);
  });
  it("allows a targeted repair after a completed sync but never interrupts an active job", async () => {
    const t = convexTest({ schema, modules });
    const artistId = await t.run(ctx => ctx.db.insert("artists", { name: "John", slug: "john", isActive: true, catalogSyncStatus: "completed", catalogSyncAttemptedAt: Date.now() }));
    expect(await t.mutation(priv.catalogSync.begin, { artistId })).toBeNull();
    expect(await t.mutation(priv.catalogSync.begin, { artistId, force: true })).toBeTypeOf("number");
    expect(await t.mutation(priv.catalogSync.begin, { artistId, force: true })).toBeNull();
  });
});
