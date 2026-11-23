import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeOAuthIntent,
  safeCampaignProperties,
  isSensitiveAnalyticsRoute,
  recordOAuthIntent,
  sanitizeAnalyticsPath,
  shouldCaptureAnalyticsPath,
} from "./analytics";

describe("analytics privacy and attribution helpers", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("recognizes invite-token routes as sensitive", () => {
    expect(isSensitiveAnalyticsRoute("/for-artists/invite/secret-token")).toBe(true);
    expect(isSensitiveAnalyticsRoute("/for-artists/artist-id/team")).toBe(false);
    expect(
      sanitizeAnalyticsPath("/for-artists/invite/secret-token"),
    ).toBe("/for-artists/invite/:token");
    expect(
      shouldCaptureAnalyticsPath("/for-artists/invite/secret-token"),
    ).toBe(false);
    expect(shouldCaptureAnalyticsPath("/shows/show-id")).toBe(true);
  });

  it("preserves OAuth attribution for one callback only", () => {
    recordOAuthIntent({
      auth_method: "spotify",
      auth_mode: "sign_up",
      source: "sign_up_page",
    });

    expect(consumeOAuthIntent()).toEqual({
      auth_method: "spotify",
      auth_mode: "sign_up",
      source: "sign_up_page",
    });
    expect(consumeOAuthIntent()).toBeNull();
  });
});

it("retains only bounded campaign labels, excluding URL and personal fields", () => {
  expect(safeCampaignProperties("?utm_source=instagram&utm_medium=social&utm_campaign=fall-tour&token=secret&q=private")).toEqual({ utm_source: "instagram", utm_medium: "social", utm_campaign: "fall-tour" });
  expect(safeCampaignProperties("?utm_source=person%40example.com&utm_campaign=https%3A%2F%2Fprivate.example")).toEqual({});
});
