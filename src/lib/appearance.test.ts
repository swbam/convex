// @vitest-environment node
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import {
  appearanceVariables, buttonTextColor, contrastRatio, DEFAULT_APPEARANCE,
  normalizeAppearance, readableAccent,
} from "../../shared/appearance";

const modules = import.meta.glob("../../convex/**/*.{ts,js}");
async function fixture() {
  const t = convexTest({ schema, modules });
  await t.run(async ctx => {
    await ctx.db.insert("users", { authId: "appearance-admin", username: "admin", role: "admin", createdAt: 1 });
    await ctx.db.insert("users", { authId: "appearance-fan", username: "fan", role: "user", createdAt: 1 });
  });
  return { t, admin: t.withIdentity({ subject: "appearance-admin" }), fan: t.withIdentity({ subject: "appearance-fan" }) };
}

describe("site appearance settings", () => {
  it("provides public defaults without inserting a record", async () => {
    const { t } = await fixture();
    expect(await t.query(api.appearance.get, {})).toEqual({ settings: DEFAULT_APPEARANCE, revision: 0, updatedAt: null });
    expect(await t.run(ctx => ctx.db.query("siteAppearance").collect())).toHaveLength(0);
  });

  it("rejects anonymous and non-admin writes", async () => {
    const { t, fan } = await fixture();
    const args = { settings: DEFAULT_APPEARANCE, expectedRevision: 0 };
    await expect(t.mutation(api.appearance.save, args)).rejects.toThrow("logged in");
    await expect(fan.mutation(api.appearance.save, args)).rejects.toThrow("Admin access");
    expect(await t.run(ctx => ctx.db.query("siteAppearance").collect())).toHaveLength(0);
  });

  it("persists normalized colors once and audits the change without leaking the actor publicly", async () => {
    const { t, admin } = await fixture();
    const settings = { ...DEFAULT_APPEARANCE, accentColor: "#ABC", buttonStyle: "outline" as const };
    expect(await admin.mutation(api.appearance.save, { settings, expectedRevision: 0 })).toEqual({ revision: 1 });
    const result = await t.query(api.appearance.get, {});
    expect(result.settings.accentColor).toBe("#aabbcc");
    expect(Object.keys(result).sort()).toEqual(["revision", "settings", "updatedAt"]);
    expect(await t.run(ctx => ctx.db.query("siteAppearance").collect())).toHaveLength(1);
    const logs = await t.run(ctx => ctx.db.query("adminAuditLogs").collect());
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: "appearance.save", success: true });
    expect(await admin.mutation(api.appearance.save, { settings, expectedRevision: 1 })).toEqual({ revision: 1 });
    expect(await t.run(ctx => ctx.db.query("adminAuditLogs").collect())).toHaveLength(1);
  });

  it("prevents a stale editor from overwriting another save and allows restoring defaults", async () => {
    const { t, admin } = await fixture();
    const settings = { ...DEFAULT_APPEARANCE, accentColor: "#e7c66f" };
    await admin.mutation(api.appearance.save, { settings, expectedRevision: 0 });
    await expect(admin.mutation(api.appearance.save, { settings: DEFAULT_APPEARANCE, expectedRevision: 0 })).rejects.toThrow("another session");
    expect((await t.query(api.appearance.get, {})).settings).toEqual(settings);
    await admin.mutation(api.appearance.save, { settings: DEFAULT_APPEARANCE, expectedRevision: 1 });
    expect((await t.query(api.appearance.get, {})).settings).toEqual(DEFAULT_APPEARANCE);
    expect(await t.run(ctx => ctx.db.query("siteAppearance").collect())).toHaveLength(1);
  });

  it.each([
    { accentColor: "red; background:url(https://example.com)" },
    { logoStartColor: "url(https://example.com)" },
    { logoEndColor: "#fff0" },
    { gradientAngle: -1 },
    { gradientAngle: 361 },
    { gradientAngle: 45.5 },
  ])("rejects invalid appearance values before writing: %j", async invalid => {
    const { t, admin } = await fixture();
    await expect(admin.mutation(api.appearance.save, { settings: { ...DEFAULT_APPEARANCE, ...invalid }, expectedRevision: 0 })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.query("siteAppearance").collect())).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.query("adminAuditLogs").collect())).toHaveLength(0);
  });
});

describe("appearance readability and CSS", () => {
  it.each(["#000000", "#ffffff", "#777777", "#2bcfb2", "#e7c66f", "#ff0000", "#0000ff"])("keeps %s button labels and themed accent text readable", color => {
    expect(contrastRatio(color, buttonTextColor(color))).toBeGreaterThanOrEqual(4.5);
    for (const surface of ["#131313", "#ffffff"]) {
      expect(contrastRatio(readableAccent(color, surface), surface)).toBeGreaterThanOrEqual(4.5);
    }
    const light = appearanceVariables({ ...DEFAULT_APPEARANCE, accentColor: color }, true);
    for (const surface of ["#ffffff", "#f3f4f6", "#ebeef2"]) {
      expect(contrastRatio(light["--brand-ink"], surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(light["--brand-button-bg"], light["--brand-button-fg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(light["--brand-button-bg"], "#f3f4f6")).toBeGreaterThanOrEqual(3);
  });
  it("keeps the logo gradient separate from button fill and selected-state ink", () => {
    const variables = appearanceVariables(DEFAULT_APPEARANCE);
    expect(variables["--brand-logo"]).toBe("linear-gradient(90deg, #2bcfb2, #00c982)");
    expect(variables["--brand-button-bg"]).toBe("#ffffff");
    expect(variables["--brand-button-fg"]).toBe("#000000");
    const outlined = appearanceVariables({ ...DEFAULT_APPEARANCE, buttonStyle: "outline", logoGradient: false }, true);
    expect(outlined["--brand-logo"]).toBe("#2bcfb2");
    expect(outlined["--brand-button-bg"]).toBe("transparent");
    expect(contrastRatio(outlined["--brand-button-fg"], "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  it("drops unknown properties and normalizes short hex colors", () => {
    expect(normalizeAppearance({ ...DEFAULT_APPEARANCE, accentColor: " #ABC " })).toEqual({ ...DEFAULT_APPEARANCE, accentColor: "#aabbcc" });
  });
});
