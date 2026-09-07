// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { hasShowEnded, parseProviderTimestamp } from "../../convex/lib/showTiming";
import { selectSetlistMatch } from "../../convex/lib/setlistMatch";

const modules = import.meta.glob("../../convex/**/*.{ts,js}");
const publicApi = api as any;
const privateApi = internal as any;
const NOW = Date.parse("2026-09-06T20:00:00Z");

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function setup() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const ids = await t.run(async ctx => {
    const artistId = await ctx.db.insert("artists", { name: "The Example", slug: "the-example", isActive: true });
    const userId = await ctx.db.insert("users", { authId: "applicant", username: "applicant", role: "user", createdAt: NOW });
    const adminId = await ctx.db.insert("users", { authId: "admin", username: "admin", role: "admin", createdAt: NOW });
    const venueId = await ctx.db.insert("venues", { name: "The Example Hall", city: "Chicago", country: "US" });
    return { artistId, userId, adminId, venueId };
  });
  const applicant = t.withIdentity({ subject: "applicant" });
  const admin = t.withIdentity({ subject: "admin" });
  return { t, applicant, admin, ...ids };
}

async function claimFixture() {
  const f = await setup();
  const result = await f.applicant.mutation(publicApi.artistClaims.startClaim, { artistId: f.artistId });
  expect(result.success).toBe(true);
  return { ...f, claimId: result.claimId as Id<"artistClaims"> };
}

async function verifiedFixture() {
  const f = await claimFixture();
  await f.applicant.mutation(privateApi.artistClaims.storeVerificationCode, {
    claimId: f.claimId, email: "manager@example.com", code: "123456",
  });
  expect(await f.applicant.mutation(publicApi.artistClaims.verifyEmailCode, {
    claimId: f.claimId, code: "123456",
  })).toMatchObject({ success: true });
  await f.applicant.mutation(publicApi.artistClaims.updateClaimDetails, {
    claimId: f.claimId, officialRole: "artist", officialWebsite: "https://example.com",
  });
  return f;
}

describe("linked Spotify credential boundary", () => {
  it("rejects anonymous imports before contacting providers", async () => {
    const f = await setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(f.t.action(publicApi.spotifyOAuth.importLinkedSpotify, {})).rejects.toThrow("Not authenticated");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails safely when the existing server credential is missing", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "");
    const f = await setup();
    await expect(f.applicant.action(publicApi.spotifyOAuth.importLinkedSpotify, {})).rejects.toThrow("not configured");
  });
  it("uses only the caller's linked token and never returns provider credentials", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "test-clerk-secret");
    const f = await setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("https://api.clerk.com/")) {
        expect(url).toContain("/users/applicant/oauth_access_tokens/oauth_spotify");
        expect(init?.headers).toEqual({ Authorization: "Bearer test-clerk-secret" });
        return Response.json({ data: [{ token: "test-spotify-token" }] });
      }
      expect(init?.headers).toEqual({ Authorization: "Bearer test-spotify-token" });
      if (url === "https://api.spotify.com/v1/me") return Response.json({ id: "spotify-listener" });
      if (url.includes("/following?")) return Response.json({ artists: { items: [] } });
      if (url.includes("/top/artists?")) return Response.json({ items: [] });
      throw new Error("Unexpected provider call");
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await f.applicant.action(publicApi.spotifyOAuth.importLinkedSpotify, {});
    expect(result).toMatchObject({ success: true, imported: 0, correlated: 0 });
    expect(JSON.stringify(result)).not.toContain("token");
    expect(await f.t.run(ctx => ctx.db.get(f.userId))).toMatchObject({ spotifyId: "spotify-listener" });
    expect(await f.t.run(ctx => ctx.db.query("spotifyTokens").collect())).toEqual([]);
    expect(await f.t.run(ctx => ctx.db.query("artistMembers").collect())).toEqual([]);
  });
  it("redacts provider failures and preserves existing account data", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "test-clerk-secret");
    const f = await setup();
    await f.t.run(ctx => ctx.db.patch(f.userId, { spotifyId: "existing-listener" }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("sensitive-provider-details", { status: 401 })));
    await expect(f.applicant.action(publicApi.spotifyOAuth.importLinkedSpotify, {})).rejects.toThrow("Please reconnect");
    expect(await f.t.run(ctx => ctx.db.get(f.userId))).toMatchObject({ spotifyId: "existing-listener" });
  });
});

describe("platform role trust", () => {
  it("does not promote a user through user-editable JWT metadata", async () => {
    const f = await setup();
    const untrusted = f.t.withIdentity({ subject: "applicant", unsafeMetadata: { role: "admin" } });
    await untrusted.mutation(publicApi.auth.ensureUserExists, {});
    expect(await f.t.run(ctx => ctx.db.get(f.userId))).toMatchObject({ role: "user" });
    const newUser = await f.t.withIdentity({ subject: "new-applicant", unsafeMetadata: { role: "admin" } }).mutation(publicApi.auth.createAppUser, {});
    expect(await f.t.run(ctx => ctx.db.get(newUser))).toMatchObject({ role: "user" });
  });
  it("ignores user-editable role metadata in both webhook paths", async () => {
    const f = await setup();
    const clerkUser = { id: "webhook-user", unsafe_metadata: { role: "admin" } };
    const id = await f.t.mutation(privateApi.users.upsertFromClerk, { clerkUser });
    await f.t.mutation(privateApi.users.updateFromClerk, { clerkUser });
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ role: "user" });
    await f.t.mutation(privateApi.users.updateFromClerk, { clerkUser: { ...clerkUser, public_metadata: { role: "admin" } } });
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ role: "admin" });
  });
});

describe("manual artist claims", () => {
  it("allows claims without Spotify, but does not grant membership", async () => {
    const f = await claimFixture();
    expect(await f.t.run(ctx => ctx.db.query("artistMembers").collect())).toEqual([]);
    expect(await f.applicant.query(publicApi.artistClaims.getClaim, { claimId: f.claimId })).toMatchObject({ status: "draft" });
  });
  it("does not expose the email code in applicant query responses", async () => {
    const f = await claimFixture();
    await f.applicant.mutation(privateApi.artistClaims.storeVerificationCode, { claimId: f.claimId, email: "a@example.com", code: "123456" });
    expect(await f.applicant.query(publicApi.artistClaims.getClaim, { claimId: f.claimId })).not.toHaveProperty("verificationCode");
    const claims = await f.applicant.query(publicApi.artistClaims.getMyClaims, {});
    expect(claims[0]).not.toHaveProperty("verificationCode");
    expect(await f.t.query(publicApi.artistClaims.getClaim, { claimId: f.claimId })).toBeNull();
  });
  it("rejects concurrent resend attempts before any external delivery", async () => {
    const f = await claimFixture();
    const args = { claimId: f.claimId, email: "a@example.com", code: "123456" };
    const attempts = await Promise.allSettled([
      f.applicant.mutation(privateApi.artistClaims.storeVerificationCode, args),
      f.applicant.mutation(privateApi.artistClaims.storeVerificationCode, args),
    ]);
    expect(attempts.filter(a => a.status === "fulfilled")).toHaveLength(1);
  });
  it("invalidates evidence and verified email when a new code is requested", async () => {
    const f = await verifiedFixture();
    vi.advanceTimersByTime(61000);
    await f.applicant.mutation(privateApi.artistClaims.storeVerificationCode, { claimId: f.claimId, email: "new@example.com", code: "654321" });
    const claim = await f.t.run(ctx => ctx.db.get(f.claimId));
    expect(claim).toMatchObject({ emailVerified: false, verificationCode: "654321" });
    expect(claim).not.toHaveProperty("emailVerifiedAt");
    expect(await f.applicant.mutation(publicApi.artistClaims.submitClaim, { claimId: f.claimId })).toMatchObject({ success: false });
  });
  it("cleans up an undeliverable code without deleting a newer code", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const f = await claimFixture();
    expect(await f.applicant.action(publicApi.artistClaims.requestEmailVerification, { claimId: f.claimId, email: "a@example.com" })).toMatchObject({ success: false });
    expect(await f.t.run(ctx => ctx.db.get(f.claimId))).not.toHaveProperty("verificationCode");
    vi.advanceTimersByTime(61000);
    await f.applicant.mutation(privateApi.artistClaims.storeVerificationCode, { claimId: f.claimId, email: "a@example.com", code: "654321" });
    await f.t.mutation(privateApi.artistClaims.clearFailedVerificationCode, { claimId: f.claimId, code: "123456" });
    expect(await f.t.run(ctx => ctx.db.get(f.claimId))).toMatchObject({ verificationCode: "654321" });
  });
  it("stores matching trusted-domain evidence without auto-approving", async () => {
    const f = await verifiedFixture();
    await f.t.run(ctx => ctx.db.insert("artistTrustedDomains", { artistId: f.artistId, domain: "example.com", websiteUrl: "https://example.com/", status: "active", source: "manual_admin", verifiedAt: NOW, verifiedBy: f.adminId }));
    expect(await f.applicant.mutation(publicApi.artistClaims.checkDomainMatch, { claimId: f.claimId })).toMatchObject({ autoApproved: false });
    expect(await f.t.run(ctx => ctx.db.query("artistMembers").collect())).toEqual([]);
  });
  it("rejects stale website responses and records fresh ones as evidence only", async () => {
    const f = await verifiedFixture();
    const original = await f.t.run(ctx => ctx.db.get(f.claimId));
    if (!original) throw new Error("Claim fixture missing");
    await f.applicant.mutation(publicApi.artistClaims.updateClaimDetails, { claimId: f.claimId, officialRole: "artist", officialWebsite: "https://new.example.com" });
    expect(await f.t.mutation(privateApi.artistClaims.completeWebsiteVerification, { claimId: f.claimId, expectedWebsite: original.officialWebsite, expectedRevision: original.verificationRevision, proofUrl: original.officialWebsite })).toEqual({ verified: false, autoApproved: false });
    const current = await f.t.run(ctx => ctx.db.get(f.claimId));
    if (!current) throw new Error("Claim fixture missing");
    expect(await f.t.mutation(privateApi.artistClaims.completeWebsiteVerification, { claimId: f.claimId, expectedWebsite: current.officialWebsite, expectedRevision: current.verificationRevision, proofUrl: current.officialWebsite })).toEqual({ verified: true, autoApproved: false });
    expect(await f.t.run(ctx => ctx.db.query("artistMembers").collect())).toEqual([]);
  });
  it("requires admin approval and an explicit role, then grants access once", async () => {
    const f = await verifiedFixture();
    await f.applicant.mutation(publicApi.artistClaims.submitClaim, { claimId: f.claimId });
    await expect(f.applicant.mutation(publicApi.artistClaims.approve, { claimId: f.claimId, role: "owner" })).rejects.toThrow("Admin");
    await expect(f.admin.mutation(publicApi.artistClaims.approve, { claimId: f.claimId })).rejects.toThrow("Select an access role");
    await f.admin.mutation(publicApi.artistClaims.approve, { claimId: f.claimId, role: "viewer" });
    await f.admin.mutation(publicApi.artistClaims.approve, { claimId: f.claimId, role: "owner" });
    expect(await f.t.run(ctx => ctx.db.query("artistMembers").collect())).toMatchObject([{ userId: f.userId, role: "viewer" }]);
    expect(await f.t.run(ctx => ctx.db.get(f.claimId))).toMatchObject({ status: "approved", verificationMethod: "manual_review", reviewedBy: f.adminId });
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.filter(job => job.name.includes("runManagedArtistWarmup"))).toHaveLength(1);
  });
  it("does not let the legacy create endpoint bypass verification", async () => {
    const f = await setup();
    const claim = await f.applicant.mutation(publicApi.artistClaims.create, { artistId: f.artistId });
    expect(claim.status).toBe("draft");
    expect(await f.applicant.mutation(publicApi.artistClaims.submitClaim, { claimId: claim.claimId })).toMatchObject({ success: false });
  });
  it("rejects an email code after five guesses or expiry", async () => {
    const f = await claimFixture();
    await f.applicant.mutation(privateApi.artistClaims.storeVerificationCode, { claimId: f.claimId, email: "a@example.com", code: "123456" });
    for (let i = 0; i < 5; i++) await f.applicant.mutation(publicApi.artistClaims.verifyEmailCode, { claimId: f.claimId, code: "000000" });
    expect(await f.applicant.mutation(publicApi.artistClaims.verifyEmailCode, { claimId: f.claimId, code: "123456" })).toMatchObject({ success: false });
    vi.advanceTimersByTime(61000);
    await f.applicant.mutation(privateApi.artistClaims.storeVerificationCode, { claimId: f.claimId, email: "a@example.com", code: "654321" });
    vi.advanceTimersByTime(16 * 60000);
    expect(await f.applicant.mutation(publicApi.artistClaims.verifyEmailCode, { claimId: f.claimId, code: "654321" })).toMatchObject({ success: false });
  });
});

describe("concert timing", () => {
  it("paginates status transitions without prematurely completing late shows", async () => {
    const f = await setup();
    const lateId = await f.t.run(async ctx => {
      for (let i = 0; i < 205; i++) await ctx.db.insert("shows", {
        artistId: f.artistId, venueId: f.venueId, date: "2026-09-01", status: "upcoming",
      });
      return await ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId,
        date: "2026-09-06", startsAt: NOW + 8 * 3600000, status: "upcoming" });
    });
    await f.t.mutation(privateApi.shows.autoTransitionStatuses, {});
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.t.run(ctx => ctx.db.query("shows").withIndex("by_status", q => q.eq("status", "completed")).collect())).toHaveLength(205);
    expect(await f.t.run(ctx => ctx.db.get(lateId))).toMatchObject({ status: "upcoming" });
  });
  it("selects the nearest 100 dashboard shows before limiting the query", async () => {
    const f = await setup();
    await f.t.run(async ctx => {
      await ctx.db.insert("artistMembers", { artistId: f.artistId, userId: f.userId, role: "viewer", createdAt: NOW });
      for (let i = 105; i > 0; i--) await ctx.db.insert("shows", {
        artistId: f.artistId, venueId: f.venueId, date: new Date(NOW + i * 86400000).toISOString().slice(0, 10), status: "upcoming",
      });
    });
    const home = await f.applicant.query(publicApi.artistDashboard.getArtistHome, { artistId: f.artistId });
    expect(home.shows).toHaveLength(100);
    expect(home.shows[0].date).toBe("2026-09-07");
  });
  it("does not complete tonight's late Chicago show at UTC midnight", () => {
    const show = { date: "2026-09-06", startsAt: Date.parse("2026-09-07T04:00:00Z"), timeZone: "America/Chicago" };
    expect(hasShowEnded(show, Date.parse("2026-09-07T00:30:00Z"))).toBe(false);
    expect(hasShowEnded(show, Date.parse("2026-09-07T10:00:00Z"))).toBe(true);
  });
  it("handles venue-local next mornings over DST changes", () => {
    const show = { date: "2026-10-31", timeZone: "America/Chicago" };
    expect(hasShowEnded(show, Date.parse("2026-11-01T11:59:00Z"))).toBe(false);
    expect(hasShowEnded(show, Date.parse("2026-11-01T12:00:00Z"))).toBe(true);
  });
  it("uses a conservative unknown-timezone fallback and rejects invalid dates", () => {
    expect(hasShowEnded({ date: "2026-09-06" }, Date.parse("2026-09-07T17:59:00Z"))).toBe(false);
    expect(hasShowEnded({ date: "2026-09-06" }, Date.parse("2026-09-07T18:00:00Z"))).toBe(true);
    expect(hasShowEnded({ date: "2026-02-30" }, NOW)).toBe(false);
    expect(parseProviderTimestamp("2026-09-06T20:00:00")).toBeUndefined();
    expect(parseProviderTimestamp("2026-09-06T20:00:00Z")).toBe(NOW);
  });
});

describe("catalog results and retry recovery", () => {
  const result = { albumsExpected: 2, albumsFailed: 0, tracksExpected: 10, tracksImported: 10, failedAlbumIds: [], failedTrackIds: [] };
  it("reserves one catalog import and recovers a stale action", async () => {
    const f = await setup();
    expect(await f.t.mutation(privateApi.catalogSync.begin, { artistId: f.artistId })).toBe(NOW);
    expect(await f.t.mutation(privateApi.catalogSync.begin, { artistId: f.artistId })).toBeNull();
    vi.advanceTimersByTime(31 * 60000);
    expect(await f.t.mutation(privateApi.catalogSync.begin, { artistId: f.artistId })).toBe(NOW + 31 * 60000);
    expect(await f.t.mutation(privateApi.catalogSync.finish, { artistId: f.artistId, attemptedAt: NOW, result })).toBe(false);
  });
  it("does not mark failed albums complete or advance the last complete timestamp", async () => {
    const f = await setup();
    await f.t.run(ctx => ctx.db.patch(f.artistId, { lastCatalogSyncAt: NOW - 86400000 }));
    const attemptedAt = await f.t.mutation(privateApi.catalogSync.begin, { artistId: f.artistId });
    await f.t.mutation(privateApi.catalogSync.finish, { artistId: f.artistId, attemptedAt, result: { ...result, albumsFailed: 1, failedAlbumIds: ["failed"] } });
    expect(await f.t.run(ctx => ctx.db.get(f.artistId))).toMatchObject({ catalogSyncStatus: "partial", lastCatalogSyncAt: NOW - 86400000, catalogSyncFailureCount: 1 });
  });
  it("clears the circuit breaker after a fully successful import", async () => {
    const f = await setup();
    await f.t.run(ctx => ctx.db.patch(f.artistId, { catalogSyncFailureCount: 3, catalogSyncLastFailure: NOW - 1000, catalogSyncBackoffUntil: NOW - 1 }));
    const attemptedAt = await f.t.mutation(privateApi.catalogSync.begin, { artistId: f.artistId });
    await f.t.mutation(privateApi.catalogSync.finish, { artistId: f.artistId, attemptedAt, result });
    const artist = await f.t.run(ctx => ctx.db.get(f.artistId));
    expect(artist).toMatchObject({ catalogSyncStatus: "completed", lastCatalogSyncAt: NOW, catalogSyncFailureCount: 0 });
    expect(artist).not.toHaveProperty("catalogSyncBackoffUntil");
    expect(artist).not.toHaveProperty("catalogSyncLastFailure");
  });
  it("retries by import time rather than unrelated metadata freshness", async () => {
    const f = await setup();
    const showId = await f.t.run(ctx => ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId, date: "2026-09-04", status: "completed", importStatus: "not_found", importNextAttemptAt: NOW - 1, importAttemptCount: 1, lastSynced: NOW }));
    expect(await f.t.query(privateApi.setlistfm.getCompletedShowsNeedingImport, {})).toMatchObject([{ _id: showId }]);
    expect(await f.t.mutation(privateApi.setlistfm.reserveCompletedShowImport, { showId })).toBe(true);
    expect(await f.t.mutation(privateApi.setlistfm.reserveCompletedShowImport, { showId })).toBe(false);
    vi.advanceTimersByTime(3600001);
    expect(await f.t.mutation(privateApi.setlistfm.reserveCompletedShowImport, { showId })).toBe(true);
  });
  it("initializes legacy imports, and preserves separate first-attempt/retry capacity", async () => {
    const f = await setup();
    await f.t.run(async ctx => {
      for (let i = 0; i < 35; i++) await ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId, date: "2026-09-04", status: "completed", ...(i < 10 ? { importStatus: "failed" as const, lastSynced: NOW - 86400000 } : {}) });
    });
    await f.t.mutation(privateApi.setlistfm.prepareCompletedShowImports, {});
    const selected = await f.t.query(privateApi.setlistfm.getCompletedShowsNeedingImport, {});
    expect(selected).toHaveLength(30);
    expect(selected.filter((s: any) => s.importAttemptCount === 0)).toHaveLength(20);
    expect(selected.filter((s: any) => s.importAttemptCount > 0)).toHaveLength(10);
  });
  it("prepares legacy records beyond the first page", async () => {
    const f = await setup();
    await f.t.run(async ctx => {
      for (let i = 0; i < 405; i++) await ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId, date: "2026-09-04", status: "completed" });
    });
    await f.t.mutation(privateApi.setlistfm.prepareCompletedShowImports, {});
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const shows = await f.t.run(ctx => ctx.db.query("shows").collect());
    expect(shows.every(s => s.importStatus === "pending" && s.importNextAttemptAt !== undefined)).toBe(true);
  });
});

describe("actual setlists", () => {
  const match = { id: "official-1", eventDate: "04-09-2026", artist: { name: "The Example" }, venue: { name: "The Example Hall", city: { name: "Chicago" } }, sets: { set: [{ song: [{ name: "First Song" }] }] } };
  const expected = { artistName: "The Example", date: "2026-09-04", venueName: "The Example Hall", city: "Chicago" };
  it("rejects adjacent-night, wrong-venue and ambiguous search matches", () => {
    expect(selectSetlistMatch([match], expected)).toBe(match);
    expect(selectSetlistMatch([{ ...match, eventDate: "03-09-2026" }], expected)).toBeNull();
    expect(selectSetlistMatch([{ ...match, venue: { ...match.venue, name: "Another Hall" } }], expected)).toBeNull();
    expect(selectSetlistMatch([match, { ...match, id: "duplicate" }], expected)).toBeNull();
  });
  it("records import analytics once, preserves predictions, and clears retries", async () => {
    const f = await setup();
    const showId = await f.t.run(ctx => ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId, date: "2026-09-04", status: "completed", importStatus: "importing", importNextAttemptAt: NOW + 3600000 }));
    const predictionId = await f.t.run(ctx => ctx.db.insert("setlists", { showId, songs: [{ title: "First Song" }], isOfficial: false }));
    await f.t.mutation(privateApi.setlists.createFromApi, { showId, data: match });
    await f.t.mutation(privateApi.setlists.createFromApi, { showId, data: match });
    const lists = await f.t.run(ctx => ctx.db.query("setlists").collect());
    expect(lists).toHaveLength(2);
    expect(lists.find(s => s._id === predictionId)).toMatchObject({ isOfficial: false, accuracy: 100 });
    const show = await f.t.run(ctx => ctx.db.get(showId));
    expect(show).toMatchObject({ importStatus: "completed", setlistfmId: match.id });
    expect(show).not.toHaveProperty("importNextAttemptAt");
    await f.t.mutation(privateApi.shows.updateImportStatus, { showId, status: "failed" });
    expect(await f.t.run(ctx => ctx.db.get(showId))).toMatchObject({ importStatus: "completed" });
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.filter(job => job.name.includes("analytics:capture"))).toHaveLength(1);
  });
  it("refuses an empty official import without modifying the show", async () => {
    const f = await setup();
    const showId = await f.t.run(ctx => ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId, date: "2026-09-04", status: "completed", importStatus: "pending" }));
    await expect(f.t.mutation(privateApi.setlists.createFromApi, { showId, data: { id: "empty", sets: { set: [] } } })).rejects.toThrow("empty");
    expect(await f.t.run(ctx => ctx.db.get(showId))).toMatchObject({ importStatus: "pending" });
  });
  it("records historical imports once and does not overwrite another venue's show", async () => {
    const f = await setup();
    const showId = await f.t.run(ctx => ctx.db.insert("shows", { artistId: f.artistId, venueId: f.venueId, date: "2026-09-04", status: "completed" }));
    const args = { artistId: f.artistId, setlistfmId: "history-1", date: "2026-09-04", venueName: "Other Hall", venueCity: "Chicago", songs: [{ title: "First Song", setNumber: 1, encore: false }] };
    expect(await f.t.mutation(privateApi.setlistfmHistory.upsertHistoricalSetlist, args)).toEqual({ created: true });
    expect(await f.t.mutation(privateApi.setlistfmHistory.upsertHistoricalSetlist, args)).toEqual({ created: false });
    expect(await f.t.run(ctx => ctx.db.get(showId))).not.toHaveProperty("setlistfmId");
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.filter(job => job.name.includes("analytics:capture"))).toHaveLength(1);
  });
});
