// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
const modules = import.meta.glob("../../convex/**/*.{ts,js}");
const priv = internal as any, pub = api as any;
const NOW = Date.parse("2026-10-23T02:00:00Z");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); vi.stubEnv("RESEND_API_KEY", "test"); vi.stubEnv("OWNER_NOTIFICATION_EMAIL", "owner@example.com"); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function fixture() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const ids = await t.run(async ctx => {
    const artistId = await ctx.db.insert("artists", { name: "Example & Friends", slug: "example", isActive: true });
    const userId = await ctx.db.insert("users", { authId: "applicant", username: "applicant", role: "user", createdAt: NOW });
    const adminId = await ctx.db.insert("users", { authId: "admin", username: "admin", role: "admin", createdAt: NOW });
    const claimId = await ctx.db.insert("artistClaims", { artistId, userId, status: "pending", createdAt: NOW,
      emailVerified: true, emailVerifiedAt: NOW, verificationEmail: "manager@example.com", officialRole: "manager" });
    return { artistId, userId, adminId, claimId };
  });
  await t.mutation(priv.artistNotifications.enqueue, { claimId: ids.claimId, kind: "submitted" });
  const row = (await t.run(ctx => ctx.db.query("artistNotifications").first()))!;
  return { t, ...ids, id: row._id, admin: t.withIdentity({ subject: "admin" }) };
}

describe("durable artist confirmations", () => {
  it("deduplicates enqueue and distinguishes acceptance from delivery", async () => {
    const f = await fixture();
    await f.t.mutation(priv.artistNotifications.enqueue, { claimId: f.claimId, kind: "submitted" });
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "email-1" }));
    vi.stubGlobal("fetch", fetcher);
    await f.t.action(priv.artistNotifications.send, { id: f.id });
    await f.t.action(priv.artistNotifications.send, { id: f.id });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await f.t.run(ctx => ctx.db.query("artistNotifications").collect())).toHaveLength(1);
    expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "accepted", deliveryStatus: "unconfirmed", providerId: "email-1" });
    const sent = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(sent.reply_to).toBe("owner@example.com");
    expect(sent.html).toContain("Example &amp; Friends");
    fetcher.mockResolvedValue(Response.json({ last_event: "delivered" }));
    await f.t.action(priv.artistNotifications.checkDelivery, { id: f.id, check: 0 });
    expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ deliveryStatus: "delivered" });
  });
  it("retries transient failures with the same provider idempotency key and body", async () => {
    const f = await fixture();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(Response.json({ id: "email-2" }));
    vi.stubGlobal("fetch", fetcher);
    await f.t.action(priv.artistNotifications.send, { id: f.id });
    expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "pending", attempts: 1 });
    vi.setSystemTime(NOW + 121_000);
    await f.t.action(priv.artistNotifications.send, { id: f.id });
    expect(fetcher.mock.calls[0][1].headers["Idempotency-Key"]).toBe(fetcher.mock.calls[1][1].headers["Idempotency-Key"]);
    expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
    expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "accepted", attempts: 2 });
  });
  it("recovers a crashed action lease and refuses stale completion", async () => {
    const f = await fixture();
    const first = await f.t.mutation(priv.artistNotifications.reserve, { id: f.id });
    expect(await f.t.mutation(priv.artistNotifications.reserve, { id: f.id })).toBeNull();
    vi.setSystemTime(NOW + 121_000);
    await f.t.mutation(priv.artistNotifications.reserve, { id: f.id });
    await f.t.mutation(priv.artistNotifications.finish, { id: f.id, attempt: first.attempts, revision: first.revision, providerId: "stale" });
    expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "sending", attempts: 2 });
  });
  it("stops automatic retries before the provider deduplication window expires", async () => {
    const f = await fixture();
    await f.t.mutation(priv.artistNotifications.reserve, { id: f.id });
    vi.setSystemTime(NOW + 24 * 3600000);
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await f.t.action(priv.artistNotifications.send, { id: f.id });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "failed" });
  });
  it("makes configuration failures visible and restricts manual retry to admins", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const f = await fixture();
    await f.t.action(priv.artistNotifications.send, { id: f.id });
    expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "failed", attempts: 1 });
    await expect(f.t.query(pub.artistNotifications.listRecent, {})).rejects.toThrow("logged in");
    await expect(f.t.withIdentity({ subject: "applicant" }).mutation(pub.artistNotifications.retry, { id: f.id })).rejects.toThrow("Admin");
    vi.setSystemTime(NOW + 61_000);
    await f.admin.mutation(pub.artistNotifications.retry, { id: f.id });
    expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "pending", revision: 1, attempts: 0 });
  });
  it("does not send access-ready email after membership was revoked", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.claimId, { status: "approved" }));
    await f.t.mutation(priv.artistNotifications.enqueue, { claimId: f.claimId, kind: "approved" });
    const row = (await f.t.run(ctx => ctx.db.query("artistNotifications").collect())).find(r => r.kind === "approved")!;
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await f.t.action(priv.artistNotifications.send, { id: row._id });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await f.t.run(ctx => ctx.db.get(row._id))).toMatchObject({ status: "cancelled" });
  });
  it("cancels an obsolete pending notification instead of emailing the wrong status", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.claimId, { status: "approved" }));
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await f.t.action(priv.artistNotifications.send, { id: f.id });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await f.t.run(ctx => ctx.db.get(f.id))).toMatchObject({ status: "cancelled" });
  });
});

describe("public artist verification", () => {
  it("requires reviewed access and disappears immediately when membership is revoked", async () => {
    const f = await fixture();
    const status = () => f.t.query(pub.artistAccess.getPublicTeamStatus, { artistId: f.artistId });
    expect(await status()).toEqual({ verifiedTeam: false });
    await f.t.run(ctx => ctx.db.patch(f.claimId, { status: "approved", verificationMethod: "manual_review", reviewedBy: f.adminId }));
    expect(await status()).toEqual({ verifiedTeam: false });
    const member = await f.t.run(ctx => ctx.db.insert("artistMembers", { artistId: f.artistId, userId: f.userId, role: "manager", createdAt: NOW }));
    expect(await status()).toEqual({ verifiedTeam: true });
    await f.t.run(ctx => ctx.db.delete(member));
    expect(await status()).toEqual({ verifiedTeam: false });
  });
});

